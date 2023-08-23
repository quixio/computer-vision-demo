import { Component, OnInit } from '@angular/core';
import { ClusterIconInfo, ClusterIconStyle } from '@google/markerclustererplus';
import { HubConnection } from '@microsoft/signalr';
import { CLUSTER_STYLE } from './constants/cluster';
import { ParameterData } from './models/parameter-data';
import { QuixService } from './services/quix.service';
import { Subject, bufferTime, filter } from 'rxjs';

const CONSTANTS: any = {};

interface Marker {
  latitude: number,
  longitude: number,
  label: string | google.maps.MarkerLabel,
  title: string,
  icon: string | google.maps.Icon | google.maps.Symbol,
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
  private _markerBuffer = 1000;
  private _markerFrequency = 500;

  markers: Marker[] = [];
  markerIcon: string = 'assets/m/m';
  clusterIcon: string =
    'https://raw.githubusercontent.com/googlemaps/v3-utility-library/master/markerclustererplus/images/m';
  clusterStyle: ClusterIconStyle[] = CLUSTER_STYLE
  showImages: boolean = true;
  last_image: string;
  connection: HubConnection;
  parameterId: string = 'car';
  private _topic: string;
  private _streamId: string = 'input-image';
  private _parameterDataReceived$ = new Subject<ParameterData>();

  constructor(private envVarService: QuixService) { }

  ngOnInit(): void {
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
          // if (!data.numericValues[this.parameterId]) return;
          if (data.stringValues['image']) {
            let imageBinary = data.stringValues['image'][0];
            this.last_image = 'data:image/png;base64,' + imageBinary;
          }
      
          const marker: Marker = this.createMarker(data);
          this.markers.push(marker);
        })
        if (this.markers.length > this._markerBuffer) this.markers.shift();
        // Store global variables
        CONSTANTS.markers = this.markers;
      });
  }

  createMarker(data: ParameterData): Marker {
    // Set sum of markers
    const sum =  data.numericValues[this.parameterId]?.at(0) || 0;
    
    /**
     * While we still have markers, divide by a set number and
     * increase the index. Cluster moves up to a new style.
     *
     * The bigger the index, the more markers the cluster contains,
     * so the bigger the cluster.
     */
    //create an index for icon styles
    let index = 0;
    let total = sum;
    while (total !== 0) {
      // Create a new total by dividing by a set number
      total = Math.floor(total / 5);
      // Increase the index and move up to the next style
      index++;
    }


    const markerIcon = this.markerIcon + index + '.png';
    const marker: Marker = {
      latitude: +data.numericValues['lat'][0],
      longitude: +data.numericValues['lon'][0],
      label: sum.toString(),
      title: data.tagValues['parent_streamId'][0],
      icon: markerIcon
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
    this.markers = [];
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
  calculateFunction(markers: google.maps.Marker[], numStyle: number): ClusterIconInfo {
    const gMarkers: Marker[] = CONSTANTS.markers; 
    const selectedMarkers = gMarkers.filter((f) => markers.some((s) => s.getTitle() === f.title));
    console.log(selectedMarkers)

    // Set sum of markers
    let sum = 0;
    for (var m = 0; m < markers.length; m++) {
      //This is the custom property called MyValue
      sum += +markers[m].getLabel()!;
    }

    /**
     * While we still have markers, divide by a set number and
     * increase the index. Cluster moves up to a new style.
     *
     * The bigger the index, the more markers the cluster contains,
     * so the bigger the cluster.
     */
    //create an index for icon styles
    let index = 0;
    let total = sum;
    while (total !== 0) {
      // Create a new total by dividing by a set number
      total = Math.floor(total / 5);
      // Increase the index and move up to the next style
      index++;
    }

    /**
     * Make sure we always return a valid index. E.g. If we only have
     * 5 styles, but the index is 8, this will make sure we return
     * 5. Returning an index of 8 wouldn't have a marker style.
     */
    index = Math.min(index, numStyle);

    //Tell MarkerCluster this clusters details (and how to style it)
    return {
      text: sum.toString(),
      index,
      title: ''
    };
  }

  getStyleIndex(sum: number): number {
    switch (true) {
      case sum < 10:
        return 1;
      case sum < 50:
        return 2;
      case sum < 100:
        return 3;
      case sum < 200:
        return 4;
      case sum > 200:
        return 5;
      default: return 0;
    }
  }
}