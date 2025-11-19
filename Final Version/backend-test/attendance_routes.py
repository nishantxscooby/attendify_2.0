from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app import db
from models import Student, Session, Attendance, User, Course, StudentCourse, Teacher
from services.geofence import within_geofence
# Updated imports: use client functions from services.face_service_client
from services.face_service_client import recognize_faces, enroll_student, verify_student
from decimal import Decimal

attendance_bp = Blueprint("attendance", __name__)

def is_teacher(claims):
    return claims.get('role') == 'teacher'
def is_student(claims):
    return claims.get('role') == 'student'
def is_admin(claims):
    return claims.get('role') == 'admin'

@attendance_bp.route("/attendance/mark/manual", methods=["POST"])
@jwt_required()
def mark_manual():
    claims = get_jwt()
    if not is_teacher(claims) and not is_admin(claims):
        return jsonify({"error":"only teachers/admin can perform manual marking"}), 403
    data = request.get_json() or {}
    student_id = data.get("student_id")
    session_id = data.get("session_id")
    status = data.get("status", "Present")
    marked_by = get_jwt_identity()

    if not (student_id and session_id):
        return jsonify({"error":"student_id and session_id required"}), 400

    # upsert attendance (unique constraint student_id+session_id)
    att = Attendance.query.filter_by(student_id=student_id, session_id=session_id).first()
    if att:
        att.status = status
        att.method = "Manual"
        att.marked_by = marked_by
    else:
        att = Attendance(student_id=student_id, session_id=session_id, status=status, method="Manual", marked_by=marked_by)
        db.session.add(att)
    db.session.commit()
    return jsonify({"message":"attendance recorded (manual)", "student_id": student_id, "session_id": session_id})


@attendance_bp.route("/attendance/mark/face", methods=["POST"])
@jwt_required()
def mark_face():
    """
    Face-based marking endpoint.
    - Accepts multipart form with optional image file, student_id, lat, lon, session_id
    - If student_id + image provided -> uses verify_student(student_id, image_bytes)
    - If only image provided -> uses recognize_faces(image_bytes) to find all matches
    - If no image provided, can accept JSON with student_ids list for teacher-initiated marking
    """
    claims = get_jwt()
    data = request.form.to_dict() or {}
    # image may be sent as file
    image = request.files.get("image")  # optional
    lat = request.form.get("lat") or data.get("lat")
    lon = request.form.get("lon") or data.get("lon")
    session_id = data.get("session_id") or request.form.get("session_id")
    caller_id = get_jwt_identity()
    student_id_for_verify = data.get("student_id") or request.form.get("student_id")

    # Validate session
    if not session_id:
        return jsonify({"error":"session_id required"}), 400
    session = Session.query.get(session_id)
    if not session:
        return jsonify({"error":"session not found"}), 404

    recognized = []

    # 1) If both student_id and image provided -> use verify_student to verify that specific student
    if image and student_id_for_verify:
        try:
            res = verify_student(student_id_for_verify, image.read())
        except Exception as e:
            return jsonify({"error":"face service error", "details": str(e)}), 500

        # Expected verify response: { "verified": True/False, ... } or similar
        # Handle multiple possible shapes defensively
        if isinstance(res, dict) and res.get("error"):
            return jsonify({"error":"face service error", "details": res.get("error")}), 500

        # Normalize into recognized list if verified
        verified_flag = False
        # Common expected patterns: {'verified': True} or {'match': student_id, 'distance': x}
        if isinstance(res, dict):
            if res.get("verified") is True:
                verified_flag = True
            elif res.get("match") == student_id_for_verify:
                verified_flag = True
            elif res.get("student_id") == student_id_for_verify and res.get("distance", 1.0) <= 0.6:
                verified_flag = True

        if verified_flag:
            recognized = [{"student_id": student_id_for_verify, "score": res.get("distance") if isinstance(res, dict) else None}]
        else:
            recognized = []

    # 2) If only image provided -> call recognize_faces to detect all matches
    elif image:
        try:
            res = recognize_faces(image.read())
        except Exception as e:
            return jsonify({"error":"face service error", "details": str(e)}), 500

        if isinstance(res, dict) and res.get("error"):
            return jsonify({"error":"face service error", "details": res.get("error")}), 500

        # Standardize: expect res.get("recognized") to be list of {student_id, distance, in_geofence?}
        recognized = res.get("recognized", []) if isinstance(res, dict) else []

    else:
        # 3) No image: teachers/admin may pass student_ids in JSON payload
        payload = request.get_json(silent=True) or {}
        if payload.get("student_ids"):
            recognized = [{"student_id": sid, "score": None} for sid in payload.get("student_ids")]

    # For each recognized student, validate geofence (server-side) and insert attendance
    marked = []
    not_inside = []
    for r in recognized:
        sid = r.get("student_id") or r.get("studentId") or r.get("id")
        if sid is None:
            continue

        # Compare student's reported lat/lon with session location (server-side)
        if lat is not None and lon is not None:
            try:
                inside = within_geofence(session.latitude, session.longitude, lat, lon)
            except Exception:
                inside = False
        else:
            # If no location provided, fail-safe: require caller to be teacher/admin
            if not is_teacher(claims) and not is_admin(claims):
                inside = False
            else:
                inside = True

        if not inside:
            not_inside.append(sid)
            continue

        # Upsert attendance
        att = Attendance.query.filter_by(student_id=sid, session_id=session.session_id).first()
        if att:
            att.status = 'Present'
            att.method = 'Face'
            att.marked_by = caller_id
            att.geo_lat = Decimal(lat) if lat else None
            att.geo_long = Decimal(lon) if lon else None
        else:
            att = Attendance(student_id=sid, session_id=session.session_id, status='Present', method='Face', marked_by=caller_id,
                             geo_lat=Decimal(lat) if lat else None, geo_long=Decimal(lon) if lon else None)
            db.session.add(att)
        marked.append(sid)

    db.session.commit()
    return jsonify({"marked": marked, "not_inside": not_inside, "session_id": session_id})


@attendance_bp.route("/attendance/student/<int:student_id>", methods=["GET"])
@jwt_required()
def get_student_attendance(student_id):
    # compute attendance % and return history
    # allow students to view their own or teacher/admin to view
    claims = get_jwt()
    requester = get_jwt_identity()
    if claims.get("role") == "student":
        student = Student.query.filter_by(student_id=student_id).first()
        if not student or requester != student.user_id:
            return jsonify({"error":"forbidden"}), 403

    from sqlalchemy import func
    total = db.session.query(func.count(Attendance.attendance_id)).filter(Attendance.student_id==student_id).scalar()
    present = db.session.query(func.count(Attendance.attendance_id)).filter(Attendance.student_id==student_id, Attendance.status=='Present').scalar()
    percent = 0.0
    if total and total > 0:
        percent = round((present / total) * 100.0, 2)

    history = Attendance.query.filter_by(student_id=student_id).all()
    from schemas import AttendanceSchema
    schema = AttendanceSchema(many=True)
    return jsonify({"student_id": student_id, "attendance_percent": percent, "total": total, "present": present, "history": schema.dump(history)})


@attendance_bp.route("/attendance/class/<int:course_id>", methods=["GET"])
@jwt_required()
def get_class_attendance(course_id):
    # return attendance for sessions of a course (optionally filter by date)
    date = request.args.get("date")
    # fetch sessions
    sessions = Session.query.filter_by(course_id=course_id).all()
    result = []
    for sess in sessions:
        q = Attendance.query.filter_by(session_id=sess.session_id).all()
        from schemas import AttendanceSchema
        schema = AttendanceSchema(many=True)
        result.append({"session_id": sess.session_id, "start_time": sess.start_time.isoformat(), "attendance": schema.dump(q)})
    return jsonify({"course_id": course_id, "sessions": result})


@attendance_bp.route("/analytics/defaulters", methods=["GET"])
@jwt_required()
def get_defaulters():
    # returns students with attendance % < 75
    from sqlalchemy import func
    sub = db.session.query(
        Attendance.student_id,
        func.count(Attendance.attendance_id).label("tot"),
        func.sum(func.case([(Attendance.status=='Present', 1)], else_=0)).label("pres")
    ).group_by(Attendance.student_id).subquery()

    q = db.session.query(sub.c.student_id, sub.c.tot, sub.c.pres).filter((sub.c.pres / sub.c.tot) < 0.75).all()
    out = []
    for row in q:
        student = Student.query.get(row.student_id)
        percent = round((row.pres / row.tot) * 100.0, 2) if row.tot else 0.0
        out.append({"student_id": row.student_id, "name": student.name if student else None, "attendance_percent": percent})
    return jsonify({"defaulters": out})


@attendance_bp.route("/analytics/method-ratio", methods=["GET"])
@jwt_required()
def get_method_ratio():
    from sqlalchemy import func
    q = db.session.query(Attendance.method, func.count(Attendance.attendance_id)).group_by(Attendance.method).all()
    return jsonify({"method_stats": [{"method": r[0], "count": r[1]} for r in q]})
