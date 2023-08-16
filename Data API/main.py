import quixstreams as qx
import pandas as pd
from flask import Flask
import os

pd.set_option('display.max_columns', None)

# keep the max vehicles for each cam
max_vehicles = {}
#keep the latest detected objects for each cam
detected_objects = {}

# if max_vehicles is in state, init the property with it
if storage.contains_key("max_vehicles"):
    max_vehicles = storage.get("max_vehicles")
    print("max_vehicles loaded from state")

# if detected_objects is in state, init the property with it
if storage.contains_key("detected_objects"):
    detected_objects = storage.get("detected_objects")
    print("detected_objects loaded from state")

# Quix injects credentials automatically to the client.
# Alternatively, you can always pass an SDK token manually as an argument.
client = qx.QuixStreamingClient()

# get a state manager from the Quix client library
storage = qx.LocalFileStorage()

print("Opening input topic")
max_veh_topic = client.get_topic_consumer(os.environ["input"])
object_topic = client.get_topic_consumer(os.environ["objects"])

def on_max_veh_stream_received_handler(stream_consumer: qx.StreamConsumer):
    global max_vehicles

    def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
        print(f'MAX_VEHICLES: stream:{stream_consumer.stream_id}, data={df["max_vehicles"][0]}')
        max_vehicles[stream_consumer.stream_id] = df["max_vehicles"][0]
        storage.set("max_vehicles", max_vehicles)
    
    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler

def on_object_stream_received_handler(stream_consumer: qx.StreamConsumer):
    global detected_objects

    def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
        df["image"] = '' # we dont need the image for this
        print(f'OBJECT DETECTED: stream:{stream_consumer.stream_id}, data={df.to_dict()}')
        detected_objects[stream_consumer.stream_id] = df.to_dict()
        storage.set("detected_objects", detected_objects)
        
    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler

# init the flas app
app = Flask(__name__)

# create the default route
@app.route("/")
def index():
    return "hello"

# create the max_vehicles route
@app.route("/max_vehicles")
def maximum_vehicles():
    return max_vehicles

# create the detected objects route
@app.route("/detected_objects")
def objects():
    return detected_objects

if __name__ == "__main__":
    print("main..")
    from waitress import serve

    # hook up the stream received handler
    max_veh_topic.on_stream_received = on_max_veh_stream_received_handler
    # subscribe to data arriving into the topic
    max_veh_topic.subscribe()

    # hook up the stream received handler
    object_topic.on_stream_received = on_object_stream_received_handler
    # subscribe to data arriving into the topic
    object_topic.subscribe()

    # you can use app.run for dev, but its not secure, stable or particularly efficient
    # app.run(debug=True, host="0.0.0.0", port=80)

    # use waitress instead for production
    serve(app, host="0.0.0.0", port=80)