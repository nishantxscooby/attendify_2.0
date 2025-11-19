import requests

BASE_URL = "http://127.0.0.1:5001"   # Attendance backend
LOGIN_URL = f"{BASE_URL}/auth/login"
ATTENDANCE_URL = f"{BASE_URL}/attendance/mark/face"

# Replace with your actual test credentials
USERNAME = "admin"
PASSWORD = "1234"

# Step 1: Login to get JWT token
login_payload = {
    "username": USERNAME,
    "password": PASSWORD
}
login_resp = requests.post(LOGIN_URL, json=login_payload)

if login_resp.status_code != 200:
    print("Login failed:", login_resp.text)
    exit()

token = login_resp.json().get("access_token")
print("✅ Got token:", token)

# Step 2: Send image for attendance marking
headers = {"Authorization": f"Bearer {token}"}

# Replace with your test face image
image_path = "test3.jpg"

with open(image_path, "rb") as img:
    files = {"image": (image_path, img, "image/jpeg")}
    data = {"session_id": 1, "lat": "28.6139", "lon": "77.2090"}  # Example session/location
    resp = requests.post(ATTENDANCE_URL, headers=headers, files=files, data=data)

print("📌 Response:", resp.json())
