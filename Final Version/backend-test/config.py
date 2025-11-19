import os
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
SQLITE_PATH = os.path.join(BASE_DIR, "frontend", "instance", "attendance_system.db")
DEFAULT_SQLITE_URI = f"sqlite:///{SQLITE_PATH.replace(os.sep, '/')}"

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "test123")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "test123")
    SQLALCHEMY_DATABASE_URI = os.getenv("SQLALCHEMY_DATABASE_URI", DEFAULT_SQLITE_URI)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    FACE_SERVICE_URL = os.getenv("FACE_SERVICE_URL", "http://127.0.0.1:5001")
    GEOFENCE_RADIUS_METERS = float(os.getenv("GEOFENCE_RADIUS_METERS", 200))
