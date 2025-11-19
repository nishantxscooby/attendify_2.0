# student_routes.py
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app import db
from models import Student, StudentCourse, Course, Attendance, Session

student_bp = Blueprint("student", __name__)

# ---------------- Role-check decorator ----------------
def student_required(fn):
    @jwt_required()
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get("role") != "student":
            return jsonify({"error": "Student access required"}), 403
        return fn(*args, **kwargs)
    wrapper.__name__ = fn.__name__
    return wrapper

# ---------------- Enrolled Courses ----------------
@student_bp.route("/courses", methods=["GET"])
@student_required
def student_courses():
    claims = get_jwt()
    student_user_id = claims.get("user_id")
    student = Student.query.filter_by(user_id=student_user_id).first_or_404()

    courses = [sc.course for sc in student.student_courses]
    result = [{
        "course_id": c.course_id,
        "name": c.name,
        "code": c.code,
        "semester": c.semester,
        "credits": c.credits
    } for c in courses]
    return jsonify(result)

# ---------------- Attendance for a Course ----------------
@student_bp.route("/course/<int:course_id>/attendance", methods=["GET"])
@student_required
def course_attendance(course_id):
    claims = get_jwt()
    student_user_id = claims.get("user_id")
    student = Student.query.filter_by(user_id=student_user_id).first_or_404()

    # Get all sessions for the course
    sessions = Session.query.filter_by(course_id=course_id).all()
    attendance_list = []
    for s in sessions:
        attendance = Attendance.query.filter_by(session_id=s.session_id, student_id=student.student_id).first()
        attendance_list.append({
            "session_id": s.session_id,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "status": attendance.status if attendance else "Absent"
        })
    return jsonify(attendance_list)

# ---------------- Latest Active Attendance Session ----------------
@student_bp.route("/attendance/latest", methods=["GET"])
@student_required
def latest_attendance():
    claims = get_jwt()
    student_user_id = claims.get("user_id")
    student = Student.query.filter_by(user_id=student_user_id).first_or_404()

    active_session = Session.query.filter_by(active=True).first()
    if not active_session:
        return jsonify({"message": "No active attendance session"}), 404

    attendance = Attendance.query.filter_by(session_id=active_session.session_id, student_id=student.student_id).first()
    status = attendance.status if attendance else "Not marked"

    return jsonify({
        "session_id": active_session.session_id,
        "course_id": active_session.course_id,
        "status": status,
        "start_time": active_session.start_time
    })
