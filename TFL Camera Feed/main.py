import quixstreams as qx
import os
import json
import requests
import time
from threading import Thread
from shapely.geometry import Point, Polygon
import ast


# should the main loop run?
run = True

# setup camera coordinates and fence area
coords = os.environ["fence_coordinates"]
if coords == "":
    use_geo_fence = False
else:
    use_geo_fence = True
    area_of_interest = ast.literal_eval(coords)
    print(f"Area of interest = {area_of_interest}")
    area_of_interest_polygon = Polygon(area_of_interest)

# create the QuixStreamingClient
client = qx.QuixStreamingClient()
api_key = os.environ["api_key"]

# Change consumer group to a different constant if you want to run model locally.
print("Opening input and output topics")

producer_topic = client.get_topic_producer(os.environ["output"])


def camera_is_in_fence(camera):
    if not use_geo_fence: 
        return False
    
    lon = float(camera["lon"])
    lat = float(camera["lat"])

    # check the ONLINE cameras position.
    camera_position = Point(lon, lat)
    return area_of_interest_polygon.contains(camera_position)


def camera_is_online(camera):
    # is the camera online?
    enabled = next((account for account in camera['additionalProperties'] if account['key'] == "available" and account['value'] == "true"), None)
    # print(f"Enabled?=={enabled is not None}")
    return enabled is not None


def get_data():
    while run:
        start = time.time()
        print("Loading new data.")
        cameras = requests.get(
            "https://api.tfl.gov.uk/Place/Type/JamCam/?app_id=QuixFeed&app_key={}".format(api_key))

        cameras_list = cameras.json()

        for camera in cameras_list:

            if camera_is_online(camera):
                use_camera = True  # it is online. Let's assume it will be used.
                camera_id = camera["id"]

                # If we are using geofencing, and the camera is outside the fence:
                if use_geo_fence and not camera_is_in_fence(camera):
                    # don't publish it to the producer topic.
                    use_camera = False
                else:
                    message = "inside the geofence" if use_geo_fence else "online"
                    print(f"Camera {camera_id} is {message}")

                # if geofence is off or cam is inside the fence then publish the data
                if use_camera:

                    producer_topic.get_or_create_stream(camera_id).events.add_timestamp_nanoseconds(time.time_ns()) \
                        .add_value("camera", json.dumps(camera)) \
                        .publish()    

                    print("Sent camera " + camera_id)

        sleep_time = 120 - (time.time() - start)

        if sleep_time > 0:
            print("Sleep for " + str(sleep_time))
            time.sleep(sleep_time)


def before_shutdown():
    global run

    # Stop the main loop
    run = False


def main():
    thread = Thread(target = get_data)
    thread.start()

    # handle termination signals and close streams
    qx.App.run(before_shutdown = before_shutdown)

    # wait for worker thread to end
    thread.join()

    print("Exiting")


if __name__ == "__main__":
    main()
