# teacher_routes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app import db
from models import Course, Session, Attendance, Student, User

teacher_bp = Blueprint("teacher", __name__)

# ---------------- Role-check decorator ----------------
def teacher_required(fn):
    @jwt_required()
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get("role") != "teacher":
            return jsonify({"error": "Teacher access required"}), 403
        return fn(*args, **kwargs)
    wrapper.__name__ = fn.__name__
    return wrapper

# ---------------- Courses ----------------
@teacher_bp.route("/courses", methods=["GET"])
@teacher_required
def list_courses():
    claims = get_jwt()
    teacher_id = claims.get("user_id")
    courses = Course.query.filter_by(staff_id=teacher_id).all()
    result = [{
        "course_id": c.course_id,
        "name": c.name,
        "code": c.code,
        "semester": c.semester,
        "credits": c.credits
    } for c in courses]
    return jsonify(result)

@teacher_bp.route("/course/add", methods=["POST"])
@teacher_required
def add_course():
    claims = get_jwt()
    teacher_id = claims.get("user_id")
    data = request.get_json() or {}
    code = data.get("code")
    name = data.get("name")
    semester = data.get("semester")
    credits = data.get("credits")

    if not (code and name):
        return jsonify({"error": "code and name required"}), 400

    course = Course(
        code=code,
        name=name,
        staff_id=teacher_id,
        semester=semester,
        credits=credits
    )
    db.session.add(course)
    db.session.commit()
    return jsonify({"message": "course added", "course_id": course.course_id}), 201

@teacher_bp.route("/course/<int:course_id>", methods=["GET"])
@teacher_required
def course_details(course_id):
    course = Course.query.get_or_404(course_id)
    sessions = Session.query.filter_by(course_id=course_id).all()
    avg_attendance = 0
    total_sessions = len(sessions)
    if total_sessions:
        total_students = sum(len(s.attendance) for s in sessions)
        present_count = sum(sum(1 for a in s.attendance if a.status=="Present") for s in sessions)
        avg_attendance = round((present_count / total_students) * 100, 2) if total_students else 0

    return jsonify({
        "course_id": course.course_id,
        "name": course.name,
        "code": course.code,
        "semester": course.semester,
        "credits": course.credits,
        "avg_attendance": avg_attendance,
        "sessions_count": total_sessions
    })

# ---------------- Course Students ----------------
@teacher_bp.route("/course/<int:course_id>/students", methods=["GET"])
@teacher_required
def list_course_students(course_id):
    course = Course.query.get_or_404(course_id)
    students = [sc.student for sc in course.student_courses]
    result = [{"student_id": s.student_id, "name": s.name, "roll_no": s.roll_no} for s in students]
    return jsonify(result)

# ---------------- Attendance Sessions ----------------
@teacher_bp.route("/course/<int:course_id>/attendance/start", methods=["POST"])
@teacher_required
def start_attendance(course_id):
    claims = get_jwt()
    teacher_id = claims.get("user_id")
    session = Session(course_id=course_id, staff_id=teacher_id)
    db.session.add(session)
    db.session.commit()
    return jsonify({"message": "attendance session started", "session_id": session.session_id})

@teacher_bp.route("/course/<int:course_id>/attendance/stop", methods=["POST"])
@teacher_required
def stop_attendance(course_id):
    session = Session.query.filter_by(course_id=course_id, active=True).first()
    if not session:
        return jsonify({"error": "No active session found"}), 404
    session.active = False
    session.end_time = datetime.utcnow()
    db.session.commit()
    return jsonify({"message": "attendance session stopped", "session_id": session.session_id})

@teacher_bp.route("/course/<int:course_id>/attendance/history", methods=["GET"])
@teacher_required
def attendance_history(course_id):
    sessions = Session.query.filter_by(course_id=course_id).order_by(Session.start_time.desc()).all()
    result = []
    for s in sessions:
        total_students = len(s.attendance)
        present_count = sum(1 for a in s.attendance if a.status=="Present")
        result.append({
            "session_id": s.session_id,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "status": "Active" if s.active else "Completed",
            "attendance_percentage": round((present_count / total_students) * 100, 2) if total_students else 0
        })
    return jsonify(result)

@teacher_bp.route("/course/<int:course_id>/attendance/export", methods=["GET"])
@teacher_required
def export_attendance(course_id):
    # Optional: Implement CSV or Excel export logic
    return jsonify({"message": "exported attendance CSV for course", "course_id": course_id})
