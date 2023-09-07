import quixstreams as qx
import os
import pandas as pd
import datetime

storage = qx.LocalFileStorage()

client = qx.QuixStreamingClient()

topic_consumer = client.get_topic_consumer(os.environ["input"], consumer_group="max-vehicles",
                                           auto_offset_reset=qx.AutoOffsetReset.Latest)
topic_producer = client.get_topic_producer(os.environ["output"])

pd.set_option('display.max_columns', None)

# todo load cams from state

cams = {
    'window_data': {},
    'stream_vehicles': {}
}

start_of_window = None
end_of_window = None
window_length_days = 1
window_length_mins = 0
window_length_secs = 0
window = ""


def update_window():
    global end_of_window
    global start_of_window
    global window

    end_of_window = datetime.datetime.utcnow()
    start_of_window = end_of_window - datetime.timedelta(days=window_length_days, minutes=window_length_mins,
                                                         seconds=window_length_secs)

    time_difference = end_of_window - start_of_window
    days = time_difference.days
    hours, remainder = divmod(time_difference.seconds, 3600)
    minutes = remainder // 60

    window = "{}d {}h {}m".format(days, hours, minutes)


def ts_to_date(ts):
    sec = ts / 1_000_000_000
    dt = datetime.datetime.utcfromtimestamp(sec)
    return dt


def process_data(stream_consumer, new_data_frame):
    global cams

    stream_id = stream_consumer.stream_id

    new_data_frame["image"] = ""  # we don't need the image for this path in the pipeline

    new_data_frame['ts'] = ts_to_date(new_data_frame["timestamp"][0])

    if stream_id not in cams:
        cams[stream_id] = {"window_data": {}, "stream_vehicles": {}}

    update_window()
    for i, row in new_data_frame.iterrows():
        # convert the nanosecond timestamp to a datetime
        check_date = ts_to_date(row["timestamp"])

        # add to the dictionary if the new data is inside the window.
        # it should be.
        if start_of_window <= check_date <= end_of_window:
            # add to dict
            cams[stream_id]["window_data"][check_date] = row

    # remove any data outside the new start and end window values
    window_data_inside = {key: value for key, value in cams[stream_id]["window_data"].items() if
                          start_of_window <= key <= end_of_window}

    if window_data_inside:
        # update the data with the data that is currently in the window
        cams[stream_id]["window_data"] = window_data_inside

        # Find the highest number of vehicles across all DataFrames
        highest_vehicles = float('-inf')  # Initialize with negative infinity
        highest_vehicles_ts = datetime.datetime.utcnow()

        # for each row inside the window, find the highest vehicle count
        for key, df in window_data_inside.items():
            max_vehicles_in_df = df['vehicles']

            # get the highest vehicles for stream
            state = stream_consumer.get_dict_state("highest_vehicles", lambda: 0)
            state_value = 0
            if len(state.items()) > 0:
                state_value = state[stream_id]["max"]
            else:
                state[stream_id] = {'max': 0}

            if max_vehicles_in_df > state_value:
                state[stream_id] = {'max': max_vehicles_in_df}
                highest_vehicles = max_vehicles_in_df
            else:
                highest_vehicles = state_value

        print(f"Highest Number of Vehicles:{highest_vehicles} found at {highest_vehicles_ts}")

        data = {'timestamp': datetime.datetime.utcnow(),
                'max_vehicles': [highest_vehicles],
                'TAG__window_start': start_of_window,
                'TAG__window_end': end_of_window,
                'TAG__window': window,
                'TAG__cam': stream_id}
        df2 = pd.DataFrame(data)

        # publish the new dataframe
        stream_producer = topic_producer.get_or_create_stream(stream_id=stream_id)
        stream_producer.timeseries.buffer.publish(df2)


def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
    print(stream_consumer.stream_id)
    # if stream_consumer.stream_id == "JamCams_00002.00635":

    update_window()
    process_data(stream_consumer, df)


def on_stream_received_handler(stream_consumer: qx.StreamConsumer):
    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


# subscribe to new streams being received
topic_consumer.on_stream_received = on_stream_received_handler

print("Listening to streams. Press CTRL-C to exit.")

# Handle termination signals and provide a graceful exit
qx.App.run()
