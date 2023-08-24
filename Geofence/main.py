import quixstreams as qx
import os
import pandas as pd
import json
import time
from shapely.geometry import Point, Polygon
import ast

# setup camera coordinates and fence area
coords = os.environ["fence_coordinates"]
area_of_interest = ast.literal_eval(coords)
print(f"Area of interest = {area_of_interest}")
area_of_interest_polygon = Polygon(area_of_interest)

# create the QuixStreamingClient
client = qx.QuixStreamingClient()

topic_consumer = client.get_topic_consumer(os.environ["input"], consumer_group = "geofence", 
                                            auto_offset_reset = qx.AutoOffsetReset.Latest)
topic_producer = client.get_topic_producer(os.environ["output"])

pd.set_option('display.max_columns', None)

def on_event_data_handler(stream_consumer: qx.StreamConsumer, data: qx.EventData):
    camera = json.loads(data.value)
    lon = float(camera["lon"])
    lat = float(camera["lat"])

    # is the camera online?
    props = camera['additionalProperties'][0]
    print(f"{camera['id']} - {props['key']}={props['value']}")

    if props['value']:
        # check the ONLINE cameras position.
        camera_position = Point(lon, lat)
        in_fence = area_of_interest_polygon.contains(camera_position)

        # if it is inside the area of interest.
        # publish it to the producer topic.
        if in_fence:
            print(f"Camera is inside the geofence? = {in_fence}")
    
            camera_id = camera["id"]

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