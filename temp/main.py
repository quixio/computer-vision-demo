from quixstreams import LocalFileStorage

storage = LocalFileStorage()

if storage.contains_key("KEY1"):
    print(storage.get("KEY1"))
    
#clear storage ( remove all keys )
storage.clear()

#storage class supports handling of
#   `str`, `int`, `float`, `bool`, `bytes`, `bytearray` types.

#set value
storage.set("KEY1", 12.51)
storage.set("KEY2", "str")
storage.set("KEY3", True)
storage.set("KEY4", False)

#check if the storage contains key
if storage.contains_key("KEY1"):
    print(storage.get("KEY1"))
