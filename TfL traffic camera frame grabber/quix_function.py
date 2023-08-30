import quixstreams as qx
import pandas as pd
import json
import time
import os
#import cv2
from dateutil import parser
# old

class QuixFunction:
    def __init__(self, stream_consumer: qx.StreamConsumer, stream_producer: qx.StreamProducer):
        self.stream_consumer = stream_consumer
        self.stream_producer = stream_producer
        self.frame_rate = int(os.environ["frame_rate"])

    # Callback triggered for each new event.
    def on_event_data_handler(self, stream_consumer: qx.StreamConsumer, data: qx.EventData):

        last_image_state = stream_consumer.get_scalar_state("last_image", lambda: None)
        
        camera = json.loads(data.value)
        camera_id = camera["id"]
        lon = float(camera["lon"])
        lat = float(camera["lat"])

        camera_video_feed = list(filter(lambda x: x["key"] == "videoUrl", camera["additionalProperties"]))[0]

        timestamp = parser.parse(camera_video_feed["modified"])

        if timestamp > last_image_state.value:

            print( timestamp)
            last_image_state.value = timestamp

        return

       

    # Callback triggered for each new parameter data.
    def on_dataframe_handler(self, stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
        print(df)

        # Here transform your data.

        self.stream_producer.timeseries.publish(df)