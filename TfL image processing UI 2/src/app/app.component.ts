import { Component, OnInit } from '@angular/core';
import { ClusterIconInfo, ClusterIconStyle } from '@google/markerclustererplus';
import { HubConnection } from '@microsoft/signalr';
import { CLUSTER_STYLE } from './constants/cluster';
import { ParameterData } from './models/parameter-data';
import { QuixService } from './services/quix.service';
import { Subject, bufferTime, filter, switchMap } from 'rxjs';
import { DataService } from './services/data.service';

const CONSTANTS: any = {};

interface Marker {
  title: string;
  latitude: number,
  longitude: number,
  label: string | google.maps.MarkerLabel,
  icon: string | google.maps.Icon | google.maps.Symbol,
  max: number
  value: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  popularObjectTypes = ['bicycle', 'bus', 'car', 'motorbike', 'person', 'traffic light', 'truck'];
  otherObjectTypes = ['aeroplane', 'apple', 'banana', 'backpack', 'bed', 'bench', 'bird', 'boat', 'book', 'bottle', 'bowl', 'broccoli', 'cake', 'carrot', 'cat'];
  latitude: number = 51.5072;
  longitude: number = -0.1000;
  private _markerFrequency = 500;

  private _markersMap: Map<string, Marker> = new Map<string, Marker>();
  markers: Marker[];
  markerIcon: string = 'assets/m/m';
  clusterIcon: string =
    'https://raw.githubusercontent.com/googlemaps/v3-utility-library/master/markerclustererplus/images/m';
  clusterStyle: ClusterIconStyle[] = CLUSTER_STYLE
  showImages: boolean = true;
  last_image: string;
  connection: HubConnection;
  parameterId: string = 'car';
  private _maxVehicles: { [key: string]: number };
  private _topic: string;
  private _streamId: string = 'input-image';
  private _parameterDataReceived$ = new Subject<ParameterData>();

  constructor(private envVarService: QuixService, private dataService: DataService) { }

  ngOnInit(): void {
    this.dataService.getMaxVehicles().subscribe((maxVehicles) => {
      this._maxVehicles = maxVehicles;
    });

    this.envVarService.initCompleted$.subscribe(topic => {
      console.log('Init completed: ' + topic);
      this._topic = topic;
      this.envVarService.ConnectToQuix().then(connection => {
        this.connection = connection;
        this.subscribeToData();
      });
    });

    this._parameterDataReceived$.pipe(bufferTime(this._markerFrequency))
      .subscribe((dataBuffer: ParameterData[]) => {
        dataBuffer.forEach((data) => {
          if (data.stringValues['image']) {
            let imageBinary = data.stringValues['image'][0];
            this.last_image = 'data:image/png;base64,' + imageBinary;
          }
          const key: string = data.tagValues['parent_streamId'][0];
          const marker: Marker | undefined = this.createMarker(data);
          if (marker) this._markersMap.set(key, marker);
        });

        // Store global variables
        this.markers = [...this._markersMap.values()];
        CONSTANTS.markers = this.markers;
      });
  }

  createMarker(data: ParameterData): Marker | undefined {
    const key: string = data.tagValues['parent_streamId'][0]
    const max: number = this._maxVehicles[key];
    const sum: number = data.numericValues[this.parameterId]?.at(0) || 0;

    if (!max) return; 
    const percent: number = sum / max * 100;


    let index = 0;
    let total = 0;
    while (percent >= total && total < 100) {
      // Create a new total by dividing by a set number
      total += 100 / 5
      // Increase the index and move up to the next style
      index++;
    }

    const markerIcon: string = this.markerIcon + index + '.png';
    const marker: Marker = {
      title: data.tagValues['parent_streamId'][0],
      latitude: +data.numericValues['lat'][0],
      longitude: +data.numericValues['lon'][0],
      label: Math.round(percent).toString(),
      icon: markerIcon,
      value: sum,
      max
    }

    return marker;
  }

  /**
   * Using the topic, we can subscribe to the data being outputted
   * by quix.
   * 
   * @param quixTopic the topic we want to retrieve data for
   */
  subscribeToData() {
    this.connection.on('ParameterDataReceived', (data: ParameterData) => {
      this._parameterDataReceived$.next(data);
    });

    this.connection.invoke('SubscribeToParameter', this._topic, this._streamId, 'image');
    this.connection.invoke('SubscribeToParameter', this._topic, this._streamId, 'lat');
    this.connection.invoke('SubscribeToParameter', this._topic, this._streamId, 'lon');
    this.connection.invoke('SubscribeToParameter', this._topic, this._streamId, this.parameterId);
  }

  /**
   * Loop through old markers and remove them from the map
   * for the new selected object. Also unsubscribes from the old
   * selected parameter and subscribes to the new.

  * @param newSelectedObject the newly selected object
   */
  selectedObjectChanged(parameterId: string) {
    this._markersMap.clear();
    delete CONSTANTS.markers;
    this.connection?.invoke('UnsubscribeFromParameter', this._topic, this._streamId, this.parameterId);
    this.connection?.invoke('SubscribeToParameter', this._topic, this._streamId, parameterId);
    this.parameterId = parameterId;
  }

  /**
   * Toggles the feed stream.
   * 
   * If it's currently running then unsubscribe from the parameter.
   * Else we can resubscribe to it to resume retrieving data. 
   */
  toggleFeed() {
    this.showImages = !this.showImages;
    const methodName: string = this.showImages ? 'SubscribeToParameter' : 'UnsubscribeFromParameter';
    this.connection.invoke(methodName, this._topic, this._streamId, 'image');
  }

  //Calculate Function - to show image em formatted text
  calculateFunction(gmMarkers: google.maps.Marker[], numStyle: number): ClusterIconInfo {
    const markers: Marker[] = CONSTANTS.markers?.filter((f: Marker) => gmMarkers.some((s) => s.getTitle() === f.title));

    // Set sum of markers
    let sum = 0;
    let max = 0;
    let keys = [];
    for (let i = 0; i < markers?.length; i++) {
      //This is the custom property called MyValue
      sum += +markers[i].value;
      max += +markers[i].max
      keys.push(markers[i].title)
    }
    const percent: number = sum / max * 100;

    let index = 0;
    let total = 0;
    while (percent >= total && total < 100) {
      // Create a new total by dividing by a set number
      total += 100 / 5
      // Increase the index and move up to the next style
      index++;
    }

    // Tell MarkerCluster this clusters details (and how to style it)
    const clusterInfo: ClusterIconInfo = {
      text: Math.round(percent).toString(),
      index,
      title: keys.join(', ')
    };

    return clusterInfo;
  }
}