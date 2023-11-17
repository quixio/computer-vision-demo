import quixstreams as qx
import os
import pandas as pd
import numpy as np
import time
from ultralytics import YOLO
import cv2


client = qx.QuixStreamingClient()

topic_consumer = client.get_topic_consumer(os.environ["input"], consumer_group = "empty-transformation")
# topic_producer_videos = client.get_topic_producer(os.environ["output_videos"])
topic_producer_vehicles = client.get_topic_producer(os.environ["output"])

yolo_8 = YOLO(os.environ["yolo_model"])


def n_vehicles_from_result(res, df: pd.DataFrame):
    count = {
        "car": 0,
        "motorcycle": 0,
        "bus": 0,
        "truck": 0
    }
    classes_list = [res.names[int(class_i)] for class_i in res.boxes.cls.tolist()]
    for vc in classes_list:
        if vc in ["car", "motorcycle", "bus", "truck"]:
            count[vc] += 1
    if count["car"]:
        df.loc[0, ["car"]] = count["car"]
    if count["motorcycle"]:
        df.loc[0, ["motorcycle"]] = count["motorcycle"]
    if count["bus"]:
        df.loc[0, ["bus"]] = count["bus"]
    if count["truck"]:
        df.loc[0, ["truck"]] = count["truck"]

def image_to_binary_string(numpy_image):
    return cv2.imencode('.png', numpy_image)[1].tobytes()

def on_dataframe_received_handler(stream_consumer: qx.StreamConsumer, df: pd.DataFrame):

    # Initiate variables
    image_file = "image.jpg"
    with open(image_file, "wb") as fd:
        fd.write(df['image'].iloc[0])
    
    df["TAG__ML_model"] = os.environ["yolo_model"]
    video_df = pd.DataFrame()

    ti = time.time()
    # Classify video with model
    classification_results = yolo_8(source = image_file, conf = 0.15, iou = 0.5) #Check device arg https://docs.ultralytics.com/modes/predict/#sources
    
    tj = time.time()
    # Iterate over frames to format as binary
    for frame_res in classification_results:
        df_i = df.copy(deep=True)
        # df_i["original_frame"] = image_to_binary_string(frame_res.orig_img)
        df_i["classified_frame"] = image_to_binary_string(frame_res.plot())
        n_vehicles_from_result(frame_res, df_i)
        video_df = pd.concat([video_df, df_i], ignore_index=True)

    # OUTPUT: NUMBER OF VEHICLES
    tk = time.time()
    if "car" in video_df:
        df["car"] = np.median(video_df["car"])
    if "motorcycle" in video_df:
        df["motorcycle"] = np.median(video_df["motorcycle"])
    if "bus" in video_df:
        df["bus"] = np.median(video_df["bus"])
    if "truck" in video_df:
        df["truck"] = np.median(video_df["truck"])

    df["classified_frame"] = video_df["classified_frame"].iloc[0]

    print(df.info())
    stream_producer = topic_producer_vehicles.get_or_create_stream(stream_id = stream_consumer.stream_id)
    stream_producer.timeseries.publish(df)

    print("{} seconds employed in images classification".format(tj-ti))
    print("{} seconds employed in all frames images conversions and storing and vehicle counts".format(tk-tj))
    
    # OUTPUT: VIDEOS
    # tl = time.time()
    # stream_producer_videos = topic_producer_videos.get_or_create_stream(stream_id = stream_consumer.stream_id)
    # print(video_df.info())
    # stream_producer_videos.timeseries.publish(video_df)
    # tm = time.time()

    # print("{} seconds employed in outputing vehicle numbers".format(tl-tk))
    # print("{} seconds employed in outputing original and classified frames".format(tm-tl))
        


def on_stream_received_handler(stream_consumer: qx.StreamConsumer):
    stream_consumer.timeseries.on_dataframe_received = on_dataframe_received_handler


# subscribe to new streams being received
topic_consumer.on_stream_received = on_stream_received_handler

print("Listening to streams. Press CTRL-C to exit.")
# Handle termination signals and provide a graceful exit
qx.App.run()