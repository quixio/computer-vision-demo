import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  constructor(private httpClient: HttpClient) {}

  getMaxVehicles(workspaceId: string): Observable<{ [key: string]: number }> {
    const url = `https://data-api-${workspaceId}.deployments.quix.ai/max_vehicles`
    return this.httpClient.get(url, { responseType: 'text' }).pipe(
      map((response) => this.sanitizeData(response))
    )
  }

  getDetectedObjects(workspaceId: string, id?: string): Observable<{ [key: string]: any }> {
    let url = `https://data-api-${workspaceId}.deployments.quix.ai/detected_objects`
    if (id) url += `/${id}` 
    return this.httpClient.get(url, { responseType: 'text' }).pipe(
      map((response) => this.sanitizeData(response))
    )
  }

  getVehicles(workspaceId: string): Observable<{ [key: string]: any }> {
    const url = `https://data-api-${workspaceId}.deployments.quix.ai/vehicles`
    return this.httpClient.get(url, { responseType: 'text' }).pipe(
      map((response) => this.sanitizeData(response))
    )
  }

  /**
   * Util method used for preprocessing the data and sanitizing it
   * so that it doesn't contain NaN. It will find and replace that with 0 instead.
   * This will ensure that it will not fall over when being used on the map to place
   * markers.
   * 
   * @param response - The response from the server as a string 
   * @returns - A sanitized version of the object
   */
  sanitizeData(response: string): { [key: string]: number } {
    // Preprocess the response text to replace "NaN" variations with "null"
    const sanitizedResponseText = response.replace(/"NaN"|NaN|"nan"|null|undefined/gi, '0');
    // Parse the sanitized string response into an object
    const val: { [key: string]: any } = JSON.parse(sanitizedResponseText);
    // Return sanitized value
    return val;
  }
}