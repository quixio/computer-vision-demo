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
  private token: string = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik1qVTBRVE01TmtJNVJqSTNOVEpFUlVSRFF6WXdRVFF4TjBSRk56SkNNekpFUWpBNFFqazBSUSJ9.eyJodHRwczovL3F1aXguYWkvb3JnX2lkIjoiZGVtbyIsImh0dHBzOi8vcXVpeC5haS9vd25lcl9pZCI6ImF1dGgwfDczOWMwODljLThjNzgtNDBmZi05OTQwLWFjNDVmZDlkMDUwYiIsImh0dHBzOi8vcXVpeC5haS90b2tlbl9pZCI6IjcwZGM3ZWM4LWQwMWEtNDZjZi1hYTFkLTY2ZGQ1MjhiZDI2NCIsImh0dHBzOi8vcXVpeC5haS9leHAiOiIxNjk1ODU1NjAwIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLnF1aXguYWkvIiwic3ViIjoiTGc0SzhoUWd4Zmo3b1RhNzMwaDNqczBBRURtU1hrcTdAY2xpZW50cyIsImF1ZCI6InF1aXgiLCJpYXQiOjE2OTM5OTY0NzcsImV4cCI6MTY5NjU4ODQ3NywiYXpwIjoiTGc0SzhoUWd4Zmo3b1RhNzMwaDNqczBBRURtU1hrcTciLCJndHkiOiJjbGllbnQtY3JlZGVudGlhbHMiLCJwZXJtaXNzaW9ucyI6W119.g49oHiWfAEY-KK9iHSNT9ejqZzyXRCvKE9ekUDCAw2MFXsClo_-KMTl7o0myYSKior8KpssI2T3Bl9qjsA4tOtsftxPYNyUjdr_Od-W7ju3ATspMj6j7sTZ3nDEUIocEBnuhA3MbQ9RNMUrBTLfaXqRhDNXY9-SV6n0sMUcN5bm7zlmK3PwJ2M-5Q2w0HOLn1mHicKrr6fNT4ieF9VJHbnFlF6Y_LmszH0t1bf5rsaCTFOv8NPbCXizrhWHJiQqiiHrZXAc2H6hhyjHpq7wroHTgJm6e4GeitzudUvJIpGXZSs9Csb868SZWuAnKJvPxFG6Two3koRyaLuuwNy3c1Q"; // Create a token in the Tokens menu and paste it here
  public workspaceId: string = "demo-computervisiondemo-apidata"; // Look in the URL for the Quix Portal your workspace ID is after 'workspace='
  public topicName: string = "image-processed-merged"; // get topic name from the Topics page in Quix portal
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
      this.initCompleted.next(this.topicName);
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
      this.topicName = (this.workspaceId + "-" + vals.topic).replace("\n", "");

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