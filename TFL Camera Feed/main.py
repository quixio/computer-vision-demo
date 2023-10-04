import quixstreams as qx
import os
import json
import requests
import time
from threading import Thread
from shapely.geometry import Point, Polygon
import ast
import xml.etree.ElementTree as ET
from dateutil import parser


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
api_key = os.environ["tfl_api_key"]

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
    return enabled is not None


def get_data():
    while run:
        start = time.time()
        print("Loading new data.")

        resp = requests.get("https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/")

        with open('jamcams.xml', 'wb') as f:
            f.write(resp.content)

        tree = ET.parse('jamcams.xml')

        # get root element
        root = tree.getroot()
    
        files = {}
        for a in root.findall("{http://s3.amazonaws.com/doc/2006-03-01/}Contents"):
            files[a[0].text] = a[1].text

        try:
            cameras = requests.get(
                "https://api.tfl.gov.uk/Place/Type/JamCam/?app_id=QuixFeed&app_key={}".format(api_key))
            
            print(f"Got {cameras.status_code} status code.")

            # if TfL returns a 429 (too many requests) then we need to back off a bit
            if cameras.status_code == 429:
                print(cameras) # print everything. just wanna see if they give us any more details
                time.sleep(10) # wait 10 seconds
                continue # start back at the begninning again

        except Exception as ex:
            print("An error occurred while trying to call the JamCam endpoint.")
            print("Please check your API key")
            print("Error:")
            print(ex)

        finally:
            print(f"JamCam 'get' status: {cameras.status_code}")

        cameras_list = cameras.json()

        for camera in cameras_list:
            camera_id = camera["id"]
            if not camera_is_online(camera):
                print(f"Camera {camera_id} is offline")
            else:
                try:
                    timestamp_str = files[camera_id.replace("JamCams_", "") + ".mp4"]
                except KeyError:
                    # the camera is online but we can't get the mp4
                    print("No data for " + camera_id)
                    continue

                timestamp = parser.parse(timestamp_str)

                # If we are using geofencing
                if use_geo_fence and not camera_is_in_fence(camera):
                    # and the camera is outside the fence,
                    # don't publish it to the producer topic.
                    use_camera = False
                else:
                    # if it is inside the area of interest, publish it.
                    message = "inside the geofence" if use_geo_fence else "online"
                    print(f"Camera {camera_id} is {message}")

                    # At this point we know:
                    #  - The camera is online
                    #  - The camera is either in the geographic area of interest or geofence is not being used
                    use_camera = True  # So lets use the camera


                # If we're happy with the camera
                if use_camera:
                    # publish the data
                    producer_topic.get_or_create_stream(camera_id).events.add_timestamp(timestamp) \
                        .add_value("camera", json.dumps(camera)) \
                        .publish()

        sleep_time = int(os.environ["sleep_interval"]) - (time.time() - start)

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
