import quixstreams as qx
import os
import pandas as pd
import json


client = qx.QuixStreamingClient()

topic_consumer = client.get_topic_consumer(os.environ["input"], consumer_group = "geofence", 
                                            auto_offset_reset = qx.AutoOffsetReset.Latest)
topic_producer = client.get_topic_producer(os.environ["output"])

pd.set_option('display.max_columns', None)

def on_event_data_handler(self, stream_consumer: qx.StreamConsumer, data: qx.EventData):
    
    camera = json.loads(data.value)
    lon = float(camera["lon"])
    lat = float(camera["lat"])

def on_stream_received_handler(stream_consumer: qx.StreamConsumer):
    stream_consumer.events.on_data_received = on_event_data_handler


# subscribe to new streams being received
topic_consumer.on_stream_received = on_stream_received_handler

print("Listening to streams. Press CTRL-C to exit.")

# Handle termination signals and provide a graceful exit
qx.App.run()