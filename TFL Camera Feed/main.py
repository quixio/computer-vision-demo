import quixstreams as qx
import os
import json
import requests
import time
from threading import Thread
import xml.etree.ElementTree as ET
from dateutil import parser


# should the main loop run?
run = True

client = qx.QuixStreamingClient()
api_key = os.environ["tfl_api_key"]

print(api_key)

# Change consumer group to a different constant if you want to run model locally.
print("Opening input and output topics")

producer_topic = client.get_topic_producer(os.environ["output"])

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
            
        except Exception as ex:
            print("An error occurred while trying to call the JamCam endpoint.")
            print("Please check your API key")
            print("Error:")
            print(ex)

        finally:
            print(f"JamCam 'get' status: {cameras.status_code}")

        cameras_list = cameras.json()

        for camera in cameras_list:
            camera_id = str(camera["id"])
            
            try:
                timestamp_str = files[camera_id.replace("JamCams_", "") + ".mp4"]
            except KeyError:
                print("No data for " + camera_id)
                continue

            timestamp = parser.parse(timestamp_str)

            producer_topic.get_or_create_stream(camera_id).events.add_timestamp(timestamp) \
                .add_value("camera", json.dumps(camera)) \
                .publish()    

            print("Sent camera " + camera_id)

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