import quixstreams as qx
import os
import pandas as pd
import time
from io import StringIO


client = qx.QuixStreamingClient()

topic_consumer = client.get_topic_consumer(os.environ["input"], consumer_group = "empty-transformation")
topic_producer = client.get_topic_producer(os.environ["output"])

pd.set_option('display.max_columns', None)

# Initialize an empty DataFrame to store the data
data = pd.DataFrame(columns=['timestamp', 'lat', 'lon', 'car'])


import pandas as pd
import datetime


incoming_dataframes = [
    pd.DataFrame([{'timestamp': 1692095584000000000, 'vehicles': 1.0, 'lat': 51.5143, 'lon': -0.02834}]),
    pd.DataFrame([{'timestamp': 1692023584000000000, 'vehicles': 2.0, 'lat': 51.5143, 'lon': -0.02834}, 
                  {'timestamp': 1691994784000000000, 'vehicles': 22.0, 'lat': 51.5143, 'lon': -0.02834}]),
    pd.DataFrame([{'timestamp': 1692001984000000000, 'vehicles': 3.0, 'lat': 51.5143, 'lon': -0.02834}]),
]


window_data = {}

start_of_window = None
end_of_window = None
window_length_days = 2

def update_window():
    global end_of_window
    global start_of_window

    end_of_window = datetime.datetime.utcnow()
    start_of_window = end_of_window - datetime.timedelta(days = 2)


def ts_to_date(ts):
    sec = ts / 1_000_000_000
    dt = datetime.datetime.utcfromtimestamp(sec)
    print(dt)
    return dt


def process_data():
    global window_data

    for new_data_frame in incoming_dataframes:
        update_window()
        for i, row in new_data_frame.iterrows():
            # convert the nanosecond timestamp to a datetime
            check_date = ts_to_date(row["timestamp"])

            # add to the dictionary if the new data is inside the window.
            # it should be.
            if start_of_window <= check_date <= end_of_window:
                # add to dict
                window_data[check_date] = row

        # remove any data outside the new start and end window values
        window_data_inside = {key: value for key, value in window_data.items() if start_of_window <= key <= end_of_window}
        print(window_data_inside)
        window_data = window_data_inside

        # Find the highest number of vehicles across all DataFrames
        highest_vehicles = float('-inf')  # Initialize with negative infinity

        for key, df in window_data_inside.items():
            max_vehicles_in_df = df['vehicles'].max()
            highest_vehicles = max(highest_vehicles, max_vehicles_in_df)

        print("Highest Number of Vehicles:", highest_vehicles)


def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
    print(stream_consumer.stream_id)
    if stream_consumer.stream_id == "JamCams_00001.01404":
        print("HERE!")
    
    #update_window()
    #process_data()


def on_stream_received_handler(stream_consumer: qx.StreamConsumer):
    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


# subscribe to new streams being received
topic_consumer.on_stream_received = on_stream_received_handler

print("Listening to streams. Press CTRL-C to exit.")

# Handle termination signals and provide a graceful exit
qx.App.run()