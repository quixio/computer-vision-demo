import quixstreams as qx
import pandas as pd
from flask import Flask, request, abort
from flask_cors import CORS
import os
import base64
import copy
from threading import Thread, Lock
import datetime

mutex = Lock()



# Quix injects credentials automatically to the client.
# Alternatively, you can always pass an SDK token manually as an argument.
client = qx.QuixStreamingClient()

qx.Logging.update_factory(qx.LogLevel.Debug)

print("Opening input topic")
buffered_stream_data = client.get_topic_consumer(
    os.environ["buffered_stream"], 
    "data-api-v5", 
    auto_offset_reset=qx.AutoOffsetReset.Earliest)


def on_buffered_stream_received_handler(handler_stream_consumer: qx.StreamConsumer):
    def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
        with mutex:
            print(f"{str(datetime.datetime.utcnow())} Receiving buffered data {stream_consumer.stream_id}")

            if stream_consumer.stream_id == 'buffered_processed_images':
                    print("Processing images")

                    encoding = 'utf-8'

                    state = stream_consumer.get_dict_state("detected_objects", lambda: 0)

                    for i, row in df.iterrows():

                        camera = row["TAG__camera"]


                        base64_bytes = base64.b64encode(row["image"])

                        with open("state/camera_images/" + camera + ".png", "wb") as fh:
                            fh.write(base64_bytes)

                        del df["image"]

                        #print(f"{i} -- {row}")

                        state[camera] = row.to_dict()
                        #print(state[camera])

            elif stream_consumer.stream_id == 'buffered_vehicle_counts':
                print("Processing vehicles")

                state = stream_consumer.get_dict_state("vehicles", lambda: 0)

                for i, row in df.iterrows():
                    camera = row["TAG__camera"]
                    state[camera] = row["vehicles"]

            elif stream_consumer.stream_id == 'buffered_max_vehicles':
                print("Processing max_vehicles")

                state = stream_consumer.get_dict_state("max_vehicles", lambda: 0)

                for i, row in df.iterrows():
                    camera = row["TAG__camera"]
                    state[camera] = row["max_vehicles"]

            else:
                print("Ignoring unknown Stream Id.")

            print(f"{str(datetime.datetime.utcnow())} Processed buffered data {stream_consumer.stream_id}")



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
    with mutex:
        # get the state manager for the topic
        state_manager = buffered_stream_data.get_state_manager()

        result = {}

        for cam in state_manager.get_stream_state_manager("buffered_max_vehicles").get_dict_state("max_vehicles").items():
            result[cam[0]] = cam[1]

        return result

# create the detected objects route
@app.route("/detected_objects")
def objects():
    with mutex:
        print("/detected_objects started")
        # get the state manager for the topic
        state_manager = buffered_stream_data.get_state_manager()

        result = {}
        # for each stream, get the items of interest
        state_objects = state_manager.get_stream_state_manager("buffered_processed_images").get_dict_state("detected_objects")
        state_objects_copy = copy.deepcopy(state_objects.items())

        # remove any images, we don't want them here
        for _, val in state_objects_copy:
            val.pop('image', None)

        for i, row in state_objects_copy:
            result[i] = row

        return result

# create the detected objects route for specific camera
@app.route("/detected_objects/<camera_id>")
def objects_for_cam(camera_id):
    with mutex:
        # get the state manager for the topic
        state_manager = buffered_stream_data.get_state_manager()

        # for each stream, get the items of interest
        state_objects = state_manager.get_stream_state_manager("buffered_processed_images").get_dict_state("detected_objects")
        #state_objects_copy = copy.deepcopy(state_objects.items())

        # there should be only one (1) row per camera. But just in case, loop through and add any that are there.
        for idx, row in state_objects:
            if idx == camera_id:
                return row

        abort(404)

# create the vehicles route
@app.route("/vehicles")
def cam_vehicles():
    with mutex:
        state_manager = buffered_stream_data.get_state_manager()

        result = {}

        for cam in state_manager.get_stream_state_manager("buffered_vehicle_counts").get_dict_state("vehicles").items():
            result[cam[0]] = cam[1]

        return result


if __name__ == "__main__":
    print("main..")
    from waitress import serve

    # hook up the stream received handler
    buffered_stream_data.on_stream_received = on_buffered_stream_received_handler
    
    def on_committing(stream_consumer):
        mutex.acquire()
        print(f"{str(datetime.datetime.utcnow())} on_committing")

    def on_committed(stream_consumer):
        mutex.release()
        print(f"{str(datetime.datetime.utcnow())} on_committed")


    buffered_stream_data.on_committing = on_committing
    buffered_stream_data.on_committed = on_committed
    # subscribe to data arriving into the topic
    buffered_stream_data.subscribe()

    # you can use app.run for dev, but it's not secure, stable or particularly efficient
    # app.run(debug=True, host="0.0.0.0", port=80)

    # use waitress instead for production
    serve(app, host="0.0.0.0", port=80)
