import quixstreams as qx
import pandas as pd
import json
import time
import os
import cv2
from dateutil import parser
# old

class QuixFunction:
    def __init__(self, stream_consumer: qx.StreamConsumer, stream_producer: qx.StreamProducer):
        self.stream_consumer = stream_consumer
        self.stream_producer = stream_producer
        self.frame_rate = int(os.environ["frame_rate"])

    # Callback triggered for each new event.
    def on_event_data_handler(self, stream_consumer: qx.StreamConsumer, data: qx.EventData):

        last_image_state = stream_consumer.get_scalar_state("last_image_v1", lambda: None)
        
        camera = json.loads(data.value)
        camera_id = camera["id"]
        lon = float(camera["lon"])
        lat = float(camera["lat"])

        camera_video_feed = list(filter(lambda x: x["key"] == "videoUrl", camera["additionalProperties"]))[0]

        timestamp = data.timestamp

        if last_image_state.value is None or timestamp > last_image_state.value:
            print(stream_consumer.stream_id + " updated.")
            last_image_state.value = timestamp
        else:
            print("{0} from {1} has been processed. Skipping...".format(camera_video_feed["value"], timestamp))
            return

        video_stream = cv2.VideoCapture(camera_video_feed["value"])

        count = 0

        success, image = video_stream.read()
        while success:
            frame = cv2.imencode('.jpg', image)
            if len(frame) <= 1:
                print("no data")
                continue
            
            frame_bytes = frame[1]

            success, image = video_stream.read()
            count += 1

            if (count - 1) % self.frame_rate == 0:
                self.stream_producer.timeseries.buffer.add_timestamp(timestamp) \
                    .add_value("image", bytearray(frame_bytes)) \
                    .add_value("lon", lon) \
                    .add_value("lat", lat) \
                    .publish()
                    
                print("Sent {0} frame {1}".format(camera_id, count))



       

    # Callback triggered for each new parameter data.
    def on_dataframe_handler(self, stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
        print(df)

        # Here transform your data.

        self.stream_producer.timeseries.publish(df)