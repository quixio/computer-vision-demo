# Data API

This Data API allows the UI to instantly obtain data for all of the traffic cameras in London.
It is used to prime the UI with the most recent data rather than waiting for data from each camera to flow through the pipeline.

There are 2 endpoints:

 - `max_vehicles` - A rolling 24-hour window of the maximum number of vehicles seen on a given traffic camera.
 - `detected_objects` - The latest detected object counts for each camera.
 - `vehicles` - Latest vehicle counts from each camera, vehicles are defines in a previous stage. e.g. cars, busses, trucks and motorbikes.

The API is written in Python and uses Flask and [Waitress](https://flask.palletsprojects.com/en/2.3.x/deploying/waitress/).

## Environment variables

This code sample uses the following environment variables:

- **input**: The topic containing maximum vehicle counts.
- **objects**: The topic containing detected objects.
- **vehicles**: The topic containing an aggregated count of vehicles.

## Open source

This project is open source under the Apache 2.0 license and available in our [GitHub](https://github.com/quixio/quix-samples) repo.

Please star us and mention us on social to show your appreciation.
