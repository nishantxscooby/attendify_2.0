from flask import Blueprint, request, jsonify
from app import db
from models import User, Student, Teacher
from passlib.hash import bcrypt
from flask_jwt_extended import create_access_token, jwt_required, get_jwt
import datetime

auth_bp = Blueprint("auth", __name__)

# ---------------- Register Student ----------------
@auth_bp.route("/register/student", methods=["POST"])
def register_student():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")
    roll_no = data.get("roll_no")
    name = data.get("name")
    class_code = data.get("class_code")
    email = data.get("email")
    phone = data.get("phone")

    if not (username and password and roll_no and name and class_code):
        return jsonify({"error": "username, password, roll_no, name, class_code required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "username already exists"}), 400

    pw_hash = bcrypt.hash(password)
    user = User(username=username, password_hash=pw_hash, role="student")
    db.session.add(user)
    db.session.flush()

    student = Student(
        user_id=user.user_id,
        roll_no=roll_no,
        name=name,
        class_code=class_code,
        email=email,
        phone=phone
    )
    db.session.add(student)
    db.session.commit()

    return jsonify({
        "message": "student registered",
        "user_id": user.user_id,
        "student_id": student.student_id
    }), 201

# ---------------- Register Teacher ----------------
@auth_bp.route("/register/teacher", methods=["POST"])
def register_teacher():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")
    name = data.get("name")
    email = data.get("email")
    phone = data.get("phone")
    department = data.get("department")
    designation = data.get("designation")

    if not (username and password and name and email):
        return jsonify({"error": "username,password,name,email required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "username already exists"}), 400

    pw_hash = bcrypt.hash(password)
    user = User(username=username, password_hash=pw_hash, role="teacher")
    db.session.add(user)
    db.session.flush()

    teacher = Teacher(
        user_id=user.user_id,
        name=name,
        email=email,
        phone=phone,
        department=department,
        designation=designation
    )
    db.session.add(teacher)
    db.session.commit()

    return jsonify({
        "message": "teacher registered",
        "user_id": user.user_id,
        "staff_id": teacher.staff_id
    }), 201

# ---------------- Register Admin ----------------
@auth_bp.route("/register/admin", methods=["POST"])
def register_admin():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")

    if not (username and password):
        return jsonify({"error": "username and password required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "username already exists"}), 400

    pw_hash = bcrypt.hash(password)
    user = User(username=username, password_hash=pw_hash, role="admin")
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": "admin registered",
        "user_id": user.user_id
    }), 201

# ---------------- Login ----------------
@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json() or {}
        username = data.get("username")
        password = data.get("password")

        if not (username and password):
            return jsonify({"error": "username and password required"}), 400

        user = User.query.filter_by(username=username).first()
        if not user or not bcrypt.verify(password, user.password_hash):
            return jsonify({"error": "invalid credentials"}), 401

        additional_claims = {
            "role": user.role,
            "user_id": user.user_id
        }

        # ✅ identity must be string
        access_token = create_access_token(
            identity=str(user.user_id),
            additional_claims=additional_claims,
            expires_delta=datetime.timedelta(hours=8)
        )

        return jsonify({
            "access_token": access_token,
            "role": user.role,
            "user_id": user.user_id
        })
    except Exception as e:
        print("Login Error:", e)
        return jsonify({"error": "Internal Server Error"}), 500

# ---------------- Role Endpoint ----------------
@auth_bp.route("/role", methods=["GET"])
@jwt_required()
def get_role():
    claims = get_jwt()
    return jsonify({
        "role": claims.get("role"),
        "user_id": claims.get("user_id")
    })
