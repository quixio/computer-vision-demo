import quixstreams as qx
import pandas as pd
from flask import Flask, request, abort, send_file
from flask_cors import CORS
import os
import base64
import copy
from threading import Thread, Lock
import datetime


# Quix injects credentials automatically to the client.
# Alternatively, you can always pass an SDK token manually as an argument.
client = qx.QuixStreamingClient()

qx.Logging.update_factory(qx.LogLevel.Debug)

print("Opening input topic")
buffered_stream_data = client.get_topic_consumer(
    os.environ["input"],
    "temp-api-v1",
    auto_offset_reset=qx.AutoOffsetReset.Earliest)

image_state = {}

def on_buffered_stream_received_handler(handler_stream_consumer: qx.StreamConsumer):
    def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
    
        print(f"{str(datetime.datetime.utcnow())} Receiving data {stream_consumer.stream_id}")

        #if stream_consumer.stream_id == 'buffered_processed_images':
        print("Processing images")
        #state = stream_consumer.get_dict_state("detected_objects", lambda: 0)
        #image_state = stream_consumer.get_dict_state("detected_objects_images", lambda: 0)
        
        for i, row in df.iterrows():
        
            camera = stream_consumer.stream_id

            print(f"Data for {camera}")
        
            image_state[camera].image = row["image"]
            image_state[camera].ts = row["timestamp"]

        
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
           f"<br/><a href='{root}test'>{root}test</a>"

# create the vehicles route
@app.route("/test/<camera_id>")
def test(camera_id):

    output = ""

    if camera_id in image_state:
        fileName = camera_id + ".png"
        if os.path.isfile(fileName):
            os.remove(fileName)

        with open(fileName, "wb") as fh:
            fh.write(image_state[camera_id])
            return send_file(camera_id + ".png", mimetype='image/png')

    return "Not found"


if __name__ == "__main__":
    print("main..")
    from waitress import serve

    # hook up the stream received handler
    buffered_stream_data.on_stream_received = on_buffered_stream_received_handler
    
    def on_committing(stream_consumer):
        print(f"{str(datetime.datetime.utcnow())} on_committing")

    def on_committed(stream_consumer):
        print(f"{str(datetime.datetime.utcnow())} on_committed")


    buffered_stream_data.on_committing = on_committing
    buffered_stream_data.on_committed = on_committed
    # subscribe to data arriving into the topic
    buffered_stream_data.subscribe()

    # you can use app.run for dev, but it's not secure, stable or particularly efficient
    # app.run(debug=True, host="0.0.0.0", port=80)

    # use waitress instead for production
    serve(app, host="0.0.0.0", port=80)
