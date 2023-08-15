import quixstreams as qx
import os
import pandas as pd
import datetime


client = qx.QuixStreamingClient()

topic_consumer = client.get_topic_consumer(os.environ["input"], consumer_group = "empty-transformation")
topic_producer = client.get_topic_producer(os.environ["output"])

pd.set_option('display.max_columns', None)


def ts_to_date(ts):
    sec = ts / 1_000_000_000
    dt = datetime.datetime.utcfromtimestamp(sec)
    #print(dt)
    return dt


def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
    print(stream_consumer.stream_id)

    # Initialize counters
    vehicle_counts = {'car': 0, 'bus': 0, 'truck': 0, 'motorbike': 0}

    # Iterate through the DataFrame rows
    for index, row in df.iterrows():
        for vehicle_type in vehicle_counts:
            if row.get(vehicle_type, 0) > 0:
                vehicle_counts[vehicle_type] += 1

    total_vehicles = 0
    # Print the vehicle counts
    for vehicle_type, count in vehicle_counts.items():
        print(f"{vehicle_type.capitalize()} Count:", count)
        total_vehicles += count

    print(f'Total vehicles = {total_vehicles}')

def on_stream_received_handler(stream_consumer: qx.StreamConsumer):
    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


# subscribe to new streams being received
topic_consumer.on_stream_received = on_stream_received_handler

print("Listening to streams. Press CTRL-C to exit.")

# Handle termination signals and provide a graceful exit
qx.App.run()