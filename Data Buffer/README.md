# Data buffer

The data buffer was conceived to reduce the load on the Data API by buffering the data from three topics for one second.

Without this buffer, the Data API could become unresponsive due to the amount of data being received.

## Environment variables

The code sample uses the following environment variables:

- **max_vehicles**: The topic with maxiumum vehicle counts.
- **processed_images**: The topic with output from the computer vision object detection service.
- **vehicle_counts**: The topic with calculated vehicle counts.
- **buffered_stream**: The the single, buffered output topic. Contains one stream for each of the input topics.

## Open source

This project is open source under the Apache 2.0 license and available in our [GitHub](https://github.com/quixio/quix-samples) repo.

Please star us and mention us on social to show your appreciation.
