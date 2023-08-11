import quixstreams as qx
import os
import pandas as pd


client = qx.QuixStreamingClient()

topic_consumer = client.get_topic_consumer(os.environ["input"], consumer_group = "empty-transformation")
topic_producer = client.get_topic_producer(os.environ["output"])

pd.set_option('display.max_columns', None)

# Initialize an empty DataFrame to store the data
data = pd.DataFrame(columns=['timestamp', 'lat', 'lon', 'car'])


# Function to update data and calculate average
def update_data_and_average(new_data):
    global data
    
    # Convert timestamp to datetime
    new_data['timestamp'] = pd.to_datetime(new_data['timestamp'])
    
    # Append new data to the DataFrame
    data = data.append(new_data, ignore_index=True)
    
    # Resample data to hourly intervals and sum car
    resampled_data = data.groupby(['lat', 'lon', pd.Grouper(key='timestamp', freq='1H')]).sum().reset_index()
    
    # Calculate average for each hour of the day
    hourly_average = resampled_data.groupby(['lat', 'lon', resampled_data['timestamp'].dt.hour])['car'].mean().reset_index()
    
    return hourly_average


def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):

    #data = df
    #print(df)

    hourly_average = update_data_and_average(df)

    # Print the DataFrame with all columns displayed
    print("avg=================")
    print(f'{hourly_average}')
    print("======================")

    a = pd.DataFrame(hourly_average)
    a["timestamp"] = df["timestamp"]
    stream_producer = topic_producer.get_or_create_stream("cars")
    stream_producer.timeseries.buffer.publish(a)


# Handle event data from samples that emit event data
def on_event_data_received_handler(stream_consumer: qx.StreamConsumer, data: qx.EventData):
    print(data)
    # handle your event data here


def on_stream_received_handler(stream_consumer: qx.StreamConsumer):
    # subscribe to new DataFrames being received
    # if you aren't familiar with DataFrames there are other callbacks available
    # refer to the docs here: https://docs.quix.io/sdk/subscribe.html
    stream_consumer.events.on_data_received = on_event_data_received_handler # register the event data callback
    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


# subscribe to new streams being received
topic_consumer.on_stream_received = on_stream_received_handler

print("Listening to streams. Press CTRL-C to exit.")

# Handle termination signals and provide a graceful exit
qx.App.run()