import quixstreams as qx
import pandas as pd
from flask import Flask, request, abort
from flask_cors import CORS
import os
import base64
import copy


pd.set_option('display.max_columns', None)


print("Checking state for previous values..")

# Quix injects credentials automatically to the client.
# Alternatively, you can always pass an SDK token manually as an argument.
client = qx.QuixStreamingClient()

print("Opening input topic")
max_veh_topic = client.get_topic_consumer(os.environ["input"])
object_topic = client.get_topic_consumer(os.environ["objects"])
veh_topic = client.get_topic_consumer(os.environ["vehicles"])


def on_max_veh_stream_received_handler(stream_consumer: qx.StreamConsumer):

    def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
        print("Receiving max vehicle data")

        state = stream_consumer.get_scalar_state("max_vehicles", lambda : 0)

        #print(f'MAX_VEHICLES: stream:{stream_consumer.stream_id}, data={df["max_vehicles"][0]}')
        state[stream_consumer.stream_id] = df["max_vehicles"][0]
    
    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler

def on_object_stream_received_handler(stream_consumer: qx.StreamConsumer):
    global detected_objects
    encoding = 'utf-8'

    def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
        print("Receiving detected object data")

        base64_bytes = base64.b64encode(df["image"][0])
        base64_string = base64_bytes.decode(encoding)

        df["image"] = base64_string

        #print(f'OBJECT DETECTED: stream:{stream_consumer.stream_id}, data={df.to_dict()}')
        detected_objects[stream_consumer.stream_id] = df.to_dict("records")[0]

        storage.set("detected_objects", detected_objects)
        
    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


def on_vehicles_stream_received_handler(stream_consumer: qx.StreamConsumer):
    global vehicles

    def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
        print("Receiving vehicles data")
        # keep only the timestamp and vehicle count.
        df = df[['timestamp', 'vehicles']]

        print(f'VEHICLES: stream:{stream_consumer.stream_id}, data={df.to_dict("records")[0]}')
        vehicles[stream_consumer.stream_id] = df.to_dict('records')[0]
        storage.set("vehicles", vehicles)

    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


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
    state_manager = max_veh_topic.get_state_manager()
    stream_ids = state_manager.get_stream_states()
    result = {}
    for stream_id in stream_ids:
        result[stream_id] = state_manager.get_stream_state_manager(stream_id).get_scalar_state("max_vehicles")

    return result

# create the detected objects route
@app.route("/detected_objects")
def objects():
    o = copy.deepcopy(detected_objects)
    for _, val in o.items():
        val.pop('image', None)
    return o

# create the detected objects route for specific camera
@app.route("/detected_objects/<camera_id>")
def objects_for_cam(camera_id):
    print(camera_id)
    if camera_id in detected_objects:
        return detected_objects[camera_id]
    else:
        abort(404)

# create the vehicles route
@app.route("/vehicles")
def cam_vehicles():
    return vehicles


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
