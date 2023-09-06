import quixstreams as qx
import pandas as pd
from flask import Flask, request, abort
from flask_cors import CORS
import os
import base64
import json
import copy


# Quix injects credentials automatically to the client.
# Alternatively, you can always pass an SDK token manually as an argument.
client = qx.QuixStreamingClient()

print("Opening input topic")
max_veh_topic = client.get_topic_consumer(os.environ["input"])
object_topic = client.get_topic_consumer(os.environ["objects"])
veh_topic = client.get_topic_consumer(os.environ["vehicles"])


def on_max_veh_stream_received_handler(handler_stream_consumer: qx.StreamConsumer):

    def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
        print(f"Receiving max vehicle data {stream_consumer.stream_id}")

        state = stream_consumer.get_dict_state("max_vehicles", lambda: 0)
        state[stream_consumer.stream_id] = df["max_vehicles"][0]
    
    handler_stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler

def on_object_stream_received_handler(handler_stream_consumer: qx.StreamConsumer):
    encoding = 'utf-8'

    def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
        print(f"Receiving detected object data for {stream_consumer.stream_id}")

        base64_bytes = base64.b64encode(df["image"][0])
        base64_string = base64_bytes.decode(encoding)

        df["image"] = base64_string

        state = stream_consumer.get_dict_state("detected_objects", lambda: 0)
        state[stream_consumer.stream_id] = df.to_dict("records")[0]

        print(f"detected_objects::Stream Id={stream_consumer.stream_id}")

    handler_stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


def on_vehicles_stream_received_handler(handler_stream_consumer: qx.StreamConsumer):

    def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
        print(f"Receiving vehicles data for {stream_consumer.stream_id}")

        # keep only the timestamp and vehicle count.
        df = df[['timestamp', 'vehicles']]

        state = stream_consumer.get_dict_state("vehicles", lambda: 0)
        state[stream_consumer.stream_id] = df.to_dict("records")[0]

    handler_stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


# init the flask app
app = Flask(__name__)
CORS(app)

# create the default route
@app.route("/")
def index():
    root = request.url_root
    print(root)
    return f"Endpoints are:" \
           f"<br/><a href='{root}detected_objects'>{root}detected_objects (without images)</a>" \
           f"<br/><a href='{root}detected_objects/[camera_id]'>{root}detected_objects/[camera_id] (with images)</a>" \
           f"<br/><a href='{root}max_vehicles'>{root}max_vehicles</a>" \
           f"<br/><a href='{root}vehicles'>{root}vehicles</a>"

# create the max_vehicles route
@app.route("/max_vehicles")
def maximum_vehicles():
    # get the state manager for the topic
    state_manager = max_veh_topic.get_state_manager()
    # get the stream states
    stream_ids = state_manager.get_stream_states()
    result = {}
    # for each stream, get the items of interest
    for stream_id in stream_ids:
        if state_manager.get_stream_state_manager(stream_id).get_dict_state("max_vehicles").items():
            result[stream_id] = state_manager.get_stream_state_manager(stream_id).get_dict_state("max_vehicles").items()[0][1]

    return result

# create the detected objects route
@app.route("/detected_objects")
def objects():
    # get the state manager for the topic
    state_manager = object_topic.get_state_manager()
    # get the stream states
    stream_ids = state_manager.get_stream_states()

    result = {}
    # for each stream, get the items of interest
    for stream_id in stream_ids:
        state_objects = state_manager.get_stream_state_manager(stream_id).get_dict_state("detected_objects")
        state_objects_copy = copy.deepcopy(state_objects.items())

        # remove any images, we don't want them here
        for _, val in state_objects_copy:
            val.pop('image', None)
        result[stream_id] = state_objects_copy

    return result

# create the detected objects route for specific camera
@app.route("/detected_objects/<camera_id>")
def objects_for_cam(camera_id):

    # get the state manager for the topic
    state_manager = object_topic.get_state_manager()

    # get the stream state using the camera id as the stream id
    state_vehicle_counts = state_manager.get_stream_state_manager(camera_id).get_dict_state("detected_objects").items()
    print("streamID=" + camera_id + f"{state_vehicle_counts}")

    # if the camera in question is in this state and has a row
    if len(state_vehicle_counts) > 0:
        # return it to the caller
        return json.dumps(state_vehicle_counts[0][1])

    # else: camera not found in any stream state, 404
    abort(404)

# create the vehicles route
@app.route("/vehicles")
def cam_vehicles():
    state_manager = veh_topic.get_state_manager()
    stream_ids = state_manager.get_stream_states()

    result = {}
    # for each stream state:
    for stream_id in stream_ids:
        # get the vehicle count
        state_vehicle_counts = state_manager.get_stream_state_manager(stream_id).get_dict_state("vehicles").items()
        result[stream_id] = state_vehicle_counts

    return result


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

    # hook up the stream received handler
    veh_topic.on_stream_received = on_vehicles_stream_received_handler
    # subscribe to data arriving into the topic
    veh_topic.subscribe()

    # you can use app.run for dev, but it's not secure, stable or particularly efficient
    # app.run(debug=True, host="0.0.0.0", port=80)

    # use waitress instead for production
    serve(app, host="0.0.0.0", port=80)
