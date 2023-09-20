import quixstreams as qx
import os
import pandas as pd


buffer_duration = 1000

client = qx.QuixStreamingClient()

processed_image_consumer = client.get_topic_consumer(os.environ["processed_images"], consumer_group = "data-buffer", auto_offset_reset=qx.AutoOffsetReset.Earliest)
vehicle_count_consumer = client.get_topic_consumer(os.environ["vehicle_counts"], consumer_group = "data-buffer", auto_offset_reset=qx.AutoOffsetReset.Earliest)
max_vehicles_consumer = client.get_topic_consumer(os.environ["max_vehicles"], consumer_group = "data-buffer-v2", auto_offset_reset=qx.AutoOffsetReset.Earliest)

buffered_data = client.get_topic_producer(os.environ["buffered_stream"])

def on_image_stream_received_handler(stream_consumer: qx.StreamConsumer):
    def on_dataframe_received_handler(_: qx.StreamConsumer, df: pd.DataFrame):
        print("Received PROCESSED IMAGES data")

        stream_producer = buffered_data.get_or_create_stream(stream_id ="buffered_processed_images")
        df["TAG__camera"] = stream_consumer.stream_id

        stream_producer.timeseries.buffer.buffer_timeout = buffer_duration
        stream_producer.timeseries.buffer.time_span_in_milliseconds = buffer_duration
        stream_producer.timeseries.buffer.publish(df)

    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


def on_vehicle_counts_stream_received_handler(stream_consumer: qx.StreamConsumer):
    def on_dataframe_received_handler(_: qx.StreamConsumer, df: pd.DataFrame):
        print("Received VEHICLE COUNTS data")

        stream_producer = buffered_data.get_or_create_stream(stream_id ="buffered_vehicle_counts")
        df["TAG__camera"] = stream_consumer.stream_id

        stream_producer.timeseries.buffer.buffer_timeout = buffer_duration
        stream_producer.timeseries.buffer.time_span_in_milliseconds = buffer_duration
        stream_producer.timeseries.buffer.publish(df)

    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


def on_max_vehicles_stream_received_handler(stream_consumer: qx.StreamConsumer):
    def on_dataframe_received_handler(_: qx.StreamConsumer, df: pd.DataFrame):
        print("Received MAX_VEHICLES data")
        stream_producer = buffered_data.get_or_create_stream(stream_id ="buffered_max_vehicles")
        df["TAG__camera"] = stream_consumer.stream_id

        stream_producer.timeseries.buffer.buffer_timeout = buffer_duration
        stream_producer.timeseries.buffer.time_span_in_milliseconds = buffer_duration
        stream_producer.timeseries.buffer.publish(df)

    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


# subscribe to new streams being received
processed_image_consumer.on_stream_received = on_image_stream_received_handler
vehicle_count_consumer.on_stream_received = on_vehicle_counts_stream_received_handler
max_vehicles_consumer.on_stream_received = on_max_vehicles_stream_received_handler

print("Listening to streams. Press CTRL-C to exit.")

# Handle termination signals and provide a graceful exit
qx.App.run()
