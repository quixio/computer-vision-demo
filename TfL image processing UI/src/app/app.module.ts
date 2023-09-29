import { AgmCoreModule, LAZY_MAPS_API_CONFIG, LazyMapsAPILoaderConfigLiteral } from '@agm/core';
import { AgmMarkerClustererModule } from '@agm/markerclusterer';
import { AgmSnazzyInfoWindowModule } from '@agm/snazzy-info-window';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { APP_INITIALIZER, Injectable, NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule } from "@angular/forms";
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { MaterialModule } from './material.module';

@Injectable()
export class AppInitService {
  public static Init(googleMapsConfig: LazyMapsAPILoaderConfigLiteral, http: HttpClient): Promise<void> {
    const headers = new HttpHeaders().set('Content-Type', 'text/plain; charset=utf-8');
    return http.get('GoogleMapsApiKey', { headers, responseType: 'text' }).toPromise().then((resolve) => {
      // Business logic to inject the API key is for you to fill in.
      googleMapsConfig.apiKey = resolve;
    }).catch((e) => {
      console.error(e)
    });
  }
}

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    BrowserAnimationsModule,
    MaterialModule,
    FlexLayoutModule,
    AgmCoreModule.forRoot({ apiKey: '' }),
    AgmMarkerClustererModule,
    AgmSnazzyInfoWindowModule
  ],
  providers: [
    {
      // APP_INITIALIZER is the Angular dependency injection token.
      provide: APP_INITIALIZER,
      // Pass in the AGM dependency injection token.
      deps: [LAZY_MAPS_API_CONFIG, HttpClient],
      // Allow for multiple startup injectors if needed.
      multi: true,
      // UseFactory provides Angular with the function to invoke.
      useFactory: (googleMapsConfig: LazyMapsAPILoaderConfigLiteral, http: HttpClient) => () => AppInitService.Init(googleMapsConfig, http)
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }