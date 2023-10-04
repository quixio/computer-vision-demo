import { AgmCoreModule, LAZY_MAPS_API_CONFIG, LazyMapsAPILoaderConfigLiteral } from '@agm/core';
import { AgmMarkerClustererModule } from '@agm/markerclusterer';
import { AgmSnazzyInfoWindowModule } from '@agm/snazzy-info-window';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule } from "@angular/forms";
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { MaterialModule } from './material.module';
import { AppInitService } from './services/app-init.service';

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