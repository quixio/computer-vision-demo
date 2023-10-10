import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { ClusterIconInfo, ClusterIconStyle } from '@google/markerclustererplus';
import { HubConnection } from '@microsoft/signalr';
import { CLUSTER_STYLE } from './constants/cluster';
import { ParameterData } from './models/parameter-data';
import { QuixService } from './services/quix.service';
import { Subject, bufferTime, catchError, delay, filter, map, of, switchMap } from 'rxjs';
import { DataService } from './services/data.service';
import { AgmMap } from '@agm/core';
import { AgmMarkerCluster } from '@agm/markerclusterer';

const CONSTANTS: any = {};

interface MarkerData {
  title?: string;
  latitude?: number;
  longitude?: number;
  date?: Date;
  value?: number;
  max?: number;
  count?: number;
  image?: number;
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
export class AppComponent implements AfterViewInit {
  @ViewChild(AgmMap) map: AgmMap;
  @ViewChild(AgmMarkerCluster) cluster: AgmMarkerCluster;
  popularObjectTypes = ['bicycle', 'bus', 'car', 'motorbike', 'person', 'traffic light', 'truck'];
  latitude: number = 51.5072;
  longitude: number = -0.1000;
  bounds: google.maps.LatLngBounds
  zoom: number = 13;
  selectedMarker: Marker | undefined;
  isLoadingImage: boolean;
  private _markerFrequency = 500;

  markers: Marker[] = [];
  markerIcon: string = 'assets/camera/camera';
  clusterStyle: ClusterIconStyle[] = CLUSTER_STYLE
  showImages: boolean = true;
  lastMarkers: Marker[] = Array(5);
  connection: HubConnection;
  parameterId: string = '';
  workspaceId: string;
  ungatedToken: string;
  uiProjectDeploymentId: string;
  computerVisionProjectDeploymentId: string;
  maxVehicleWindowProjectDeploymentId: string;
  private _maxVehicles: { [key: string]: number } = {};
  private _topicName: string;
  private _topicId: string;
  private _parameterDataReceived$ = new Subject<ParameterData>();

  constructor(private quixService: QuixService, private dataService: DataService) {}

  ngAfterViewInit(): void {

    this.quixService.initCompleted$.subscribe((_) => {
      // set these once we know the quixService is initialized
      this._topicName = this.quixService.topicName;
      this._topicId = this.quixService.workspaceId + '-' + this.quixService.topicName;
      this.workspaceId = this.quixService.workspaceId;
      this.ungatedToken = this.quixService.ungatedToken;
      this.uiProjectDeploymentId = this.quixService.uiProjectDeploymentId;
      this.computerVisionProjectDeploymentId = this.quixService.computerVisionProjectDeploymentId;
      this.maxVehicleWindowProjectDeploymentId = this.quixService.maxVehicleWindowProjectDeploymentId;

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

      this.getInitialData();
    });

    this._parameterDataReceived$.pipe(bufferTime(this._markerFrequency))
      .subscribe((dataBuffer: ParameterData[]) => {
        if (!dataBuffer.length) return;

        dataBuffer.forEach((data) => {
          const markerData: MarkerData = {};
          let key: string | undefined;

          if (data.topicName === this._topicName) {
            key = data.streamId;
            if (data.numericValues['lat']) markerData.latitude = +data.numericValues['lat'][0];
            if (data.numericValues['lon']) markerData.longitude = +data.numericValues['lon'][0];
            if (data.binaryValues['image']) markerData.image = data.binaryValues['image'][0];
            if (data.numericValues[this.parameterId]) markerData.value = data.numericValues[this.parameterId][0];
          }

          if (data.topicName === 'max-vehicles') {
            key = data.tagValues['cam'][0];
            if (data.numericValues['max_vehicles']) this._maxVehicles[key] = data.numericValues['max_vehicles'][0];
            markerData.max = this._maxVehicles[key];
          }

          if (data.topicName === "image-vehicles") {
            key = data.streamId;
            if (data.numericValues['vehicles']) markerData.count = data.numericValues['vehicles'][0];
            if (data.numericValues[this.parameterId]) markerData.value = data.numericValues[this.parameterId][0];
          }

          markerData.title = key;
          markerData.date = new Date(data.timestamps[0] / 1000000);

          const index = this.markers.findIndex((f) => f.title === key)
          const marker: Marker = this.createMarker({ ...this.markers[index], ...markerData });
          if (index > -1) Object.assign(this.markers[index], marker);
          else this.markers.push(marker);

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
    this.dataService.getDetectedObjects(this.workspaceId).pipe(switchMap((detectedObjects) => {
      return this.dataService.getMaxVehicles(this.workspaceId).pipe(switchMap((maxVehicles) => {
        return this.dataService.getVehicles(this.workspaceId).pipe(map((vehicles) => {
          this._maxVehicles = maxVehicles;
          const markersData: MarkerData[] = [];
          Object.keys(detectedObjects).forEach((key) => {
            const data = detectedObjects[key];

            // Filter markers by bounds
            const latLng = new google.maps.LatLng(data.lat, data.lon);
            if (this.bounds !== undefined && !this.bounds?.contains(latLng)) return;

            const markerData: MarkerData = {
              title: key,
              latitude: data.lat,
              longitude: data.lon,
              max: maxVehicles[key],
              image: data?.image,
              date: new Date(data.timestamp / 1000000),
              count: vehicles[key] || 0,
              value: data[this.parameterId] || 0
            }
            markersData.push(markerData);
          });

          return markersData;
        }))
      }))
    }), delay(0)).subscribe((markersData: MarkerData[]) => {
      markersData.forEach((markerData) => {
        const index = this.markers.findIndex((f) => f.title === markerData.title);
        const marker: Marker = this.createMarker({ ...this.markers[index], ...markerData });
        if (index > -1) Object.assign(this.markers[index], marker);
        else this.markers.push(this.createMarker(markerData));
      });
      this.lastMarkers = this.markers.slice().sort((a, b) => b.date?.getTime()! - a.date?.getTime()!).slice(0, 5);
      CONSTANTS.markers = this.markers;
      CONSTANTS.parameterId = this.parameterId;
    })
  }

  createMarker(data: MarkerData | Marker): Marker {
    let percent = 0;
    let index = 0;
    let total = 0;
    if (data.max) {
      percent = Math.round((data.count || 0) / data.max * 100);
      while (percent >= total && total < 100) {
        // Create a new total by dividing by a set number
        total += 100 / 5
        // Increase the index and move up to the next style
        index++;
      }
    }

    const text: string = this.parameterId ? `${data.value}` : `${percent}%`;
    const label: google.maps.MarkerLabel = {
      text: index ? text : '?',
      fontSize: '11px',
      fontWeight: 'bold',
    }
    const marker: Marker = {
      ...data,
      label,
      icon: this.markerIcon + (index ? `${index}.png` : '.svg')
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

    this.connection.invoke('SubscribeToParameter', this._topicId, '*', 'image');
    this.connection.invoke('SubscribeToParameter', this._topicId, '*', 'lat');
    this.connection.invoke('SubscribeToParameter', this._topicId, '*', 'lon');
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
    // Reset data
    (this.cluster as any)?._clusterManager.clearMarkers();
    this.markers = [];
    this.selectedMarker = undefined;

    // Unsubscribe from previous parameter and subscribe to new one
    if (this.parameterId) this.connection?.invoke('UnsubscribeFromParameter', this._topicId, '*', this.parameterId);
    if (parameterId) this.connection?.invoke('SubscribeToParameter', this._topicId, '*', parameterId);

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
    this.connection.invoke(methodName, this._topicId, '*', 'image');
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
      keys.push(marker.title)

      if (!marker.max) continue;
      sum += +(marker.count || 0);
      max += +(marker.max || 0)
    }

    let percent = 0;
    let index = 0;
    let total = 0;
    if (max) {
      percent = Math.round((sum || 0) / max * 100);
      while (percent >= total && total < 100) {
        // Create a new total by dividing by a set number
        total += 100 / 5
        // Increase the index and move up to the next style
        index++;
      }
    }

    // Tell MarkerCluster this clusters details (and how to style it)
    const text: string = CONSTANTS.parameterId ? `${sum}` : `${percent}%`;
    const clusterInfo: ClusterIconInfo = {
      text: index ? text : '?',
      index: index + 1,
      title: keys.join(', ')
    };
    return clusterInfo;
  }

  selectMarker(title: string) {
    const marker = this.markers.find((f) => f.title === title);
    this.selectedMarker = marker;
    if (!marker || marker?.image) return;
  }
}