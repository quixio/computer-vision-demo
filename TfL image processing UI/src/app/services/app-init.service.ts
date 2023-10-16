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
    const googleMapsApiKey = ''; // change this to your API key or leave blank.
    /*~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-*/
    const server = ""; // leave blank

    if (workingLocally || location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      googleMapsConfig.apiKey = googleMapsApiKey;
      return;
    }

    try {
      const headers = new HttpHeaders().set('Content-Type', 'text/plain; charset=utf-8');

      // the ID of this UI deployed to production
      const uiProjectDeploymentId: string = "260917e8-83eb-4f28-a89d-5db406a91023"; // prod deployment id

      // get the ID of this deployment, so we can compare and determine if this is the prod deployment or not.
      const quixDeploymentId = await http.get("Quix__Deployment__Id", { headers, responseType: 'text' }).toPromise();

      // if this is the prod deployment in the Quix demo account then:
      if(quixDeploymentId === uiProjectDeploymentId){
        // use the Google Maps API key retrieved from environment variables
        googleMapsConfig.apiKey = googleMapsApiKey;
      }
      else{
        // else blank the api key so users will see "developer mode" instead of no map at all.
        googleMapsConfig.apiKey = ''; // if you want to use your own Google Maps API key, insert it here.
      }
    } catch (e) {
      console.error(e);
    }
  }
}