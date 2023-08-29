import { Injectable } from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {BehaviorSubject, combineLatest, Observable, of, Subject} from "rxjs";
import {map} from "rxjs/operators";
import {HubConnection, HubConnectionBuilder} from "@microsoft/signalr";

@Injectable({
  providedIn: 'root'
})
export class QuixService {
  /*~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-*/
  /*WORKING LOCALLY? UPDATE THESE!*/
  public workingLocally = true; // set to true if working locally
  private token: string = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik1qVTBRVE01TmtJNVJqSTNOVEpFUlVSRFF6WXdRVFF4TjBSRk56SkNNekpFUWpBNFFqazBSUSJ9.eyJodHRwczovL3F1aXguYWkvb3JnX2lkIjoiZGVtbyIsImh0dHBzOi8vcXVpeC5haS9vd25lcl9pZCI6ImF1dGgwfGM1NzNiNzdiLTczYTUtNGU3OS05MjJlLTRiMDM5YTk3NGQ0NCIsImh0dHBzOi8vcXVpeC5haS90b2tlbl9pZCI6ImU2YTI3ZDA4LTgzZmQtNGZhOC1iOTNlLTE3OGZiNGE0OWFlMSIsImh0dHBzOi8vcXVpeC5haS9leHAiOiIxNzA5MTYxMjAwIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLnF1aXguYWkvIiwic3ViIjoiY1hvVXBDS1JmaFBhUUpTN0QzazlLdjFSazRqamgzSGVAY2xpZW50cyIsImF1ZCI6InF1aXgiLCJpYXQiOjE2OTE0OTA2NDcsImV4cCI6MTY5NDA4MjY0NywiYXpwIjoiY1hvVXBDS1JmaFBhUUpTN0QzazlLdjFSazRqamgzSGUiLCJndHkiOiJjbGllbnQtY3JlZGVudGlhbHMiLCJwZXJtaXNzaW9ucyI6W119.ctibPkY_9h5s1-08tlY9PyBwA_HrwST4e8MsIHGU-JLQd6wEPoSOxOUWBrrBTy4qVh2J_WEoIA7VZa4YFxl0N8viYwh-ZKBfOx_tg8vGmZINFy5KhmGJC4wBPrya9L4NnpZpKKTbPc2_mM4yXRS-sScaYsYxULh_KM7fZV2QIHM1_AlsC2kPESqMzJEQEs6doN-KHkrqLoXpV4uKf85kLkHJSVkBKZFZThUK9V5MKaBbOrg5TO1C9NSp3D0KiJB7nbKg9I3GcA-Y41b0geDDGFc0L_DujOiD_WbixKXz07S1rX-Ap85MyAX-E8T8uw15tb6LIaK4mgnk2snsgVcFSA"; // Create a token in the Tokens menu and paste it here
  public workspaceId: string = "demo-videoprocessing"; // Look in the URL for the Quix Portal your workspace ID is after 'workspace='
  public topic: string = "image-processed-merged"; // get topic name from the Topics page in Quix portal
  
  // private token: string = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik1qVTBRVE01TmtJNVJqSTNOVEpFUlVSRFF6WXdRVFF4TjBSRk56SkNNekpFUWpBNFFqazBSUSJ9.eyJodHRwczovL3F1aXguYWkvb3JnX2lkIjoiZGVtbyIsImh0dHBzOi8vcXVpeC5haS9vd25lcl9pZCI6ImF1dGgwfGM1NzNiNzdiLTczYTUtNGU3OS05MjJlLTRiMDM5YTk3NGQ0NCIsImh0dHBzOi8vcXVpeC5haS90b2tlbl9pZCI6IjgwNTVmZTU4LTIxMDItNDljZi04MGZlLTcyYjEzNjlkZWU5MSIsImh0dHBzOi8vcXVpeC5haS9leHAiOiIxNzMwMzI5MjAwIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLnF1aXguYWkvIiwic3ViIjoicGhKWGx5cEtkMXJabjE1aksyWk5mcWVBMlBZcGZXQVpAY2xpZW50cyIsImF1ZCI6InF1aXgiLCJpYXQiOjE2OTMyOTg4OTUsImV4cCI6MTY5NTg5MDg5NSwiYXpwIjoicGhKWGx5cEtkMXJabjE1aksyWk5mcWVBMlBZcGZXQVoiLCJndHkiOiJjbGllbnQtY3JlZGVudGlhbHMiLCJwZXJtaXNzaW9ucyI6W119.MKv4RlV5pPo5NI_tA98rsHu5KeT58gm1CjQzWuSOzKbRXUtq9keJC8K8IItkTS1TONfTQvKj3azfo7lqQaCtXB8Iy9QZG65FV_0FfOKdjarbuaob1XvU2MXMB8cOUuPw4FAMO0h5_9M-Ej5F47GZHxBP6fQZQZD_567mxPIEV3-z4fY36iMjsDegg6aGO8196avOXYJ6NiojK7VD_1hiQ9Ps3bzoui51Gm04hP4jmyyVDZ0pETMs7W72GSye1IX5HJdHD_YIrbOupmE6MmGFmTQcQ2TFqQTTpnQU7j_juIrzPw_5XrDwdDJgK58dGRdfpz4lv8AjTxzAAcy1zMC20w"; // Create a token in the Tokens menu and paste it here
  // private token: string = "sdk-1082ed8431904aa99b42b6ec3823265a"; // Create a token in the Tokens menu and paste it here
  // public workspaceId: string = "demo-computervisiondemo-frontend"; // Look in the URL for the Quix Portal your workspace ID is after 'workspace='
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

  constructor(private httpClient: HttpClient) {

    if (this.workingLocally) {
      this.domain = "platform"; // default to prod
      this.baseReaderUrl = "https://reader-" + this.workspaceId + "." + this.domain + ".quix.ai/hub";
      this.initCompleted.next(this.topic);
      return;
    }

    const headers = new HttpHeaders().set('Content-Type', 'text/plain; charset=utf-8');

    let sdkToken$ = this.httpClient.get(this.server + "sdk_token", {headers, responseType: 'text'});
    let topic$ = this.httpClient.get(this.server + "processed_topic", {headers, responseType: 'text'});
    let workspaceId$ =  this.httpClient.get(this.server + "workspace_id", {headers, responseType: 'text'});
    let portalApi$ = this.httpClient.get(this.server + "portal_api", {headers, responseType: 'text'})

    let value$ = combineLatest(
        sdkToken$,
        topic$,
        workspaceId$,
        portalApi$
    ).pipe(map(([sdkToken, topic, workspaceId, portalApi])=>{
      return {sdkToken, topic, workspaceId, portalApi};
    }));

    value$.subscribe(vals => {
      this.token = (vals.sdkToken).replace("\n", "");
      this.workspaceId = (vals.workspaceId).replace("\n", "");
      this.topic = (this.workspaceId + "-" + vals.topic).replace("\n", "");

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

      this.initCompleted.next(this.topic);
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