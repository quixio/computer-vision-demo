import { Component, OnInit, ViewChild } from '@angular/core';
import { ClusterIconInfo, ClusterIconStyle } from '@google/markerclustererplus';
import { HubConnection } from '@microsoft/signalr';
import { CLUSTER_STYLE } from './constants/cluster';
import { ParameterData } from './models/parameter-data';
import { QuixService } from './services/quix.service';
import { Subject, bufferTime, filter, map, switchMap } from 'rxjs';
import { DataService } from './services/data.service';
import { AgmMap } from '@agm/core';

const CONSTANTS: any = {};


interface MarkerData {
  title: string;
  latitude: number;
  longitude: number;
  value: number;
  timestamp: number;
  max?: number;
  image?: string; 
}

interface Marker extends MarkerData {
  label: string | google.maps.MarkerLabel,
  icon: string | google.maps.Icon | google.maps.Symbol, 
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  @ViewChild(AgmMap) map: AgmMap;
  popularObjectTypes = ['bicycle', 'bus', 'car', 'motorbike', 'person', 'traffic light', 'truck'];
  otherObjectTypes = ['aeroplane', 'apple', 'banana', 'backpack', 'bed', 'bench', 'bird', 'boat', 'book', 'bottle', 'bowl', 'broccoli', 'cake', 'carrot', 'cat'];
  latitude: number = 51.5072;
  longitude: number = -0.1000;
  bounds: google.maps.LatLngBounds
  zoom: number = 13;
  selectedMarker: Marker | undefined;
  private _markerFrequency = 500;

  markers: Marker[] = [];
  markerIcon: string = 'assets/camera/camera';
  clusterStyle: ClusterIconStyle[] = CLUSTER_STYLE
  showImages: boolean = true;
  lastImages: string[] = Array(5);
  connection: HubConnection;
  parameterId: string = 'car';
  private _maxVehicles: { [key: string]: number } = {};
  private _topic: string;
  private _streamId: string = 'input-image';
  private _parameterDataReceived$ = new Subject<ParameterData>();

  constructor(private envVarService: QuixService, private dataService: DataService) { }

  ngOnInit(): void {
    this.getInitialData();

    this.envVarService.initCompleted$.subscribe(topic => {
      this._topic = topic;
      this.envVarService.ConnectToQuix().then(connection => {
        this.connection = connection;
        this.connection.on('ParameterDataReceived', (data: ParameterData) => {
          this._parameterDataReceived$.next(data);
        });
        this.subscribeToData();

        this.connection.onreconnected((connectionId?: string) => {
          if (connectionId) this.subscribeToData();
        });
      });
    });

    this._parameterDataReceived$.pipe(bufferTime(this._markerFrequency))
      .subscribe((dataBuffer: ParameterData[]) => {
        if (!dataBuffer.length) return;

        dataBuffer.forEach((data) => {
          let imageBinary: string | undefined;
          if (data.stringValues['image']) {
            imageBinary = data.stringValues['image'][0];
            this.lastImages.shift();
            this.lastImages.push(imageBinary);
          }
          const key: string = data.tagValues['parent_streamId'][0];
          const markerData: MarkerData = {
            title: key,
            latitude: +data.numericValues['lat'][0],
            longitude: +data.numericValues['lon'][0],
            value: data.numericValues[this.parameterId]?.at(0) || 0,
            max: this._maxVehicles[key],
            image: imageBinary
          }
          const marker: Marker = this.createMarker(markerData);
          const index = this.markers.findIndex((f) => f.title === key)
          // Object.assign to avoid icon flickering
          if (index > -1) Object.assign(this.markers[index], marker); 
          else this.markers.push(marker)
        });
        // Store global variables
        CONSTANTS.markers = this.markers;
      });
  }

  getInitialData(): void {
    this.dataService.getDetectedObjects().pipe(switchMap((detectedObjects) => {
      return this.dataService.getMaxVehicles().pipe(map((maxVehicles) => {
        this._maxVehicles = maxVehicles;
        const markers: Marker[] = [];
        Object.keys(detectedObjects).forEach((key) => {
          const data = detectedObjects[key];
          const markerData: MarkerData = {
            title: key,
            latitude: data.lat[0],
            longitude: data.lon[0],
            value: data[this.parameterId] ? data[this.parameterId][0] : 0,
            max: maxVehicles[key],
            timestamp: 0
          }
          // Filter markers by bounds
          const latLng = new google.maps.LatLng(markerData.latitude, markerData.longitude);
          if (this.bounds.contains(latLng)) markers.push(this.createMarker(markerData));
        });
        return markers;
      }))
    })).subscribe((markers: Marker[]) => {
      this.markers = markers
      CONSTANTS.markers = this.markers;
    })
  }

  createMarker(data: MarkerData): Marker {
    if (!data.max) {
      const marker: Marker = {
        ...data,
        label: '?',
        icon: this.markerIcon + '.svg'
      }

      return marker;
    }

    const percent: number = data.value / data.max * 100;

    let index = 0;
    let total = 0;
    while (percent >= total && total < 100) {
      // Create a new total by dividing by a set number
      total += 100 / 5
      // Increase the index and move up to the next style
      index++;
    }

    const label: google.maps.MarkerLabel = {
      text: Math.round(percent).toString(),
      fontSize: '11px',
      fontWeight: 'bold',
    }
    const marker: Marker = {
      ...data,
      label,
      icon: this.markerIcon + index + '.png'
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
    this.connection.invoke('SubscribeToParameter', this._topic, this._streamId, 'image');
    this.connection.invoke('SubscribeToParameter', this._topic, this._streamId, 'lat');
    this.connection.invoke('SubscribeToParameter', this._topic, this._streamId, 'lon');
    this.connection.invoke('SubscribeToParameter', this._topic, this._streamId, this.parameterId);
    // this.connection.invoke('SubscribeToParameter', 'max-vehicles', 'JamCams_00001.06600', 'max_vehicles');
  }

  /**
   * Loop through old markers and remove them from the map
   * for the new selected object. Also unsubscribes from the old
   * selected parameter and subscribes to the new.

  * @param newSelectedObject the newly selected object
   */
  selectedObjectChanged(parameterId: string) {
    this.markers = [];
    delete CONSTANTS.markers;
    this.connection?.invoke('UnsubscribeFromParameter', this._topic, this._streamId, this.parameterId);
    this.connection?.invoke('SubscribeToParameter', this._topic, this._streamId, parameterId);
    this.parameterId = parameterId;
    this.getInitialData();
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
    const markers: Marker[] = CONSTANTS.markers?.filter((f: Marker) => gmMarkers.some((s) => s.getTitle() === f.title)) || [];
    // Set sum of markers
    let sum = 0;
    let max = 0;
    let keys = [];
    for (let i = 0; i < markers?.length; i++) {
      //This is the custom property called MyValue
      const marker = markers[i];
      if (!marker) continue;

      sum += +(marker.value || 0);
      max += +(marker.max || 0)
      keys.push(marker.title)
    }

    const percent: number = sum / max * 100;
    
    // If not cluster info
    if (isNaN(percent)) {
      const clusterInfo: ClusterIconInfo = {
        text: '?',
        index: 0,
        title: keys.join(', ')
      };
      return clusterInfo;
    }

    let index = 1;
    let total = 0;
    while (percent >= total && total < 100) {
      // Create a new total by dividing by a set number
      total += 100 / 5
      // Increase the index and move up to the next style
      index++;
    }

    // Tell MarkerCluster this clusters details (and how to style it)
    const clusterInfo: ClusterIconInfo = {
      text:  Math.round(percent).toString(),
      index,
      title: keys.join(', ')
    };
    return clusterInfo;
  }

  selectMarker(title: string) {
    this.selectedMarker = this.markers.find((f) => f.title === title);
  }
}