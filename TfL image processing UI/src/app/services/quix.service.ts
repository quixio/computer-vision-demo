import { Injectable, APP_INITIALIZER, NgModule } from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {BehaviorSubject, combineLatest, Observable, of, Subject} from "rxjs";
import {map} from "rxjs/operators";
import {HubConnection, HubConnectionBuilder} from "@microsoft/signalr";
import { LAZY_MAPS_API_CONFIG, LazyMapsAPILoaderConfigLiteral } from '@agm/core';
import { Inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class QuixService {
  // this is the token that will authenticate the user into the ungated product experience.
  // ungated means no password or login is needed.
  // the token is locked down to the max and everything is read only.
  public ungatedToken: string = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik1qVTBRVE01TmtJNVJqSTNOVEpFUlVSRFF6WXdRVFF4TjBSRk56SkNNekpFUWpBNFFqazBSUSJ9.eyJodHRwczovL3F1aXguYWkvb3JnX2lkIjoiZGVtbyIsImh0dHBzOi8vcXVpeC5haS9vd25lcl9pZCI6ImF1dGgwfDI4YWQ4NWE4LWY1YjctNGFjNC1hZTVkLTVjYjY3OGIxYjA1MiIsImh0dHBzOi8vcXVpeC5haS90b2tlbl9pZCI6ImMzNzljNmVlLWNkMmYtNDExZC1iOGYyLTMyMDU0ZDc5MTY2YSIsImh0dHBzOi8vcXVpeC5haS9leHAiOiIxNzM3ODI5NDc5LjIyMyIsImlzcyI6Imh0dHBzOi8vYXV0aC5xdWl4LmFpLyIsInN1YiI6ImtyMXU4MGRqRllvUUZlb01nMGhqcXZia29lRkxFRDVBQGNsaWVudHMiLCJhdWQiOiJxdWl4IiwiaWF0IjoxNjk1NzE2MDI4LCJleHAiOjE2OTgzMDgwMjgsImF6cCI6ImtyMXU4MGRqRllvUUZlb01nMGhqcXZia29lRkxFRDVBIiwiZ3R5IjoiY2xpZW50LWNyZWRlbnRpYWxzIiwicGVybWlzc2lvbnMiOltdfQ.Ndm0K2iNHPxDq1ohF-yb-6LzIqx_UY8Ptcq0kAwSNye12S3deX_eDkC4XqZqW2NoSLd3GsmWV9PZGetGGp2IlqshQFZtUMp6WP6hq917ZC1i8JFx93PAbY7NT_88nFDovVlaRcoTpWvI-03KbryLkAoB28c6qb3EFwjCWFBuy_yA4yjQ8uF0-AZ0R9Qi4IBaekXWqcgO0a91gVRg0oA_hnzJFoR-EnZ2G1ZSxtuVgnyyPuQTMUvzJuUT_IJTLzEB_kejX0pcXRZBIwHP8MWLB4mE5DtIdz4jm8WIA4eZJZ7ZCG4dk-adQwZ2BdkNknV5eEwRgRJL4ybaplkaDlR-dg';

  /*~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-*/
  /*WORKING LOCALLY? UPDATE THESE!*/
  public workingLocally = false; // set to true if working locally and populate the values below
  private token: string = ""; // Create a token in the Tokens menu and paste it here
  public workspaceId: string = ""; // Look in the URL for the Quix Portal. Your workspace ID is after 'workspace='
  public topicName: string = ""; // get topic name from the Topics page in the Quix portal
  /* optional */
  private googleMapsApiKey: string = "" // your google maps api key. You can leave blank if but you will see the "for development" watermark on the map
  /*~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-*/

  private domain = "platform";
  readonly server = ""; // leave blank

  private domainRegex = new RegExp("^https:\\/\\/portal-api\\.([a-zA-Z]+)\\.quix\\.ai")
  private baseReaderUrl: string;
  private connection: HubConnection;
  private initCompleted: BehaviorSubject<string> = new BehaviorSubject<string>('');
  get initCompleted$(): Observable<string> {
    return this.initCompleted.asObservable();
  }

  constructor(private httpClient: HttpClient, @Inject(LAZY_MAPS_API_CONFIG) mapsConfig: any) {

    // if working locally is set
    if (this.workingLocally) {
      // use the config hard coded above
      this.domain = "platform"; // default to prod
      this.baseReaderUrl = "https://reader-" + this.workspaceId + "." + this.domain + ".quix.ai/hub";
      mapsConfig.apiKey = this.googleMapsApiKey;

      this.initCompleted.next(this.topicName);

      return;
    }

    const headers = new HttpHeaders().set('Content-Type', 'text/plain; charset=utf-8');

    let bearerToken$ = this.httpClient.get(this.server + "bearer_token", {headers, responseType: 'text'});
    let topic$ = this.httpClient.get(this.server + "processed_topic", {headers, responseType: 'text'});
    let workspaceId$ =  this.httpClient.get(this.server + "workspace_id", {headers, responseType: 'text'});
    let portalApi$ = this.httpClient.get(this.server + "portal_api", {headers, responseType: 'text'})
    let mapsApiKey$ = this.httpClient.get(this.server + "GoogleMapsApiKey", {headers, responseType: 'text'})

    let value$ = combineLatest(
        bearerToken$,
        topic$,
        workspaceId$,
        portalApi$,
        mapsApiKey$
    ).pipe(map(([bearerToken, topic, workspaceId, portalApi, mapsApiKey])=>{
      return {bearerToken, topic, workspaceId, portalApi, mapsApiKey};
    }));

    value$.subscribe(vals => {
      this.token = (vals.bearerToken).replace("\n", "");
      this.workspaceId = (vals.workspaceId).replace("\n", "");
      this.topicName = (this.workspaceId + "-" + vals.topic).replace("\n", "");
      this.googleMapsApiKey = vals.mapsApiKey.replace("\n", "");

      // set the google maps api key using the key loaded from environment variables
      // google maps api key can be blank. But you will see the "for development" watermark on the map
      mapsConfig.apiKey = this.googleMapsApiKey;

      // work out what domain the portal api is on:
      let portalApi = vals.portalApi.replace("\n", "");
      let matches = portalApi.match(this.domainRegex);
      if(matches) {
        this.domain = matches[1];
      }
      else {
        this.domain = "platform"; // default to prod
      }

      // don't change this
      this.baseReaderUrl = "https://reader-" + this.workspaceId + "." + this.domain + ".quix.ai/hub";

      this.initCompleted.next(this.topicName);
    });

  }

  /**
   * Makes the initial connection to Quix.
   *
   * If we have already connected then we can just return and
   * skip the process.
   *
   * @param quixToken the Quix token needed to authenticate the connection
   * @param readerUrl the Url we are connecting to
   * @returns
   */
  public ConnectToQuix(): Promise<HubConnection> {

    const options = {
      accessTokenFactory: () => this.token
    };

    this.connection = new HubConnectionBuilder()
        .withAutomaticReconnect()
        .withUrl(this.baseReaderUrl, options)
        .build();

    this.connection.onreconnecting(e => {
      console.log('Connection reconnecting: ', e)
    });
    this.connection.onreconnected(e => {
      console.log('Connection reconnected: ', e)
    });
    this.connection.onclose(e => {
      console.log('Connection close: ', e)
    });

    return this.connection.start().then(() => {
      console.log("Connected to Quix!");
      return this.connection;
    });
  }

}