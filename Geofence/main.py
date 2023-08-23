import quixstreams as qx
import os
import pandas as pd
import json

coords = os.environ["fence_coordinates"]
fence_coords = coords.split(',')
north = fence_coords[0]
south = fence_coords[1]
east = fence_coords[2]
west = fence_coords[3]


client = qx.QuixStreamingClient()

topic_consumer = client.get_topic_consumer(os.environ["input"], consumer_group = "geofence", 
                                            auto_offset_reset = qx.AutoOffsetReset.Latest)
topic_producer = client.get_topic_producer(os.environ["output"])

pd.set_option('display.max_columns', None)

def on_event_data_handler(self, stream_consumer: qx.StreamConsumer, data: qx.EventData):
    
    camera = json.loads(data.value)
    lon = float(camera["lon"])
    lat = float(camera["lat"])

    in_fence = (lon < east) & (lon > west) & (lat < north) & (lat > south)

    camera_id = camera["id"]

    if in_fence:
        topic_producer.get_or_create_stream(camera_id).events.add_timestamp_nanoseconds(data["Timestamp"]) \
            .add_value("camera", json.dumps(camera)) \
            .publish() 

def on_stream_received_handler(stream_consumer: qx.StreamConsumer):
    stream_consumer.events.on_data_received = on_event_data_handler


# subscribe to new streams being received
topic_consumer.on_stream_received = on_stream_received_handler

print("Listening to streams. Press CTRL-C to exit.")

# Handle termination signals and provide a graceful exit
qx.App.run()