import quixstreams as qx
import os
import pandas as pd


client = qx.QuixStreamingClient()

topic_consumer = client.get_topic_consumer(os.environ["input"], consumer_group = "total-vehicles",
                                            auto_offset_reset = qx.AutoOffsetReset.Latest)
topic_producer = client.get_topic_producer(os.environ["output"])

pd.set_option('display.max_columns', None)


def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):
    print(stream_consumer.stream_id)

    # List of vehicle columns
    vehicle_columns = ['car', 'bus', 'truck', 'motorbike']

    # Calculate the total vehicle count based on existing columns
    total_vehicle_count = df.apply(lambda row: sum(row.get(column, 0) for column in vehicle_columns), axis=1)

    df["vehicles"] = total_vehicle_count
    print(df)
    stream_producer = topic_producer.get_or_create_stream(stream_id = stream_consumer.stream_id)
    stream_producer.timeseries.buffer.publish(df)

def on_stream_received_handler(stream_consumer: qx.StreamConsumer):
    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


# subscribe to new streams being received
topic_consumer.on_stream_received = on_stream_received_handler

print("Listening to streams. Press CTRL-C to exit.")

# Handle termination signals and provide a graceful exit
qx.App.run()
