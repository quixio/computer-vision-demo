import quixstreams as qx
import os
import pandas as pd
import datetime


client = qx.QuixStreamingClient()

topic_consumer = client.get_topic_consumer(os.environ["input"], consumer_group = "empty-transformation", 
                                            auto_offset_reset = qx.AutoOffsetReset.Latest)
topic_producer = client.get_topic_producer(os.environ["output"])

pd.set_option('display.max_columns', None)

cams = {
    'window_data': {},
    'stream_vehicles': {}
}

start_of_window = None
end_of_window = None
window_length_days = 1
window_length_mins = 0
window_length_secs = 0

def update_window():
    global end_of_window
    global start_of_window

    end_of_window = datetime.datetime.utcnow()
    start_of_window = end_of_window - datetime.timedelta(days = window_length_days, minutes = window_length_mins, seconds = window_length_secs)


def ts_to_date(ts):
    sec = ts / 1_000_000_000
    dt = datetime.datetime.utcfromtimestamp(sec)
    #print(dt)
    return dt


def process_data(stream_id, new_data_frame):

    print("*************************************")
    new_data_frame['ts'] = ts_to_date(new_data_frame["timestamp"][0])
    #print(new_data_frame)
    global cams

    if stream_id not in cams:
        cams[stream_id] = { "window_data": {}, "stream_vehicles": {} }

    #for new_data_frame in incoming_dataframes:
    update_window()
    for i, row in new_data_frame.iterrows():
        # convert the nanosecond timestamp to a datetime
        check_date = ts_to_date(row["timestamp"])

        # add to the dictionary if the new data is inside the window.
        # it should be.
        if start_of_window <= check_date <= end_of_window:
            # add to dict
            cams[stream_id]["window_data"][check_date] = row
            #print(f"adding to window_data: {check_date}")

    print("-------------")
    print(cams[stream_id]["window_data"])
    print("-------------")

    # remove any data outside the new start and end window values
    window_data_inside = {key: value for key, value in cams[stream_id]["window_data"].items() if start_of_window <= key <= end_of_window}
    
    if window_data_inside:
        print("HAS DATA")
        #print(window_data_inside)
        cams[stream_id]["window_data"] = window_data_inside

        # Find the highest number of vehicles across all DataFrames
        highest_vehicles = float('-inf')  # Initialize with negative infinity
        #print(f'window_data_inside={window_data_inside}')
        # for each row inside the window, find the highest vehicle count
        for key, df in window_data_inside.items():
            max_vehicles_in_df = df['vehicles']
            highest_vehicles = max(highest_vehicles, max_vehicles_in_df)
            #print(f"key={key}, {df['vehicles']}")

        print("Highest Number of Vehicles:", highest_vehicles)
        
        # record the highest vehicle count against the stream id
        cams[stream_id]["stream_vehicles"][stream_id] = highest_vehicles

        print(f'{cams[stream_id]["stream_vehicles"]}')


        data = {'timestamp': datetime.datetime.utcnow() ,'max_vehicles': [highest_vehicles]}
        df2 = pd.DataFrame(data)

        #out_df = pd.DataFrame()
        #out_df["max_vehicles"] = [highest_vehicles]
        # publish the amended dataframe to the topic
        #print("================")
        #print(out_df)
        #print("================")

        stream_producer = topic_producer.get_or_create_stream(stream_id = stream_id)
        stream_producer.timeseries.buffer.publish(df2)


def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
    print(stream_consumer.stream_id)
    #if stream_consumer.stream_id == "JamCams_00002.00635":
    
    update_window()
    process_data(stream_consumer.stream_id, df)


def on_stream_received_handler(stream_consumer: qx.StreamConsumer):
    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


# subscribe to new streams being received
topic_consumer.on_stream_received = on_stream_received_handler

print("Listening to streams. Press CTRL-C to exit.")

# Handle termination signals and provide a graceful exit
qx.App.run()