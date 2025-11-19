import requests
from config import Config

def enroll_student(student_id: str, image_bytes: bytes):
    """
    Enroll a student with their ID and face image.
    """
    try:
        url = f"{Config.FACE_SERVICE_URL}/enroll"
        files = {'image': ('enroll.jpg', image_bytes, 'image/jpeg')}
        data = {'student_id': student_id}
        resp = requests.post(url, files=files, data=data, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def verify_student(student_id: str, image_bytes: bytes):
    """
    Verify if the face in the image matches the given student ID.
    """
    try:
        url = f"{Config.FACE_SERVICE_URL}/verify"
        files = {'image': ('verify.jpg', image_bytes, 'image/jpeg')}
        data = {'student_id': student_id}
        resp = requests.post(url, files=files, data=data, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def recognize_faces(image_bytes: bytes):
    """
    Recognize faces from a given image.
    """
    try:
        url = f"{Config.FACE_SERVICE_URL}/recognize"
        files = {'image': ('frame.jpg', image_bytes, 'image/jpeg')}
        resp = requests.post(url, files=files, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        return {"error": str(e)}
