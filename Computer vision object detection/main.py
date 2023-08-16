import quixstreams as qx
import os
import pandas as pd
import numpy as np
import time
from ultralytics import YOLO
import cv2
from datetime import datetime


client = qx.QuixStreamingClient()

topic_consumer = client.get_topic_consumer(os.environ["input"], consumer_group = "empty-transformation")
topic_producer_videos = client.get_topic_producer(os.environ["output_videos"])
topic_producer_vehicles = client.get_topic_producer(os.environ["output_vehicles"])

yolo_8 = YOLO(os.environ["yolo_model"])


def n_vehicles_from_result(res):
  vehicle_classes = ["car", "motorcycle", "bus", "truck"]
  classes_list = [res.names[int(class_i)] for class_i in res.boxes.cls.tolist()]
  n_vehicles = len([class_i for class_i in classes_list if class_i in vehicle_classes])
  return n_vehicles

def image_to_binary_string(numpy_image):
    return cv2.imencode('.png', numpy_image)[1].tobytes()

def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):

    # Initiate variables
    video_url = "frame.jpg"
    with open(video_url, "wb") as fs:
        fs.write(df['image'].iloc[0])
        print("DEBUG: [{}] saved frame to file".format(datetime.today().strftime('%Y-%m-%d %H:%M:%S')))
    
    df["TAG__ML_model"] = os.environ["yolo_model"]
    video_df = pd.DataFrame()

    ti = time.time()
    # Classify video with model
    classification_results = yolo_8(source = video_url, conf = 0.15, iou = 0.5) #Check device arg https://docs.ultralytics.com/modes/predict/#sources
    
    tj = time.time()
    # Iterate over frames to format as binary
    for frame_res in classification_results:
        df_i = df.copy(deep=True)
        # df_i["original_frame"] = image_to_binary_string(frame_res.orig_img)
        df_i["classified_frame"] = image_to_binary_string(frame_res.plot())
        df_i["number_vehicles"] = n_vehicles_from_result(frame_res)
        video_df = pd.concat([video_df, df_i], ignore_index=True)

    # OUTPUT: NUMBER OF VEHICLES
    tk = time.time()
    df["number_vehicles"] = np.median(video_df["number_vehicles"])
    print(df.info())
    stream_producer = topic_producer_vehicles.get_or_create_stream(stream_id = stream_consumer.stream_id)
    stream_producer.timeseries.publish(df)
    
    # OUTPUT: VIDEOS
    tl = time.time()
    stream_producer_videos = topic_producer_videos.get_or_create_stream(stream_id = stream_consumer.stream_id)
    print(video_df.info())
    stream_producer_videos.timeseries.publish(video_df)
    tm = time.time()

    print("{} seconds employed in images classification".format(tj-ti))
    print("{} seconds employed in all frames images conversions and storing and vehicle counts".format(tk-tj))
    print("{} seconds employed in outputing vehicle numbers".format(tl-tk))
    print("{} seconds employed in outputing original and classified frames".format(tm-tl))
        


def on_stream_received_handler(stream_consumer: qx.StreamConsumer):
    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


# subscribe to new streams being received
topic_consumer.on_stream_received = on_stream_received_handler

print("Listening to streams. Press CTRL-C to exit.")
# Handle termination signals and provide a graceful exit
qx.App.run()