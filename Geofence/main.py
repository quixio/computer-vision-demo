import quixstreams as qx
import os
import pandas as pd
import json
import time


coords = os.environ["fence_coordinates"]
fence_coords = coords.split(',')
north = float(fence_coords[0])
south = float(fence_coords[1])
east = float(fence_coords[2])
west = float(fence_coords[3])

if north < south:
    print("North<South")

if east < west:
    print("East<West")



client = qx.QuixStreamingClient()

topic_consumer = client.get_topic_consumer(os.environ["input"], consumer_group = "geofence", 
                                            auto_offset_reset = qx.AutoOffsetReset.Latest)
topic_producer = client.get_topic_producer(os.environ["output"])

pd.set_option('display.max_columns', None)

def on_event_data_handler(stream_consumer: qx.StreamConsumer, data: qx.EventData):
    print("data")
    camera = json.loads(data.value)
    lon = float(camera["lon"])
    lat = float(camera["lat"])

    print("lt east {}", lat < east)
    print("lt west {}", lat > west)
    print("lt north {}", lon > north)
    print("lt south {}", lon < south)

    in_fence = (lon < east) & (lon > west) & (lat > north) & (lat < south)
    print(in_fence)
    camera_id = camera["id"]

    if in_fence:
        topic_producer.get_or_create_stream(camera_id).events.add_timestamp_nanoseconds(time.time_ns()) \
            .add_value("camera", json.dumps(camera)) \
            .publish() 

def on_stream_received_handler(stream_consumer: qx.StreamConsumer):
    stream_consumer.events.on_data_received = on_event_data_handler


# subscribe to new streams being received
topic_consumer.on_stream_received = on_stream_received_handler

print("Listening to streams. Press CTRL-C to exit.")

# Handle termination signals and provide a graceful exit
qx.App.run()