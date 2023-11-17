import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder } from "@microsoft/signalr";
import { Observable, Subject, combineLatest } from "rxjs";
import { map } from "rxjs/operators";

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
  /*~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-*/

  public uiProjectDeploymentId: string = "260917e8-83eb-4f28-a89d-5db406a91023"; // links from the info text in the left hand panel use this to link you to the project in the platform. Easier to leave it blank or leave as is. (links to prod only)
  public computerVisionProjectDeploymentId: string = "2a5f5e00-31a7-48ce-8d6f-0ddf257cce69"; // links from the info text in the left hand panel use this to link you to the project in the platform. Easier to leave it blank or leave as is.
  public maxVehicleWindowProjectDeploymentId: string = "c8ef68fd-f3da-468a-814e-62edeafd810a"; // links from the info text in the left hand panel use this to link you to the project in the platform. Easier to leave it blank or leave as is.
  
  public deepLinkWorkspaceId: string = "demo-computervisiondemo-prod";
  public quixDeploymentId: string = ""; // the deployment ID of the host running this code in Quix. Not nessecarily the same as uiProjectDeploymentId (depending on environment)

  private domain = "platform";
  readonly server = ""; // leave blank

  private domainRegex = new RegExp("^https:\\/\\/portal-api\\.([a-zA-Z]+)\\.quix\\.io")
  private baseReaderUrl: string;
  private connection: HubConnection;
  private initCompleted: Subject<void> = new Subject<void>();
  get initCompleted$(): Observable<void> {
    return this.initCompleted.asObservable();
  }

  constructor(private httpClient: HttpClient) {

    // if working locally is set
    if (this.workingLocally || location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      // use the config hard coded above
      this.domain = "platform"; // default to prod
      this.baseReaderUrl = "https://reader-" + this.workspaceId + "." + this.domain + ".quix.io/hub";
      setTimeout(() => this.initCompleted.next());
      return;
    }

    const headers = new HttpHeaders().set('Content-Type', 'text/plain; charset=utf-8');

    let bearerToken$ = this.httpClient.get(this.server + "bearer_token", { headers, responseType: 'text' });
    let topic$ = this.httpClient.get(this.server + "processed_topic", { headers, responseType: 'text' });
    let workspaceId$ = this.httpClient.get(this.server + "workspace_id", { headers, responseType: 'text' });
    let portalApi$ = this.httpClient.get(this.server + "portal_api", { headers, responseType: 'text' })

    combineLatest([
      bearerToken$,
      topic$,
      workspaceId$,
      portalApi$,
    ]).subscribe(([bearerToken, topic, workspaceId, portalApi]) => {
      this.token = (bearerToken).replace("\n", "");
      this.workspaceId = (workspaceId).replace("\n", "");
      this.topicName = (topic).replace("\n", "");

      // work out what domain the portal api is on:
      let matches = portalApi.replace("\n", "").match(this.domainRegex);
      if (matches) this.domain = matches[1];
      else this.domain = "platform"; // default to prod
      // don't change this
      this.baseReaderUrl = "https://reader-" + this.workspaceId + "." + this.domain + ".quix.io/hub";

      this.initCompleted.next();
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