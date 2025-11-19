from math import radians, sin, cos, sqrt, atan2
from config import Config

def distance_meters(lat1, lon1, lat2, lon2):
    # Haversine
    R = 6371000.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

def within_geofence(session_lat, session_lon, user_lat, user_lon, radius_meters=None):
    if session_lat is None or session_lon is None or user_lat is None or user_lon is None:
        return False
    if radius_meters is None:
        radius_meters = Config.GEOFENCE_RADIUS_METERS
    dist = distance_meters(float(session_lat), float(session_lon), float(user_lat), float(user_lon))
    return dist <= float(radius_meters)
