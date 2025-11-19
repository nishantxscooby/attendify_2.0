from datetime import datetime
from app import db
from werkzeug.security import generate_password_hash, check_password_hash

# ==============================
# Users table
# ==============================
class User(db.Model):
    __tablename__ = "users"
    user_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum('student', 'teacher', 'admin', name='user_roles'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # relations
    student = db.relationship("Student", uselist=False, back_populates="user")
    teacher = db.relationship("Teacher", uselist=False, back_populates="user")
    logs = db.relationship("Log", backref="user", lazy=True)
    notifications = db.relationship("Notification", backref="user", lazy=True)

    # 🔑 password helpers
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


# ==============================
# Teachers
# ==============================
class Teacher(db.Model):
    __tablename__ = "teachers"
    staff_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete="CASCADE"), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    phone = db.Column(db.String(20))
    department = db.Column(db.String(100))
    designation = db.Column(db.String(50))
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", back_populates="teacher")
    courses = db.relationship("Course", backref="teacher", lazy=True)
    sessions = db.relationship("Session", backref="teacher", lazy=True)


# ==============================
# Students
# ==============================
class Student(db.Model):
    __tablename__ = "students"
    student_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete="CASCADE"), unique=True, nullable=False)
    roll_no = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    class_code = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    photo_path = db.Column(db.Text)
    registered_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", back_populates="student")
    student_courses = db.relationship("StudentCourse", backref="student", lazy=True)
    attendance = db.relationship("Attendance", backref="student", lazy=True)
    embeddings = db.relationship("FaceEmbedding", backref="student", lazy=True)


# ==============================
# Courses
# ==============================
class Course(db.Model):
    __tablename__ = "courses"
    course_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    staff_id = db.Column(db.Integer, db.ForeignKey('teachers.staff_id', ondelete="CASCADE"), nullable=False)
    semester = db.Column(db.Integer)
    credits = db.Column(db.Integer)

    student_courses = db.relationship("StudentCourse", backref="course", lazy=True)
    sessions = db.relationship("Session", backref="course", lazy=True)


# ==============================
# StudentCourse (Mapping)
# ==============================
class StudentCourse(db.Model):
    __tablename__ = "student_courses"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.student_id', ondelete="CASCADE"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.course_id', ondelete="CASCADE"), nullable=False)

    __table_args__ = (db.UniqueConstraint('student_id', 'course_id', name='uq_student_course'),)


# ==============================
# Sessions
# ==============================
class Session(db.Model):
    __tablename__ = "sessions"
    session_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.course_id', ondelete="CASCADE"), nullable=False)
    staff_id = db.Column(db.Integer, db.ForeignKey('teachers.staff_id', ondelete="CASCADE"), nullable=False)
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    active = db.Column(db.Boolean, default=True)
    latitude = db.Column(db.Numeric(9, 6), nullable=True)
    longitude = db.Column(db.Numeric(9, 6), nullable=True)

    attendance = db.relationship("Attendance", backref="session", lazy=True)


# ==============================
# Attendance
# ==============================
class Attendance(db.Model):
    __tablename__ = "attendance"
    attendance_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.student_id', ondelete="CASCADE"), nullable=False)
    session_id = db.Column(db.Integer, db.ForeignKey('sessions.session_id', ondelete="CASCADE"), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.Enum('Present', 'Absent', 'Late', name='attendance_status'), default='Present')
    method = db.Column(db.Enum('Face', 'Manual', name='attendance_method'), default='Face')
    marked_by = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=True)
    geo_lat = db.Column(db.Numeric(9, 6), nullable=True)
    geo_long = db.Column(db.Numeric(9, 6), nullable=True)

    __table_args__ = (db.UniqueConstraint('student_id', 'session_id', name='uq_student_session'),)


# ==============================
# Face Embeddings
# ==============================
class FaceEmbedding(db.Model):
    __tablename__ = "face_embeddings"
    embedding_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.student_id', ondelete="CASCADE"), nullable=False)
    embedding_vector = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# ==============================
# Notifications
# ==============================
class Notification(db.Model):
    __tablename__ = "notifications"
    notification_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete="CASCADE"), nullable=True)
    title = db.Column(db.String(100), nullable=False)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    read_status = db.Column(db.Boolean, default=False)


# ==============================
# Logs
# ==============================
class Log(db.Model):
    __tablename__ = "logs"
    log_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete="CASCADE"), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    ip_address = db.Column(db.String(50))
    details = db.Column(db.JSON, nullable=True)
