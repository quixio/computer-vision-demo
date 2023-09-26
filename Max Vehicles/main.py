import quixstreams as qx
import os
import pandas as pd
from datetime import datetime, timedelta


storage = qx.LocalFileStorage()

client = qx.QuixStreamingClient()

topic_consumer = client.get_topic_consumer(os.environ["input"], consumer_group="max-vehicles-v1",
                                           auto_offset_reset=qx.AutoOffsetReset.Earliest)
topic_producer = client.get_topic_producer(os.environ["output"])

pd.set_option('display.max_columns', None)


# Define a function to calculate the maximum vehicles seen over the last 24 hours
def calculate_max_vehicles(stream_data):
    max_vehicles = 0

    # calculate the start of the window
    start_time = datetime.utcnow() - timedelta(hours=24)

    # remove any entries with a date more than 24 hours in the past
    filtered = []
    for item in stream_data["count"]:
        if item[0] > start_time:
            filtered.append(item)

    # store the newly cleaned data in state
    stream_data["count"] = filtered

    # determine the max vehicles in the last 24 hours
    for _, vehicles in stream_data["count"]:
        max_vehicles = max(max_vehicles, vehicles)

    return max_vehicles


def process_max_window_data(stream_consumer, new_data_frame):
    stream_id = stream_consumer.stream_id
    stream_data = stream_consumer.get_dict_state("data", lambda missing_key: [])

    for i, dataframe in new_data_frame.iterrows():
        timestamp = datetime.utcfromtimestamp(dataframe["timestamp"] / 1e9)  # Convert timestamp to datetime
        num_vehicles = dataframe["vehicles"]

        stream_data["count"].append((timestamp, num_vehicles))

        # Calculate and print the maximum vehicles seen over the last 24 hours for the stream
        max_vehicles = calculate_max_vehicles(stream_data)
        
        print(f"{str(timestamp)}:{stream_id}: Maximum vehicles in the last 24 hours: {max_vehicles}")

        data = {'timestamp': datetime.utcnow(),
                'max_vehicles': [max_vehicles],
                'TAG__cam': stream_id}
        df2 = pd.DataFrame(data)

        stream_producer = topic_producer.get_or_create_stream(stream_id=stream_id)
        stream_producer.timeseries.buffer.publish(df2)


def on_stream_received_handler(outer_stream_consumer: qx.StreamConsumer):
    def on_dataframe_received_handler(inner_stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
        #print(inner_stream_consumer.stream_id)
        process_max_window_data(inner_stream_consumer, df)

    outer_stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


# subscribe to new streams being received
topic_consumer.on_stream_received = on_stream_received_handler

print("Listening to streams. Press CTRL-C to exit.")

def before_shutdown():
    topic_producer.flush()
    topic_producer.dispose()
    topic_consumer.dispose()


# Handle termination signals and provide a graceful exit
qx.App.run(before_shutdown=before_shutdown)
