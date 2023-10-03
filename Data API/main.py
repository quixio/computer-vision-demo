import quixstreams as qx
import pandas as pd
from flask import Flask, request, abort, send_file
from flask_cors import CORS
import os
from threading import Lock
import datetime
import json
import base64


# stores for various data needed for this API
detected_objects = {}
detected_objects_img = {}
vehicles = {}
max_vehicles = {}

# track which state objects have been loaded to prevent reloading
state_loaded = {
    'detected_objects': False,
    'detected_objects_img': False,
    'vehicles': False,
    'max_vehicles': False
}

mutex = Lock()

if not os.path.exists("state/camera_images"):
    os.makedirs("state/camera_images")

client = qx.QuixStreamingClient()

qx.Logging.update_factory(qx.LogLevel.Debug)

print("Opening input topic")
buffered_stream_data = client.get_topic_consumer(
    os.environ["buffered_stream"], 
    "data-api-v8",
    auto_offset_reset=qx.AutoOffsetReset.Earliest)


def load_state(state_object, in_memory_object_name):

    loaded_state = {}

    if state_object.value == {}:
        # it's ok if there is nothing to load
        print(f"No state loaded for {in_memory_object_name}")
    else:
        loaded_state = json.loads(state_object.value)
        print(f"State loaded for {in_memory_object_name}")

    state_loaded[in_memory_object_name] = True
    return loaded_state

def on_buffered_stream_received_handler(handler_stream_consumer: qx.StreamConsumer):
    def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
        global state_loaded
        global detected_objects_img
        global detected_objects
        global vehicles
        global max_vehicles

        with mutex:
            print(f"{str(datetime.datetime.utcnow())} Receiving buffered data {stream_consumer.stream_id}")

            if stream_consumer.stream_id == 'buffered_processed_images':
                print("Processing images")

                # get the appropriate values from state, return {} if not found
                detected_objects_state = stream_consumer.get_scalar_state("detected_objects", lambda: {})
                image_state = stream_consumer.get_scalar_state("detected_objects_images", lambda: {})

                for i, row in df.iterrows():

                    camera = row["TAG__camera"]

                    print(f"Data for {camera}")

                    # if state hasn't been loaded into local variables yet:
                    if not state_loaded["detected_objects"]:
                        # do it now!
                        detected_objects = load_state(detected_objects_state, "detected_objects")

                    if not state_loaded["detected_objects_img"]:
                        detected_objects_img = load_state(image_state, "detected_objects_img")

                    # update the local variable
                    # convert the image to base64 and string in readiness for json encoding
                    detected_objects_img[camera] = str(base64.b64encode(row["image"]), encoding = "utf_8")

                    # delete the image from the row
                    del row["image"]

                    # update the datetime with a readable datetime
                    row["datetime"] = str(datetime.datetime.fromtimestamp(row["timestamp"]/1000000000))

                    # store the updated row (aka with no image) the variable
                    # we don't want the image in these for performance reasons
                    detected_objects[camera] = row.to_dict()

                    # update state with the latest values
                    # update state with the latest values
                    detected_objects_state.value = json.dumps(detected_objects)
                    image_state.value = json.dumps(detected_objects_img)

                detected_objects_state.flush()
                image_state.flush()

            elif stream_consumer.stream_id == 'buffered_vehicle_counts':
                print("Processing vehicles")

                # get the appropriate value from state, return {} if not found
                vehicles_state = stream_consumer.get_scalar_state("vehicles", lambda: {})

                # if state hasn't been loaded into local variables yet:
                if not state_loaded["vehicles"]:
                    vehicles = load_state(vehicles_state, "vehicles")

                for i, row in df.iterrows():
                    camera = row["TAG__camera"]
                    # add this vehicle count to the dictionary
                    vehicles[camera] = row["vehicles"]

                # update the state for vehicles with the latest values
                vehicles_state.value = json.dumps(vehicles)
                vehicles_state.flush()

            elif stream_consumer.stream_id == 'buffered_max_vehicles':
                print("Processing max_vehicles")

                # get the appropriate value from state, return {} if not found
                max_vehicles_state = stream_consumer.get_scalar_state("max_vehicles", lambda: {})

                # if state hasn't been loaded into local variables yet:
                if not state_loaded["max_vehicles"]:
                    max_vehicles = load_state(max_vehicles_state, "max_vehicles")

                for i, row in df.iterrows():
                    camera = row["TAG__camera"]
                    max_vehicles[camera] = row["max_vehicles"]

                max_vehicles_state.value = json.dumps(max_vehicles)
                max_vehicles_state.flush()

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

# create the detected objects route
@app.route("/detected_objects")
def objects():
    with mutex:
        print("/detected_objects started")
        
        return detected_objects

# create the detected objects route for specific camera
@app.route("/detected_objects/<camera_id>")
def objects_for_cam(camera_id):
    with mutex:

        if camera_id in detected_objects_img:

            file_name = camera_id + ".png"

            if os.path.isfile(file_name):
                os.remove(file_name)

            with open(file_name, "wb") as fh:
                # images are loaded as strings because of being stored as json in state
                # we locate the utf-8 encoded byte string
                # convert to bytes, then base64 decode
                data = bytes(detected_objects_img[camera_id], encoding="utf-8")
                data = base64.b64decode(data)
                # finally, write the data to a file on disk
                fh.write(data)

            # and serve it to the caller
            return send_file(camera_id + ".png", mimetype='image/png')
        else:
            # if the camera is not in the detected objects image list, return not found (404)
            abort(404)
   
# create the vehicles route
@app.route("/vehicles")
def cam_vehicles():
    with mutex:
        return vehicles
    
# create the max_vehicles route
@app.route("/max_vehicles")
def maximum_vehicles():
    with mutex:
        return max_vehicles


if __name__ == "__main__":
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
