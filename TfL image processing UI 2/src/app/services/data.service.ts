import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  workspaceId: string = "frontend"; // Look in the URL for the Quix Portal your workspace ID is after 'workspace='
  url: string;

  constructor(private httpClient: HttpClient) {
    this.url = `https://dataapi-state-2-demo-computervisiondemo-${this.workspaceId}.deployments.quix.ai`
  }

  getMaxVehicles(): Observable<{ [key: string]: number }> {
    const url = `${this.url}/max_vehicles`
    return this.httpClient.get<{ [key: string]: number }>(url)
  }

  getDetectedObjects(): Observable<{ [key: string]: any }> {
    const url = `${this.url}/detected_objects`
    return this.httpClient.get<{ [key: string]: number }>(url)
  }
}
