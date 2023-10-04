import { LazyMapsAPILoaderConfigLiteral } from '@agm/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { QuixService } from './quix.service';

@Injectable()
export class AppInitService {

  public static async Init(googleMapsConfig: LazyMapsAPILoaderConfigLiteral, http: HttpClient): Promise<void> {
    /*~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-*/
    /*WORKING LOCALLY? UPDATE THESE!*/
    const workingLocally = false; // set to true if working locally and populate the values below
    const googleMapsApiKey = '';
    /*~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-*/
    const server = ""; // leave blank

    if (workingLocally || location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      googleMapsConfig.apiKey = googleMapsApiKey;
      return;
    }

    try {
      // Business logic to inject the API key is for you to fill in.
      const headers = new HttpHeaders().set('Content-Type', 'text/plain; charset=utf-8');
      const resolve = await http.get(server + 'GoogleMapsApiKey', { headers, responseType: 'text' }).toPromise();
      googleMapsConfig.apiKey = resolve;
    } catch (e) {
      console.error(e);
    }
  }
}