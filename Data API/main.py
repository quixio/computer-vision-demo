import quixstreams as qx
import pandas as pd
from flask import Flask, request, abort, send_file
from flask_cors import CORS
import os
import copy
from threading import Lock
import datetime

mutex = Lock()

if not os.path.exists("state/camera_images"):
    os.makedirs("state/camera_images")

# if not os.path.exists("images"):
#     os.makedirs("images")

# probably not thread safe, but anyway we already have a mutext everywhere
# also we will lose data on restart
detected_objects = {}
detected_objects_img = {}
vehicles = {}
max_vehicles = {}

# Quix injects credentials automatically to the client.
# Alternatively, you can always pass an SDK token manually as an argument.
client = qx.QuixStreamingClient()

qx.Logging.update_factory(qx.LogLevel.Debug)

print("Opening input topic")
buffered_stream_data = client.get_topic_consumer(
    os.environ["buffered_stream"], 
    "data-api-tabicon",
    auto_offset_reset=qx.AutoOffsetReset.Earliest)


def on_buffered_stream_received_handler(handler_stream_consumer: qx.StreamConsumer):
    def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
        with mutex:
            print(f"{str(datetime.datetime.utcnow())} Receiving buffered data {stream_consumer.stream_id}")

            if stream_consumer.stream_id == 'buffered_processed_images':
                    print("Processing images")

                    #state = stream_consumer.get_dict_state("detected_objects", lambda: 0)
                    #image_state = stream_consumer.get_dict_state("detected_objects_images", lambda: 0)

                    for i, row in df.iterrows():

                        camera = row["TAG__camera"]

                        print(f"Data for {camera}")

                        #image_state[camera] = row["image"]
                        detected_objects_img[camera] = row["image"]
                        del row["image"]

                        #print(f"{i} -- {row}")

                        row["datetime"] = str(datetime.datetime.fromtimestamp(row["timestamp"]/1000000000))

                        #state[camera] = row.to_dict()
                        detected_objects[camera] = row.to_dict()

                        #print(state[camera])

            elif stream_consumer.stream_id == 'buffered_vehicle_counts':
                print("Processing vehicles")

                #state = stream_consumer.get_dict_state("vehicles", lambda: 0)

                for i, row in df.iterrows():
                    camera = row["TAG__camera"]
                    #state[camera] = row["vehicles"]
                    vehicles[camera] = row["vehicles"]


            elif stream_consumer.stream_id == 'buffered_max_vehicles':
                print("Processing max_vehicles")

                #state = stream_consumer.get_dict_state("max_vehicles", lambda: 0)

                for i, row in df.iterrows():
                    camera = row["TAG__camera"]
                    #state[camera] = row["max_vehicles"]
                    max_vehicles[camera] = row["max_vehicles"]

            else:
                print("Ignoring unknown Stream Id.")

            print(f"{str(datetime.datetime.utcnow())} Processed buffered data {stream_consumer.stream_id}")



    handler_stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


# init the flask app
app = Flask(__name__, static_url_path='/static')
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
           f"<br/><a href='{root}vehicles'>{root}vehicles</a>"\
           f"<br/><a href='{root}all'>{root}all</a>"

# create the max_vehicles route
@app.route("/max_vehicles")
def maximum_vehicles():
    with mutex:
        # get the state manager for the topic
        #state_manager = buffered_stream_data.get_state_manager()

        result = {}

        #for cam in state_manager.get_stream_state_manager("buffered_max_vehicles").get_dict_state("max_vehicles").items():
        #    result[cam[0]] = cam[1]

        for cam in max_vehicles:
            result[cam] = max_vehicles[cam]

        return result

@app.route("/all")
def all():
    result = ""
    state_objects_copy = copy.deepcopy(detected_objects)
    for camera_id in state_objects_copy:
        file_name = "static/" + camera_id + ".png"
        if os.path.isfile(file_name):
            os.remove(file_name)
        with open(file_name, "wb") as fh:
            fh.write(detected_objects_img[camera_id])

        result = result + f"{camera_id}<br/>Our DateTime={state_objects_copy[camera_id]['datetime']}<br/><img src='{file_name}'><br/><br/>"

        #result[camera_id] = state_objects_copy[camera_id]

    return result

# @app.route("/test/<camera_id>")
# def test():
#
#     if camera_id in image_state:
#         fileName = camera_id + ".png"
#         if os.path.isfile(fileName):
#             os.remove(fileName)
#
#         with open(fileName, "wb") as fh:
#             fh.write(state_objects[camera_id])
#             return send_file(camera_id + ".png", mimetype='image/png')

# create the detected objects route
@app.route("/detected_objects")
def objects():
    with mutex:
        print("/detected_objects started")
        # get the state manager for the topic
        #state_manager = buffered_stream_data.get_state_manager()

        result = {}
        # for each stream, get the items of interest
        #state_objects = state_manager.get_stream_state_manager("buffered_processed_images").get_dict_state("detected_objects")
        #state_objects_copy = copy.deepcopy(state_objects.items())
        state_objects_copy = copy.deepcopy(detected_objects)

        # remove any images, we don't want them here
        #for _, val in state_objects_copy:
        #    val.pop('image', None)

        for a in state_objects_copy:
            print(a)
            result[a] = state_objects_copy[a]

        #for i, row in state_objects_copy:
        #    result[i] = row

        return result


# create the detected objects route for specific camera
@app.route("/detected_objects/<camera_id>")
def objects_for_cam(camera_id):
    with mutex:
        #state_manager = buffered_stream_data.get_state_manager()

        #state_objects = state_manager.get_stream_state_manager("buffered_processed_images").get_dict_state("detected_objects_images")

        state_objects = detected_objects_img

        if camera_id in state_objects:

            fileName = camera_id + ".png"

            if os.path.isfile(fileName):
                os.remove(fileName)

            with open(fileName, "wb") as fh:
                fh.write(state_objects[camera_id])
            return send_file(camera_id + ".png", mimetype='image/png')
        else:
            abort(404)

# create the vehicles route
@app.route("/vehicles")
def cam_vehicles():
    with mutex:
        #state_manager = buffered_stream_data.get_state_manager()

        result = {}

        #for cam in state_manager.get_stream_state_manager("buffered_vehicle_counts").get_dict_state("vehicles").items():
        #    result[cam[0]] = cam[1]

        for cam in vehicles:
            result[cam] = vehicles[cam]

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
