import requests
'''
# Enroll (already done, but just as example)
url_enroll = "http://localhost:5001/enroll"
files = {"image": open("kathansh.jpg", "rb")}
data = {"student_id": "S24CSEU2656"}
print("Enroll response:", requests.post(url_enroll, files=files, data=data).json())

'''
url_recognize = "http://localhost:5001/recognize"
files = {"image": open("kathanshtest1.jpg", "rb")}
resp = requests.post(url_recognize, files=files)
print("Recognize response:", resp.json())



