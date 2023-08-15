import quixstreams as qx
import time
import datetime
import math
import os
import random


# Quix injects credentials automatically to the client. 
# Alternatively, you can always pass an SDK token manually as an argument.
client = qx.QuixStreamingClient()

# Open the output topic where to write data out
topic_producer = client.get_topic_producer(topic_id_or_name = os.environ["output"])

# Set stream ID or leave parameters empty to get stream ID generated.
stream = topic_producer.create_stream()
stream.properties.name = "CAM001"

# Add metadata about time series data you are about to send. 
print("Sending values for a while....")

for index in range(0, 3000):
    stream.timeseries \
        .buffer \
        .add_timestamp(datetime.datetime.utcnow()) \
        .add_value("car",  random.randint(1, 10)) \
        .add_value("bus",  random.randint(1, 10)) \
        .add_value("truck",  random.randint(1, 10)) \
        .add_value("lat",  random.randint(1, 10)) \
        .add_value("lon",  random.randint(1, 10)) \
        .add_value("delta",  random.randint(1, 10)) \
        .publish()
    time.sleep(1)

print("Closing stream")
stream.close()