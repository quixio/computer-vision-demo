import { Component, OnInit, ViewChild } from '@angular/core';
import { ClusterIconInfo, ClusterIconStyle } from '@google/markerclustererplus';
import { HubConnection } from '@microsoft/signalr';
import { CLUSTER_STYLE } from './constants/cluster';
import { ParameterData } from './models/parameter-data';
import { QuixService } from './services/quix.service';
import { Subject, bufferTime, catchError, filter, map, switchMap } from 'rxjs';
import { DataService } from './services/data.service';
import { AgmMap } from '@agm/core';
import { AgmMarkerCluster, ClusterManager } from '@agm/markerclusterer';

const CONSTANTS: any = {};


interface MarkerData {
  title?: string;
  latitude?: number;
  longitude?: number;
  date?: Date;
  value?: number;
  max?: number;
  image?: string;
}

interface Marker extends MarkerData {
  label?: string | google.maps.MarkerLabel,
  icon?: string | google.maps.Icon | google.maps.Symbol,
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  @ViewChild(AgmMap) map: AgmMap;
  @ViewChild(AgmMarkerCluster) cluster: AgmMarkerCluster;
  popularObjectTypes = ['bicycle', 'bus', 'car', 'motorbike', 'person', 'traffic light', 'truck'];
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
  lastMarkers: Marker[] = Array(5);
  connection: HubConnection;
  parameterId: string = 'vehicles';
  private _maxVehicles: { [key: string]: number } = {};
  private _topicName: string;
  private _streamId: string = 'image-feed';
  private _parameterDataReceived$ = new Subject<ParameterData>();

  constructor(private quixService: QuixService, private dataService: DataService) {
  }

  ngOnInit(): void {
    this.getInitialData();

    this.quixService.initCompleted$.subscribe((topicName) => {
      this._topicName = topicName;

      this.quixService.ConnectToQuix().then(connection => {
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
          const markerData: MarkerData = {};
          let key: string | undefined;

          if (data.topicName === this._topicName) {
            key = data.tagValues['parent_streamId'][0];
            if (data.numericValues['lat']) markerData.latitude = +data.numericValues['lat'][0];
            if (data.numericValues['lon']) markerData.longitude = +data.numericValues['lon'][0];
            if (data.stringValues['image']) markerData.image = data.stringValues['image'][0];
            if (data.numericValues[this.parameterId]) markerData.value = data.numericValues[this.parameterId][0];
          }

          if (data.topicName === 'max_vehicles') {
            key = data.tagValues['cam'][0];
            if (data.numericValues['max_vehicles']) this._maxVehicles[key] = data.numericValues['max_vehicles'][0];
            markerData.max = this._maxVehicles[key];
          }


          if (data.topicName === "image-vehicles") {
            key = data.streamId;
            if (data.numericValues[this.parameterId]) markerData.value = data.numericValues[this.parameterId][0];
          }

          markerData.title = key;
          markerData.date = new Date(data.timestamps[0] / 1000000);

          const index = this.markers.findIndex((f) => f.title === key)
          const marker: Marker = this.createMarker({ ...this.markers[index], ...markerData });
          if (index > -1) Object.assign(this.markers[index], marker);
          else this.markers.push(marker)

          if (markerData.image) {
            this.lastMarkers.shift();
            this.lastMarkers.push(marker);
          }
        });

        // Store global variables
        CONSTANTS.markers = this.markers;
      });
  }

  getInitialData(): void {
    this.dataService.getDetectedObjects().pipe(switchMap((detectedObjects) => {
      return this.dataService.getMaxVehicles().pipe(switchMap((maxVehicles) => {
        return this.dataService.getVehicles().pipe(map((vehicles) => {
          console.log(detectedObjects, vehicles, this.parameterId)
          this._maxVehicles = maxVehicles;
          const markers: Marker[] = [];
          Object.keys(detectedObjects).forEach((key) => {
            const data = detectedObjects[key];
            const markerData: MarkerData = {
              title: key,
              latitude: data.lat,
              longitude: data.lon,
              value: data[this.parameterId] ? data[this.parameterId] : 0,
              max: maxVehicles[key],
              image: data?.image,
            }
            // Filter markers by bounds
            const latLng = new google.maps.LatLng(markerData.latitude!, markerData.longitude!);
            if (this.bounds.contains(latLng)) markers.push(this.createMarker(markerData));
          });
          return markers;
        }))
      }))
    })).subscribe((markers: Marker[]) => {
      this.markers = markers
      CONSTANTS.markers = this.markers;
    })
  }

  createMarker(data: MarkerData | Marker): Marker {
    if (!data.max) {
      const marker: Marker = {
        ...data,
        label: '?',
        icon: this.markerIcon + '.svg'
      }

      return marker;
    }

    const percent: number = (data.value || 0) / data.max * 100;

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
    this.connection.invoke('SubscribeToParameter', this._topicName, this._streamId, 'image');
    this.connection.invoke('SubscribeToParameter', this._topicName, this._streamId, 'lat');
    this.connection.invoke('SubscribeToParameter', this._topicName, this._streamId, 'lon');
    // this.connection.invoke('SubscribeToParameter', this._topicName, this._streamId, this.parameterId);
    this.connection.invoke('SubscribeToParameter', 'max-vehicles', '*', 'max_vehicles');
    this.connection.invoke('SubscribeToParameter', 'image-vehicles', '*', '*');
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
    this.connection?.invoke('UnsubscribeFromParameter', this._topicName, this._streamId, this.parameterId);
    this.connection?.invoke('SubscribeToParameter', this._topicName, this._streamId, parameterId);
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
    this.connection.invoke(methodName, this._topicName, this._streamId, 'image');
  }

  //Calculate Function - to show image em formatted text
  calculateFunction(gmMarkers: google.maps.Marker[], numStyle: number): ClusterIconInfo {
    const markers: Marker[] = CONSTANTS.markers?.filter((f: Marker) => gmMarkers.some((s) => s.getTitle() === f.title)) || [];
    // Set sum of markers
    let sum = 0;
    let max = 0;
    let keys = [];
    for (let i = 0; i < markers?.length; i++) {
      const marker = markers[i];
      if (!marker.max) continue;

      sum += +(marker.value || 0);
      max += +(marker.max || 0)
      keys.push(marker.title)
    }

    const percent: number = sum / max * 100;

    // If not cluster info
    if (!max) {
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
      text: Math.round(percent).toString(),
      index,
      title: keys.join(', ')
    };
    return clusterInfo;
  }

  selectMarker(title: string) {
    const marker = this.markers.find((f) => f.title === title);
    if (!marker) return;
    // this.longitude = marker.longitude;
    // this.latitude = marker.latitude;
    setTimeout(() => this.selectedMarker = marker, 100)
  }
}