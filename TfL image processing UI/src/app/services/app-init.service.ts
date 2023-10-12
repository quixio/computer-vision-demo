import { LazyMapsAPILoaderConfigLiteral } from '@agm/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, OnInit } from '@angular/core';
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
      const headers = new HttpHeaders().set('Content-Type', 'text/plain; charset=utf-8');

      const uiProjectDeploymentId: string = "48366730-b6d7-4332-bd5e-3f4deb7c4d6a"; // prod deployment id
      const quixDeploymentId = await http.get("Quix__Deployment__Id", { headers, responseType: 'text' }).toPromise();

      if(quixDeploymentId === uiProjectDeploymentId){
        const resolvedMapsApiKey = await http.get('GoogleMapsApiKey', { headers, responseType: 'text' }).toPromise();
        googleMapsConfig.apiKey = resolvedMapsApiKey;
      }
      else{
        googleMapsConfig.apiKey = ''; // if you want to use your own Google Maps API key, insert it here.
      }
    } catch (e) {
      console.error(e);
    }
  }
}