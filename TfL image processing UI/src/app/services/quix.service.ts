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
  private token: string = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik1qVTBRVE01TmtJNVJqSTNOVEpFUlVSRFF6WXdRVFF4TjBSRk56SkNNekpFUWpBNFFqazBSUSJ9.eyJodHRwczovL3F1aXguYWkvb3JnX2lkIjoiZGVtbyIsImh0dHBzOi8vcXVpeC5haS9vd25lcl9pZCI6ImF1dGgwfGM1NzNiNzdiLTczYTUtNGU3OS05MjJlLTRiMDM5YTk3NGQ0NCIsImh0dHBzOi8vcXVpeC5haS90b2tlbl9pZCI6ImU2YTI3ZDA4LTgzZmQtNGZhOC1iOTNlLTE3OGZiNGE0OWFlMSIsImh0dHBzOi8vcXVpeC5haS9leHAiOiIxNzA5MTYxMjAwIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLnF1aXguYWkvIiwic3ViIjoiY1hvVXBDS1JmaFBhUUpTN0QzazlLdjFSazRqamgzSGVAY2xpZW50cyIsImF1ZCI6InF1aXgiLCJpYXQiOjE2OTE0OTA2NDcsImV4cCI6MTY5NDA4MjY0NywiYXpwIjoiY1hvVXBDS1JmaFBhUUpTN0QzazlLdjFSazRqamgzSGUiLCJndHkiOiJjbGllbnQtY3JlZGVudGlhbHMiLCJwZXJtaXNzaW9ucyI6W119.ctibPkY_9h5s1-08tlY9PyBwA_HrwST4e8MsIHGU-JLQd6wEPoSOxOUWBrrBTy4qVh2J_WEoIA7VZa4YFxl0N8viYwh-ZKBfOx_tg8vGmZINFy5KhmGJC4wBPrya9L4NnpZpKKTbPc2_mM4yXRS-sScaYsYxULh_KM7fZV2QIHM1_AlsC2kPESqMzJEQEs6doN-KHkrqLoXpV4uKf85kLkHJSVkBKZFZThUK9V5MKaBbOrg5TO1C9NSp3D0KiJB7nbKg9I3GcA-Y41b0geDDGFc0L_DujOiD_WbixKXz07S1rX-Ap85MyAX-E8T8uw15tb6LIaK4mgnk2snsgVcFSA"; // Create a token in the Tokens menu and paste it here
  public workspaceId: string = "demo-computervisiondemo-prod"; // Look in the URL for the Quix Portal. Your workspace ID is after 'workspace='
  public topicName: string = "demo-computervisiondemo-prod-image-processed-merged"; // get topic name from the Topics page in the Quix portal
  
  /* optional */
  public uiProjectDeploymentId: string = ""; // links from the info text in the left hand panel use this to link you to the project in the platform. Easier to leave it blank.
  public computerVisionProjectDeploymentId: string = ""; // links from the info text in the left hand panel use this to link you to the project in the platform. Easier to leave it blank.
  public maxVehicleWindowProjectDeploymentId: string = ""; // links from the info text in the left hand panel use this to link you to the project in the platform. Easier to leave it blank.
  /*~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-*/

  private domain = "platform";
  readonly server = ""; // leave blank

  private domainRegex = new RegExp("^https:\\/\\/portal-api\\.([a-zA-Z]+)\\.quix\\.ai")
  private baseReaderUrl: string;
  private connection: HubConnection;
  private initCompleted: Subject<void> = new Subject<void>();
  get initCompleted$(): Observable<void> {
    return this.initCompleted.asObservable();
  }

  constructor(private httpClient: HttpClient) {

    // if working locally is set
    if (this.workingLocally) {
      // use the config hard coded above
      this.domain = "platform"; // default to prod
      this.baseReaderUrl = "https://reader-" + this.workspaceId + "." + this.domain + ".quix.ai/hub";
      setTimeout(() => this.initCompleted.next());
      return;
    }

    const headers = new HttpHeaders().set('Content-Type', 'text/plain; charset=utf-8');

    let bearerToken$ = this.httpClient.get(this.server + "bearer_token", { headers, responseType: 'text' });
    let topic$ = this.httpClient.get(this.server + "processed_topic", { headers, responseType: 'text' });
    let workspaceId$ = this.httpClient.get(this.server + "workspace_id", { headers, responseType: 'text' });
    let portalApi$ = this.httpClient.get(this.server + "portal_api", { headers, responseType: 'text' })

    // if the solution is deployed in the platform. as part of the ungated / demo experience, set these so the links work correctly.
    // if running locally or cloned to another repo then these aren't important and the solution will still run
    let uiProjectDeploymentId$ = this.httpClient.get(this.server + "uiProjectDeploymentId", { headers, responseType: 'text' })
    let computerVisionProjectDeploymentId$ = this.httpClient.get(this.server + "computerVisionProjectDeploymentId", { headers, responseType: 'text' })
    let maxVehicleWindowProjectDeploymentId$ = this.httpClient.get(this.server + "maxVehicleWindowProjectDeploymentId", { headers, responseType: 'text' })

    let value$ = combineLatest([
      bearerToken$,
      topic$,
      workspaceId$,
      portalApi$,
      uiProjectDeploymentId$,
      computerVisionProjectDeploymentId$,
      maxVehicleWindowProjectDeploymentId$
    ]).subscribe(([bearerToken, topic, workspaceId, portalApi, uiProjectDeploymentId, computerVisionProjectDeploymentId, maxVehicleWindowProjectDeploymentId]) => {
      this.token = (bearerToken).replace("\n", "");
      this.workspaceId = (workspaceId).replace("\n", "");
      this.topicName = (this.workspaceId + "-" + topic).replace("\n", "");

      // if the solution is deployed in the platform. as part of the ungated / demo experience, set these so the links work correctly.
      // if running locally or cloned to another repo then these aren't important and the solution will still run
      this.uiProjectDeploymentId = uiProjectDeploymentId.replace("\n", "");
      this.computerVisionProjectDeploymentId = computerVisionProjectDeploymentId.replace("\n", "");
      this.maxVehicleWindowProjectDeploymentId = maxVehicleWindowProjectDeploymentId.replace("\n", "");

      // work out what domain the portal api is on:
      let matches = portalApi.replace("\n", "").match(this.domainRegex);
      if (matches) this.domain = matches[1];
      else this.domain = "platform"; // default to prod
      // don't change this
      this.baseReaderUrl = "https://reader-" + this.workspaceId + "." + this.domain + ".quix.ai/hub";

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