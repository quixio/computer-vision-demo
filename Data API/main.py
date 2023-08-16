import quixstreams as qx
import pandas as pd
from flask import Flask
import os

pd.set_option('display.max_columns', None)

max_vehicles = {}

# init the flas app
app = Flask(__name__)


# Quix injects credentials automatically to the client.
# Alternatively, you can always pass an SDK token manually as an argument.
client = qx.QuixStreamingClient()

print("Opening input topic")
consumer_topic = client.get_topic_consumer(os.environ["input"])


def on_stream_received_handler(stream_consumer: qx.StreamConsumer):
    global max_vehicles

    def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
        print(f'stream:{stream_consumer.stream_id}, data={df["max_vehicles"][0]}')
        max_vehicles[stream_consumer.stream_id] = df["max_vehicles"][0]
    
    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


@app.route("/")
def index():
    return "hello"

@app.route("/max_vehicles")
def maximum_vehicles():
    return max_vehicles

if __name__ == "__main__":
    print("main..")
    from waitress import serve

    # hook up the stream received handler
    consumer_topic.on_stream_received = on_stream_received_handler
    # subscribe to data arriving into the topic
    consumer_topic.subscribe()

    # you can use app.run for dev, but its not secure, stable or particularly efficient
    # app.run(debug=True, host="0.0.0.0", port=80)

    # use waitress instead for production
    serve(app, host="0.0.0.0", port=81)