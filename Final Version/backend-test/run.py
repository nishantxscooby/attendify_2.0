import base64
import csv
import io
import json
import math
import os
import sqlite3
from collections import Counter
from contextlib import closing
from datetime import datetime, timezone, date
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from werkzeug.security import generate_password_hash

# ----------------------------
# Config / Paths
# ----------------------------
APP_ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(APP_ROOT, os.pardir))
DB_DIR = os.path.join(PROJECT_ROOT, "backend-test", "instance")
DB_PATH = os.path.join(DB_DIR, "attendance_system.db")  # <- existing DB

FACENET_URL = os.getenv("FACENET_URL", "http://localhost:5001")
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.4"))
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:3000")
PORT = int(os.getenv("PORT", "5000"))

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": CORS_ORIGIN}})

# ----------------------------
# DB Helpers
# ----------------------------
SCHEMA_INITIALIZED = False
print("Using DB:", DB_PATH)  # right after you compute DB_PATH


def ensure_schema(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      roll_no TEXT,
      email TEXT
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_name TEXT NOT NULL,
      section TEXT,
      subject TEXT,
      schedule_info TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      enrolled_at TEXT DEFAULT (datetime('now')),
      UNIQUE (class_id, student_id)
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      status TEXT NOT NULL,
      recognized_name TEXT,
      source TEXT DEFAULT 'manual'
    );
    """)
    alter_statements = [
        "ALTER TABLE attendance ADD COLUMN recognized_name TEXT",
        "ALTER TABLE attendance ADD COLUMN source TEXT DEFAULT 'manual'",
        "ALTER TABLE attendance ADD COLUMN time TEXT",
        "ALTER TABLE attendance ADD COLUMN remark TEXT",
        "ALTER TABLE attendance ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
        "ALTER TABLE classes ADD COLUMN section TEXT",
        "ALTER TABLE classes ADD COLUMN subject TEXT",
        "ALTER TABLE classes ADD COLUMN schedule_info TEXT"
    ]
    for statement in alter_statements:
        try:
            cursor.execute(statement)
        except sqlite3.OperationalError as exc:
            message = str(exc).lower()
            if 'duplicate column name' in message or 'already exists' in message:
                continue
        except Exception:
            continue
    conn.commit()


def get_connection() -> sqlite3.Connection:
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    global SCHEMA_INITIALIZED
    if not SCHEMA_INITIALIZED:
        ensure_schema(conn)
        SCHEMA_INITIALIZED = True
    return conn

def _table_columns(cursor: sqlite3.Cursor, table: str) -> set[str]:
    cursor.execute(f'PRAGMA table_info("{table}")')
    return {row[1] for row in cursor.fetchall()}

def _students_pk_info(cursor: sqlite3.Cursor) -> dict:
    cols = _table_columns(cursor, "students")
    has_id = "id" in cols
    has_student_id = "student_id" in cols
    if has_student_id:
        pk_col = "student_id"
    elif has_id:
        pk_col = "id"
    else:
        pk_col = None
    return {"has_id": has_id, "has_student_id": has_student_id, "pk_col": pk_col}

def _pk_select_expr(alias: str, info: dict) -> str:
    if info["has_student_id"] and info["has_id"]:
        return f"COALESCE({alias}.student_id, {alias}.id)"
    if info["has_student_id"]:
        return f"{alias}.student_id"
    if info["has_id"]:
        return f"{alias}.id"
    return "NULL"

def _pk_join_condition(alias_s: str, alias_a: str, info: dict) -> str:
    if info["has_student_id"] and info["has_id"]:
        return f"(({alias_s}.student_id = {alias_a}.student_id) OR ({alias_s}.id = {alias_a}.student_id))"
    if info["has_student_id"]:
        return f"{alias_s}.student_id = {alias_a}.student_id"
    if info["has_id"]:
        return f"{alias_s}.id = {alias_a}.student_id"
    return "1=0"

def _enrollment_columns(cursor: sqlite3.Cursor) -> Dict[str, Optional[str]]:
    cols = _table_columns(cursor, "enrollments") if cursor else set()
    student_col = None
    class_col = None
    if "student_id" in cols:
        student_col = "student_id"
    elif "studentId" in cols:
        student_col = "studentId"
    if "class_id" in cols:
        class_col = "class_id"
    elif "classId" in cols:
        class_col = "classId"
    return {"student": student_col, "class": class_col}

def _enrollment_join_condition(alias_s: str, alias_e: str, info: dict, enrollment_student_col: str) -> str:
    conditions: List[str] = []
    if info.get("has_student_id"):
        conditions.append(f"{alias_s}.student_id = {alias_e}.{enrollment_student_col}")
    if info.get("has_id"):
        conditions.append(f"{alias_s}.id = {alias_e}.{enrollment_student_col}")
    if not conditions:
        return "1=0"
    if len(conditions) == 1:
        return conditions[0]
    return f"({conditions[0]} OR {conditions[1]})"


def _normalize_source(value: Optional[str]) -> str:
    if not value:
        return "manual"
    lowered = value.lower().strip()
    if lowered in {"manual", "teacher"}:
        return "manual"
    if lowered in {"recognized", "systemrecognized", "system"}:
        return "recognized"
    return lowered

def init_db() -> None:
    os.makedirs(DB_DIR, exist_ok=True)
    with closing(get_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.executescript(
            """
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                username TEXT UNIQUE,
                password TEXT,
                name TEXT,
                email TEXT,
                phone TEXT,
                -- some repos use snake_case, others camelCase; we keep both for compatibility
                roll_no TEXT,
                class_code TEXT,
                rollNo TEXT,
                classCode TEXT,
                course TEXT,
                year INTEGER,
                embedding TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS attendance_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER,
                matched INTEGER,
                distance REAL,
                score REAL,
                source TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS verification_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject_id TEXT,
                distance REAL,
                score REAL,
                match INTEGER,
                threshold REAL,
                source TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

        # Ensure required columns exist on legacy tables (idempotent)
        def ensure_column(table: str, column: str, coltype: str) -> None:
            cursor.execute(f'PRAGMA table_info("{table}")')
            existing = {row[1] for row in cursor.fetchall()}
            if column not in existing:
                cursor.execute(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {coltype}')

        ensure_column("students", "course", "TEXT")
        ensure_column("students", "year", "INTEGER")
        ensure_column("students", "embedding", "TEXT")
        ensure_column("students", "username", "TEXT")
        ensure_column("students", "password", "TEXT")
        ensure_column("students", "rollNo", "TEXT")
        ensure_column("students", "classCode", "TEXT")
        ensure_column("students", "roll_no", "TEXT")
        ensure_column("students", "class_code", "TEXT")
        # Critical for joins in /attendance/latest etc.
        ensure_column("students", "student_id", "INTEGER")
        info = _students_pk_info(cursor)
        if info["has_student_id"] and info["has_id"]:
            cursor.execute("UPDATE students SET student_id = id WHERE student_id IS NULL")

        cursor.executescript(
            """
            CREATE TABLE IF NOT EXISTS classes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher_id INTEGER,
                class_name TEXT NOT NULL,
                section TEXT,
                subject TEXT,
                start_date TEXT,
                end_date TEXT,
                description TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS enrollments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                class_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                enrollment_id TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(class_id, student_id)
            );

            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                class_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                attendance_date TEXT NOT NULL,
                period_id TEXT DEFAULT '',
                status TEXT NOT NULL CHECK(status IN ('Present', 'Absent', 'Late', 'Excused')),
                source TEXT NOT NULL DEFAULT 'Teacher' CHECK(source IN ('Teacher', 'SystemRecognized')),
                recognized_at TEXT,
                recognized_confidence REAL,
                recognized_device_id TEXT,
                marked_by_user_id INTEGER,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(class_id, student_id, attendance_date, period_id)
            );
            """
        )

        conn.commit()

# ----------------------------
# Utilities
# ----------------------------
def _password_hash(password: str) -> str:
    return generate_password_hash(password)

def _json_response(message: str, status: int = 200):
    return jsonify({"message": message}), status

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# FaceNet embedding helpers
def _facenet_embed_from_bytes(image_bytes: bytes, content_type: Optional[str]) -> List[float]:
    """
    Prefer multipart -> /embed_upload (recommended),
    fallback to /embed with multipart if service only exposes /embed.
    """
    files = {"image": ("image", image_bytes, content_type or "application/octet-stream")}
    try:
        r = requests.post(f"{FACENET_URL}/embed_upload", files=files, timeout=30)
        if r.status_code == 404:
            r = requests.post(f"{FACENET_URL}/embed", files=files, timeout=30)
    except requests.RequestException as exc:
        raise RuntimeError(f"facenet service unavailable: {exc}") from exc

    if r.status_code != 200:
        detail = r.text
        try:
            detail = json.dumps(r.json())
        except Exception:
            pass
        raise RuntimeError(f"facenet embed failed ({r.status_code}): {detail}")

    data = r.json()
    embedding = data.get("embedding")
    if not isinstance(embedding, list) or not embedding:
        raise RuntimeError("facenet embed returned empty embedding")
    return [float(v) for v in embedding]

def _facenet_embed_from_data(image_value: str) -> List[float]:
    payload = {"image": image_value}
    try:
        r = requests.post(f"{FACENET_URL}/embed", json=payload, timeout=30)
    except requests.RequestException as exc:
        raise RuntimeError(f"facenet service unavailable: {exc}") from exc

    if r.status_code != 200:
        detail = r.text
        try:
            detail = json.dumps(r.json())
        except Exception:
            pass
        raise RuntimeError(f"facenet embed failed ({r.status_code}): {detail}")

    data = r.json()
    embedding = data.get("embedding")
    if not isinstance(embedding, list) or not embedding:
        raise RuntimeError("facenet embed returned empty embedding")
    return [float(v) for v in embedding]

def _cosine_distance(vector_a: Iterable[float], vector_b: Iterable[float]) -> float:
    a = list(vector_a)
    b = list(vector_b)
    if len(a) != len(b) or not a:
        return 1.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 1.0
    cosine = max(min(dot / (norm_a * norm_b), 1.0), -1.0)
    return 1.0 - cosine

def _load_students_with_embeddings(cursor: sqlite3.Cursor) -> List[Dict[str, Any]]:
    info = _students_pk_info(cursor)
    pk_expr = _pk_select_expr("s", info)
    cursor.execute(
        f"""
        SELECT
            {pk_expr} AS studentId,
            COALESCE(s.username, u.username) AS username,
            s.name,
            COALESCE(s.roll_no, s.rollNo) AS roll_no,
            COALESCE(s.embedding, '') AS embedding
        FROM students AS s
        LEFT JOIN users AS u ON u.user_id = s.user_id
        """
    )
    students: List[Dict[str, Any]] = []
    for row in cursor.fetchall():
        embedding_text = row["embedding"]
        if not embedding_text:
            continue
        try:
            embedding = json.loads(embedding_text)
        except json.JSONDecodeError:
            continue
        if not isinstance(embedding, list) or not embedding:
            continue
        students.append(
            {
                "studentId": row["studentId"],
                "username": row["username"],
                "name": row["name"],
                "roll_no": row["roll_no"],
                "embedding": [float(v) for v in embedding],
            }
        )
    return students

def _extract_image_payload() -> Tuple[Optional[str], Optional[Dict[str, Any]], Optional[str]]:
    """Return a data URL representation of the uploaded image or JSON payload."""
    if request.files:
        file = request.files.get('image') or request.files.get('photo')
        if not file:
            return None, None, 'image file required'
        data = base64.b64encode(file.read()).decode('utf-8')
        mimetype = file.mimetype or 'image/jpeg'
        payload_meta: Dict[str, Any] = dict(request.form) if request.form else {}
        return f'data:{mimetype};base64,{data}', payload_meta, None

    payload = request.get_json(force=True, silent=True)
    if not payload:
        return None, None, 'invalid json'

    image_value = payload.get('image') or payload.get('photo')
    if not image_value:
        return None, None, "field 'image' is required"
    if isinstance(image_value, str) and not image_value.startswith('data:'):
        image_value = 'data:image/jpeg;base64,' + image_value
    return image_value, payload, None

# ----------------------------
# Routes
# ----------------------------
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True})

@app.route("/api/register-student", methods=["POST"])
def register_student():
    # Accept multipart (preferred) or JSON fallback with data URL/base64
    form_data = request.form if request.form else None
    files = request.files if request.files else None
    json_payload = request.get_json(force=True, silent=True) if not form_data else None

    def _get(field: str) -> Optional[str]:
        if form_data is not None:
            return form_data.get(field)
        if json_payload is not None:
            return json_payload.get(field)
        return None

    required_fields = ["username", "password", "name", "email", "phone", "rollNo", "classCode", "course", "year"]
    missing = [field for field in required_fields if not _get(field)]
    if missing:
        return jsonify({"error": f"missing fields: {', '.join(missing)}"}), 400

    # Photo handling
    photo = files.get("photo") if files else None
    if photo is None and json_payload is not None:
        photo_data = json_payload.get("photo")
        if photo_data:
            try:
                if isinstance(photo_data, str) and photo_data.startswith("data:"):
                    embedding = _facenet_embed_from_data(photo_data)
                else:
                    data_url = "data:image/jpeg;base64," + str(photo_data)
                    embedding = _facenet_embed_from_data(data_url)
            except RuntimeError as exc:
                return jsonify({"error": str(exc)}), 502
        else:
            return jsonify({"error": "photo is required"}), 400
    elif photo is None:
        return jsonify({"error": "photo is required"}), 400
    else:
        try:
            embedding = _facenet_embed_from_bytes(photo.read(), photo.mimetype or "image/jpeg")
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 502

    # Fields
    username = (_get("username") or "").strip()
    password_hash = _password_hash(_get("password") or "")
    name = (_get("name") or "").strip()
    email = (_get("email") or "").strip()
    phone = (_get("phone") or "").strip()
    roll_no = (_get("rollNo") or "").strip()
    class_code = (_get("classCode") or "").strip()
    course = (_get("course") or "").strip()
    try:
        year_value = int(_get("year"))
    except (TypeError, ValueError):
        return jsonify({"error": "year must be a number"}), 400

    embedding_json = json.dumps(embedding)

    # Insert
    try:
        with closing(get_connection()) as conn:
            cursor = conn.cursor()
            info = _students_pk_info(cursor)
            student_pk: Optional[int] = None

            # Optional users table
            try:
                cursor.execute(
                    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                    (username, password_hash, "student"),
                )
                user_id = cursor.lastrowid
            except sqlite3.OperationalError:
                user_id = None
            except sqlite3.IntegrityError as exc:
                return jsonify({"error": "username already exists", "detail": str(exc)}), 409

            try:
                cursor.execute(
                    """
                    INSERT INTO students (
                        user_id, username, password, name, email, phone,
                        roll_no, class_code, rollNo, classCode, course, year, embedding
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        user_id,
                        username,
                        password_hash,
                        name,
                        email,
                        phone,
                        roll_no,
                        class_code,
                        roll_no,
                        class_code,
                        course,
                        year_value,
                        embedding_json,
                    ),
                )
                student_pk = cursor.lastrowid
            except sqlite3.OperationalError:
                cursor.execute(
                    """
                    INSERT INTO students (
                        username, password, name, email, phone,
                        rollNo, classCode, course, year, embedding
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        username,
                        password_hash,
                        name,
                        email,
                        phone,
                        roll_no,
                        class_code,
                        course,
                        year_value,
                        embedding_json,
                    ),
                )
                student_pk = cursor.lastrowid

            if student_pk is not None and info["has_student_id"] and info["has_id"]:
                cursor.execute(
                    "UPDATE students SET student_id = COALESCE(student_id, id) WHERE id = ?",
                    (student_pk,),
                )

            conn.commit()
    except sqlite3.IntegrityError as exc:
        return jsonify({"error": "student already exists", "detail": str(exc)}), 409

    return jsonify({"username": username, "name": name, "rollNo": roll_no}), 201

@app.route("/api/students/<int:student_id>/embedding", methods=["POST", "PATCH"])
def update_student_embedding(student_id: int):
    """Update a student's embedding by uploading a photo or sending a data URL."""
    with closing(get_connection()) as conn:
        cur = conn.cursor()
        info = _students_pk_info(cur)
        pk_expr = _pk_select_expr("s", info)
        cur.execute(
            f"SELECT {pk_expr} AS sid FROM students s WHERE {pk_expr} = ?",
            (student_id,),
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "student not found"}), 404
    pk_col = info.get("pk_col")
    if not pk_col:
        return jsonify({"error": "students table has no PK column (id or student_id)"}), 500

    if request.files:
        file = request.files.get("photo") or request.files.get("image")
        if not file:
            return jsonify({"error": "photo file required"}), 400
        try:
            emb = _facenet_embed_from_bytes(file.read(), file.mimetype or "image/jpeg")
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 502
    else:
        payload = request.get_json(force=True, silent=True)
        if not payload:
            return jsonify({"error": "invalid json"}), 400
        image_value = payload.get("photo") or payload.get("image")
        if not image_value:
            return jsonify({"error": "photo is required"}), 400
        if isinstance(image_value, str) and not image_value.startswith("data:"):
            image_value = "data:image/jpeg;base64," + image_value
        try:
            emb = _facenet_embed_from_data(image_value)
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 502

    with closing(get_connection()) as conn:
        cur = conn.cursor()
        cur.execute(
            f'UPDATE students SET embedding = ? WHERE "{pk_col}" = ?',
            (json.dumps(emb), student_id),
        )
        conn.commit()

    return jsonify({"ok": True, "studentId": student_id})


@app.route("/api/register-teacher", methods=["POST"])
def register_teacher():
    payload = request.get_json(force=True, silent=True)
    if not payload:
        return jsonify({"error": "invalid json"}), 400

    required = ["username", "password", "name", "email", "phone", "department", "designation"]
    missing = [field for field in required if not payload.get(field)]
    if missing:
        return jsonify({"error": f"missing fields: {', '.join(missing)}"}), 400

    username = payload["username"].strip()
    password_hash = _password_hash(payload["password"])
    name = payload["name"].strip()
    email = payload["email"].strip()
    phone = payload["phone"].strip()
    department = payload["department"].strip()
    designation = payload["designation"].strip()

    try:
        with closing(get_connection()) as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(
                    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                    (username, password_hash, "teacher"),
                )
                user_id = cursor.lastrowid
            except sqlite3.OperationalError:
                user_id = None
            except sqlite3.IntegrityError as exc:
                return jsonify({"error": "username already exists", "detail": str(exc)}), 409

            try:
                cursor.execute(
                    """
                    INSERT INTO teachers (user_id, name, email, phone, department, designation)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (user_id, name, email, phone, department, designation),
                )
            except sqlite3.OperationalError:
                cursor.execute(
                    """
                    INSERT INTO teachers (name, email, phone, department, designation)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (name, email, phone, department, designation),
                )
            conn.commit()
    except sqlite3.IntegrityError as exc:
        return jsonify({"error": "teacher already exists", "detail": str(exc)}), 409

    return _json_response("teacher registered", 201)

@app.route("/api/students", methods=["GET"])
def list_students():
    class_id_value = request.args.get("classId")
    class_id: Optional[int]
    if class_id_value in (None, ""):
        class_id = None
    else:
        try:
            class_id = int(class_id_value)
        except (TypeError, ValueError):
            return jsonify({"error": "classId must be an integer"}), 400

    with closing(get_connection()) as conn:
        cursor = conn.cursor()
        info = _students_pk_info(cursor)
        pk_col = info.get("pk_col")
        if pk_col is None:
            return jsonify({"error": "students table missing primary key column"}), 500
        student_cols = _table_columns(cursor, "students")
        has_user_id = "user_id" in student_cols
        select_user = "u.username AS user_username" if has_user_id else "NULL AS user_username"
        join_users = "LEFT JOIN users AS u ON u.user_id = s.user_id" if has_user_id else ""

        rows = []
        if class_id is not None:
            enrollment_cols = _enrollment_columns(cursor)
            student_col = enrollment_cols.get("student")
            class_col = enrollment_cols.get("class")
            if not student_col or not class_col:
                return jsonify({"error": "enrollments schema incomplete"}), 500
            cursor.execute(
                f"SELECT {student_col} AS student_id FROM enrollments WHERE {class_col} = ?",
                (class_id,),
            )
            enrolled_ids = [row["student_id"] for row in cursor.fetchall() if row["student_id"] is not None]
            if enrolled_ids:
                placeholders = ",".join(["?"] * len(enrolled_ids))
                query = f"SELECT s.*, {select_user} FROM students AS s {join_users} WHERE s.{pk_col} IN ({placeholders}) ORDER BY s.name ASC"
                cursor.execute(query, enrolled_ids)
                rows = cursor.fetchall()
        else:
            query = f"SELECT s.*, {select_user} FROM students AS s {join_users} ORDER BY s.name ASC"
            cursor.execute(query)
            rows = cursor.fetchall()

    students: List[Dict[str, Optional[str]]] = []
    for row in rows:
        row_dict = dict(row)
        student_id_out = row_dict.get(pk_col)
        if student_id_out is None:
            student_id_out = row_dict.get("student_id")
        name = row_dict.get("name") or row_dict.get("full_name")
        roll_no = row_dict.get("roll_no") or row_dict.get("rollNo")
        username = row_dict.get("username") or row_dict.get("user_username")
        email = row_dict.get("email")
        if student_id_out is not None:
            try:
                student_id_out = int(student_id_out)
            except (TypeError, ValueError):
                pass
        students.append({
            "studentId": student_id_out,
            "username": username,
            "name": name,
            "rollNo": roll_no,
            "email": email,
        })

    students.sort(key=lambda item: (item["name"] or "").lower())
    return jsonify({"students": students})

@app.route("/api/attendance/manual", methods=["POST"])
def attendance_manual():
    payload = request.get_json(force=True, silent=True)
    if not payload:
        return jsonify({"error": "invalid json"}), 400

    class_id_value = payload.get("classId")
    try:
        class_id = int(class_id_value)
    except (TypeError, ValueError):
        return jsonify({"error": "classId must be an integer"}), 400

    records_payload = payload.get("records")
    if not isinstance(records_payload, list) or not records_payload:
        return jsonify({"error": "records must be a non-empty list"}), 400

    now = datetime.now()
    date_value = payload.get("date")
    if date_value:
        try:
            attendance_date = datetime.strptime(date_value, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "date must be formatted as YYYY-MM-DD"}), 400
    else:
        attendance_date = now.date()
    date_str = attendance_date.isoformat()

    time_value = payload.get("time")
    if time_value:
        parsed_time = None
        for fmt in ("%H:%M:%S", "%H:%M"):
            try:
                parsed_time = datetime.strptime(time_value, fmt).time()
                break
            except ValueError:
                continue
        if parsed_time is None:
            return jsonify({"error": "time must be HH:MM or HH:MM:SS"}), 400
        attendance_time = parsed_time
    else:
        attendance_time = now.time()
    time_str = attendance_time.strftime("%H:%M:%S")

    normalized_records = []
    for entry in records_payload:
        if not isinstance(entry, dict):
            continue
        student_value = entry.get("studentId")
        try:
            student_id = int(student_value)
        except (TypeError, ValueError):
            return jsonify({"error": "each record requires numeric studentId"}), 400
        status_value = (entry.get("status") or "absent").strip().lower()
        if status_value not in {"present", "absent", "late"}:
            return jsonify({"error": "status must be present, absent, or late"}), 400
        recognized_name = entry.get("recognizedName")
        if isinstance(recognized_name, str):
            recognized_name = recognized_name.strip() or None
        remark_value = entry.get("remark")
        if isinstance(remark_value, str):
            remark_value = remark_value.strip() or None
        normalized_records.append(
            {
                "student_id": student_id,
                "status": status_value,
                "recognized_name": recognized_name,
                "remark": remark_value,
            }
        )

    if not normalized_records:
        return jsonify({"error": "no valid attendance records supplied"}), 400

    with closing(get_connection()) as conn:
        cursor = conn.cursor()
        enrollment_cols = _enrollment_columns(cursor)
        student_col = enrollment_cols.get("student")
        class_col = enrollment_cols.get("class")
        if not student_col or not class_col:
            return jsonify({"error": "enrollments schema incomplete"}), 500

        cursor.execute(
            f"SELECT {student_col} AS student_id FROM enrollments WHERE {class_col} = ?",
            (class_id,),
        )
        enrolled_ids = {
            int(row["student_id"]) for row in cursor.fetchall() if row["student_id"] is not None
        }

        missing = [record["student_id"] for record in normalized_records if record["student_id"] not in enrolled_ids]
        if missing:
            return jsonify({"error": "students not enrolled in class", "invalidStudentIds": missing}), 400

        created = 0
        updated = 0
        status_counter: Counter[str] = Counter()
        now_iso = _now_iso()

        for record in normalized_records:
            status_counter[record["status"]] += 1
            cursor.execute(
                """
                SELECT id FROM attendance
                WHERE class_id = ? AND student_id = ? AND date = ?
                """,
                (class_id, record["student_id"], date_str),
            )
            existing = cursor.fetchone()
            source_value = _normalize_source("manual")
            if existing:
                cursor.execute(
                    """
                    UPDATE attendance
                    SET time = ?, status = ?, recognized_name = ?, source = ?, remark = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        time_str,
                        record["status"],
                        record["recognized_name"],
                        source_value,
                        record["remark"],
                        now_iso,
                        existing["id"],
                    ),
                )
                updated += 1
            else:
                cursor.execute(
                    """
                    INSERT INTO attendance (
                        student_id, class_id, date, time, status, recognized_name, source, remark, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        record["student_id"],
                        class_id,
                        date_str,
                        time_str,
                        record["status"],
                        record["recognized_name"],
                        source_value,
                        record["remark"],
                        now_iso,
                        now_iso,
                    ),
                )
                created += 1

            matched = 1 if record["status"] == "present" else 0
            cursor.execute(
                """
                INSERT INTO attendance_logs (student_id, matched, distance, score, source, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    record["student_id"],
                    matched,
                    None,
                    1.0 if matched else 0.0,
                    "manual",
                    now_iso,
                ),
            )

        conn.commit()

    response = {
        "classId": class_id,
        "date": date_str,
        "time": time_str,
        "created": created,
        "updated": updated,
        "saved": created + updated,
        "total": created + updated,
        "statusSummary": dict(status_counter),
    }
    return jsonify(response)

# >>> NEW: /api/class-students — returns only the enrolled students for a class
@app.route("/api/class-students", methods=["GET"])
def class_students_api():
    class_id_param = request.args.get("class_id") or request.args.get("classId")
    try:
        class_id = int(class_id_param)
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "class_id is required and must be an integer"}), 400

    with closing(get_connection()) as conn:
        cursor = conn.cursor()

        # fetch students enrolled in class
        cursor.execute(
            """
            SELECT s.id, s.name, COALESCE(s.roll_no, s.rollNo) AS roll_no, s.email
            FROM students s
            JOIN enrollments e ON e.student_id = s.id
            WHERE e.class_id = ?
            ORDER BY s.name COLLATE NOCASE
            """,
            (class_id,),
        )
        rows = cursor.fetchall()

    students = [
        {"id": row["id"], "name": row["name"], "roll_no": row["roll_no"], "email": row["email"]}
        for row in rows
    ]

    return jsonify({"ok": True, "data": {"students": students}})

@app.route("/api/classes", methods=["GET"])
def list_classes_api():
    # >>> NEW: back-compat for /api/classes?class_id=..&with_students=1
    class_id_param = request.args.get("class_id") or request.args.get("classId")
    with_students = (request.args.get("with_students") or "").lower() not in ("", "0", "false")

    if class_id_param and with_students:
        try:
            class_id = int(class_id_param)
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "class_id must be an integer"}), 400

        with closing(get_connection()) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, class_name, section, subject, schedule_info, created_at
                FROM classes
                WHERE id = ?
                """,
                (class_id,),
            )
            cls = cursor.fetchone()
            if not cls:
                return jsonify({"ok": False, "error": "class not found"}), 404

            cursor.execute(
                """
                SELECT s.id, s.name, COALESCE(s.roll_no, s.rollNo) AS roll_no, s.email
                FROM students s
                JOIN enrollments e ON e.student_id = s.id
                WHERE e.class_id = ?
                ORDER BY s.name COLLATE NOCASE
                """,
                (class_id,),
            )
            students = [
                {"id": r["id"], "name": r["name"], "roll_no": r["roll_no"], "email": r["email"]}
                for r in cursor.fetchall()
            ]

        return jsonify(
            {
                "ok": True,
                "data": {
                    "class": {
                        "id": cls["id"],
                        "class_name": cls["class_name"],
                        "section": cls["section"],
                        "subject": cls["subject"],
                        "schedule_info": cls["schedule_info"],
                        "created_at": cls["created_at"],
                    },
                    "students": students,
                },
            }
        )

    # default: list all classes
    with closing(get_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                c.id,
                c.class_name,
                c.section,
                c.subject,
                c.schedule_info,
                c.created_at,
                COUNT(e.id) AS student_count
            FROM classes AS c
            LEFT JOIN enrollments AS e ON e.class_id = c.id
            GROUP BY c.id
            ORDER BY c.created_at DESC
            """
        )
        rows = cursor.fetchall()

    classes: List[Dict[str, Any]] = []
    for row in rows:
        keys = set(row.keys())
        classes.append(
            {
                "id": row["id"],
                "className": row["class_name"] if "class_name" in keys else row["id"],
                "section": row["section"] if "section" in keys else None,
                "subject": row["subject"] if "subject" in keys else None,
                "scheduleInfo": row["schedule_info"] if "schedule_info" in keys else None,
                "createdAt": row["created_at"] if "created_at" in keys else None,
                "studentCount": row["student_count"],
            }
        )
    return jsonify({"classes": classes})


@app.route("/api/classes", methods=["POST"])
def create_class_api():
    payload = request.get_json(force=True, silent=True)
    if not payload:
        return jsonify({"error": "invalid json"}), 400

    class_name = (payload.get("className") or payload.get("class_name") or "").strip()
    if not class_name:
        return jsonify({"error": "className is required"}), 400

    section = (payload.get("section") or "").strip() or None
    subject = (payload.get("subject") or "").strip() or None
    schedule_info = (payload.get("scheduleInfo") or payload.get("schedule_info") or "").strip() or None
    created_at = _now_iso()

    try:
        with closing(get_connection()) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO classes (class_name, section, subject, schedule_info, created_at) VALUES (?, ?, ?, ?, ?)",
                (class_name, section, subject, schedule_info, created_at),
            )
            class_id = cursor.lastrowid
            cursor.execute(
                """
                SELECT
                    c.id,
                    c.class_name,
                    c.section,
                    c.subject,
                    c.schedule_info,
                    c.created_at
                FROM classes AS c
                WHERE c.id = ?
                """,
                (class_id,),
            )
            row = cursor.fetchone()
            conn.commit()
    except sqlite3.OperationalError as exc:
        return jsonify({"error": "unable to create class", "detail": str(exc)}), 500

    if not row:
        return jsonify({"error": "class creation failed"}), 500

    keys = set(row.keys())
    created = {
        "id": row["id"],
        "className": row["class_name"] if "class_name" in keys else class_name,
        "section": row["section"] if "section" in keys else section,
        "subject": row["subject"] if "subject" in keys else subject,
        "scheduleInfo": row["schedule_info"] if "schedule_info" in keys else schedule_info,
        "createdAt": row["created_at"] if "created_at" in keys else created_at,
        "studentCount": 0,
    }
    return jsonify({"class": created}), 201


@app.route("/api/attendance/checkin", methods=["POST"])
def attendance_checkin():
    payload = request.get_json(force=True, silent=True)
    if not payload:
        return jsonify({"error": "invalid json"}), 400

    created_at = _now_iso()
    with closing(get_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO attendance_logs (student_id, matched, distance, score, source, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (payload.get("studentId"), 1, None, None, "gps", created_at),
        )
        conn.commit()
    return jsonify({"ok": True, "createdAt": created_at})

# -------------
# Facenet proxy
# -------------
def _forward_request(url: str, *, json_payload=None, files_payload=None):
    try:
        response = requests.post(url, json=json_payload, files=files_payload, timeout=15)
    except requests.RequestException as exc:
        return None, jsonify({"error": "facenet service unavailable", "detail": str(exc)}), 502

    content_type = response.headers.get("Content-Type", "")
    if "application/json" in content_type.lower():
        try:
            body = response.json()
        except ValueError:
            body = {"raw": response.text}
    else:
        body = {"raw": response.text}

    return body, jsonify(body), response.status_code

@app.route("/api/facenet/verify", methods=["POST"])
def facenet_verify():
    payload = None
    source_value = "json"
    files_payload = None

    if request.files:
        files_payload = {}
        for key in ("image_a", "image_b"):
            file = request.files.get(key)
            if file:
                files_payload[key] = (file.filename or key, file.read(), file.content_type or "application/octet-stream")
        source_value = "upload"
        body, response, status = _forward_request(f"{FACENET_URL}/verify_upload", files_payload=files_payload)
    else:
        payload = request.get_json(force=True, silent=True)
        if not payload:
            return jsonify({"error": "invalid json"}), 400
        source_value = payload.get("source", "json")
        body, response, status = _forward_request(f"{FACENET_URL}/verify", json_payload=payload)

    if body is not None and status == 200:
        with closing(get_connection()) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO verification_logs (
                    subject_id, distance, score, match, threshold, source, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload.get("subjectId") if payload else None,
                    body.get("distance"),
                    body.get("score"),
                    int(body.get("match")) if isinstance(body.get("match"), bool) else None,
                    body.get("threshold", MATCH_THRESHOLD),
                    source_value,
                    _now_iso(),
                ),
            )
            conn.commit()
    return response, status

@app.route("/api/attendance/mark", methods=["POST"])
def attendance_mark():
    image_value, meta_payload, error = _extract_image_payload()
    if error:
        return jsonify({"error": error}), 400
    if not image_value:
        return jsonify({"error": "image payload missing"}), 400

    meta_payload = meta_payload or {}
    source_hint = (meta_payload.get("source") or "webcam").strip() or "webcam"
    class_id: Optional[int] = None
    class_hint = meta_payload.get("classId") or meta_payload.get("class_id")
    if class_hint not in (None, ""):
        try:
            class_id = int(class_hint)
        except (TypeError, ValueError):
            class_id = None

    try:
        embedding = _facenet_embed_from_data(image_value)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502

    with closing(get_connection()) as conn:
        cursor = conn.cursor()
        students = _load_students_with_embeddings(cursor)

    if not students:
        created_at = _now_iso()
        with closing(get_connection()) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO attendance_logs (student_id, matched, distance, score, source, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    None,
                    0,
                    None,
                    None,
                    source_hint,
                    created_at,
                ),
            )
            conn.commit()
        return jsonify(
            {
                "matched": False,
                "reason": "no_students_with_embeddings",
                "threshold": MATCH_THRESHOLD,
                "createdAt": created_at,
                "source": _normalize_source(source_hint),
            }
        )

    best: Optional[Dict[str, Any]] = None
    for student in students:
        distance = _cosine_distance(embedding, student['embedding'])
        if best is None or distance < best['distance']:
            best = {
                'studentId': student['studentId'],
                'username': student.get('username'),
                'name': student.get('name'),
                'rollNo': student.get('roll_no'),
                'distance': distance,
            }

    if best is None:
        created_at = _now_iso()
        with closing(get_connection()) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO attendance_logs (student_id, matched, distance, score, source, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    None,
                    0,
                    None,
                    None,
                    source_hint,
                    created_at,
                ),
            )
            conn.commit()
        return jsonify(
            {
                "matched": False,
                "reason": "no_students_with_embeddings",
                "threshold": MATCH_THRESHOLD,
                "createdAt": created_at,
                "source": _normalize_source(source_hint),
            }
        )

    distance_value = float(best['distance'])
    try:
        student_identifier = int(best['studentId']) if best.get('studentId') is not None else None
    except (TypeError, ValueError):
        student_identifier = None
    else:
        best['studentId'] = student_identifier
    matched = distance_value <= MATCH_THRESHOLD
    score = max(0.0, 1.0 - distance_value)
    created_at = _now_iso()

    attendance_recorded = False
    normalized_source = _normalize_source("recognized" if matched else "manual")
    recognized_name = None
    if matched:
        recognized_name = best.get('name') or best.get('username') or best.get('rollNo')

    with closing(get_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO attendance_logs (student_id, matched, distance, score, source, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                student_identifier if matched else None,
                1 if matched else 0,
                distance_value,
                score,
                source_hint,
                created_at,
            ),
        )

        if matched and class_id is not None:
            enrollment_cols = _enrollment_columns(cursor)
            student_col = enrollment_cols.get("student")
            class_col = enrollment_cols.get("class")
            if student_col and class_col:
                cursor.execute(
                    f"SELECT 1 FROM enrollments WHERE {class_col} = ? AND {student_col} = ? LIMIT 1",
                    (class_id, student_identifier),
                )
                if cursor.fetchone():
                    try:
                        created_dt = datetime.fromisoformat(created_at)
                    except ValueError:
                        created_dt = datetime.now(timezone.utc)
                    date_str = created_dt.date().isoformat()
                    time_str = created_dt.time().strftime("%H:%M:%S")
                    cursor.execute(
                        """
                        SELECT id FROM attendance
                        WHERE class_id = ? AND student_id = ? AND date = ?
                        """,
                        (class_id, student_identifier, date_str),
                    )
                    existing = cursor.fetchone()
                    if existing:
                        cursor.execute(
                            """
                            UPDATE attendance
                            SET time = ?, status = ?, recognized_name = ?, source = ?, updated_at = ?
                            WHERE id = ?
                            """,
                            (
                                time_str,
                                'present',
                                recognized_name,
                                _normalize_source('recognized'),
                                created_at,
                                existing['id'],
                            ),
                        )
                    else:
                        cursor.execute(
                            """
                            INSERT INTO attendance (
                                student_id, class_id, date, time, status, recognized_name, source, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (
                                student_identifier,
                                class_id,
                                date_str,
                                time_str,
                                'present',
                                recognized_name,
                                _normalize_source('recognized'),
                                created_at,
                                created_at,
                            ),
                        )
                    attendance_recorded = True
        conn.commit()

    response_body = {
        "matched": matched,
        "studentId": student_identifier if matched else None,
        "username": best.get('username') if matched else None,
        "name": best.get('name') if matched else None,
        "distance": distance_value,
        "score": score,
        "threshold": MATCH_THRESHOLD,
        "createdAt": created_at,
        "source": normalized_source,
        "recognizedName": recognized_name if matched else None,
        "classId": class_id,
        "attendanceRecorded": attendance_recorded,
    }
    return jsonify(response_body)

@app.route("/api/attendance/history", methods=["GET"])
def attendance_history_api():
    page_value = request.args.get("page", default="1")
    per_page_value = request.args.get("perPage", default="20")
    try:
        page = max(1, int(page_value))
    except (TypeError, ValueError):
        return jsonify({"error": "page must be an integer"}), 400
    try:
        per_page = int(per_page_value)
    except (TypeError, ValueError):
        return jsonify({"error": "perPage must be an integer"}), 400
    per_page = max(1, min(per_page, 100))
    offset = (page - 1) * per_page

    class_id_param = request.args.get("classId")
    student_query = (request.args.get("student") or request.args.get("studentQuery") or "").strip()
    from_date = request.args.get("fromDate") or request.args.get("from")
    to_date = request.args.get("toDate") or request.args.get("to")

    class_id = None
    if class_id_param not in (None, ""):
        try:
            class_id = int(class_id_param)
        except (TypeError, ValueError):
            return jsonify({"error": "classId must be an integer"}), 400

    try:
        with closing(get_connection()) as conn:
            cursor = conn.cursor()
            info = _students_pk_info(cursor)
            join_condition = _pk_join_condition("s", "a", info)
            pk_expr = _pk_select_expr("s", info)

            conditions: List[str] = []
            params: List[Any] = []
            if class_id is not None:
                conditions.append("a.class_id = ?")
                params.append(class_id)
            if from_date:
                conditions.append("a.date >= ?")
                params.append(from_date)
            if to_date:
                conditions.append("a.date <= ?")
                params.append(to_date)
            if student_query:
                like_value = f"%{student_query.lower()}%"
                conditions.append("(LOWER(s.name) LIKE ? OR LOWER(a.recognized_name) LIKE ? OR LOWER(COALESCE(s.roll_no, '')) LIKE ?)")
                params.extend([like_value, like_value, like_value])

            where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""

            count_query = f"""
                SELECT COUNT(*)
                FROM attendance AS a
                LEFT JOIN students AS s ON {join_condition}
                LEFT JOIN classes AS c ON c.id = a.class_id
                {where_clause}
            """
            cursor.execute(count_query, params)
            total = cursor.fetchone()[0]

            data_query = f"""
                SELECT
                    a.id,
                    a.student_id,
                    a.class_id,
                    a.date,
                    a.time,
                    a.status,
                    a.recognized_name,
                    a.source,
                    a.created_at,
                    a.updated_at,
                    {pk_expr} AS student_primary_id,
                    s.name AS student_name,
                    s.roll_no,
                    s.email,
                    c.class_name,
                    c.section,
                    c.subject
                FROM attendance AS a
                LEFT JOIN students AS s ON {join_condition}
                LEFT JOIN classes AS c ON c.id = a.class_id
                {where_clause}
                ORDER BY a.date DESC, COALESCE(a.time, substr(a.created_at, 12, 8), '') DESC, a.id DESC
                LIMIT ? OFFSET ?
            """
            cursor.execute(data_query, params + [per_page, offset])
            rows = cursor.fetchall()
    except sqlite3.OperationalError as exc:
        return jsonify({"error": "attendance history unavailable", "detail": str(exc)}), 500

    format_value = (request.args.get("format") or "").lower()

    items: List[Dict[str, Any]] = []
    for row in rows:
        row_dict = dict(row)
        student_id_out = row_dict.get("student_primary_id") or row_dict.get("student_id")
        if student_id_out is not None:
            try:
                student_id_out = int(student_id_out)
            except (TypeError, ValueError):
                pass
        date_value = row_dict.get("date")
        time_value = row_dict.get("time")
        created_at = row_dict.get("created_at")
        if (not time_value) and created_at:
            try:
                parsed = datetime.fromisoformat(created_at)
                time_value = parsed.time().strftime("%H:%M:%S")
                if not date_value:
                    date_value = parsed.date().isoformat()
            except ValueError:
                pass
        items.append(
            {
                "attendanceId": row_dict.get("id"),
                "studentId": student_id_out,
                "studentName": row_dict.get("student_name"),
                "rollNo": row_dict.get("roll_no"),
                "classId": row_dict.get("class_id"),
                "className": row_dict.get("class_name"),
                "section": row_dict.get("section"),
                "subject": row_dict.get("subject"),
                "date": date_value,
                "time": time_value,
                "status": (row_dict.get("status") or "").lower(),
                "recognizedName": row_dict.get("recognized_name"),
                "source": _normalize_source(row_dict.get("source")),
            }
        )

    if format_value == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Date", "Time", "Class", "Section", "Subject", "Student", "Roll No", "Status", "Recognized Name", "Source"])
        for item in items:
            writer.writerow([
                item.get("date"),
                item.get("time"),
                item.get("className"),
                item.get("section"),
                item.get("subject"),
                item.get("studentName"),
                item.get("rollNo"),
                item.get("status"),
                item.get("recognizedName"),
                item.get("source"),
            ])
        response = Response(output.getvalue(), mimetype="text/csv")
        filename = f"attendance-history-{date.today().isoformat()}.csv"
        response.headers["Content-Disposition"] = f"attachment; filename={filename}"
        return response

    return jsonify(
        {
            "items": items,
            "meta": {"page": page, "perPage": per_page, "total": total},
        }
    )


@app.route("/api/attendance/latest", methods=["GET"])
def attendance_latest():
    with closing(get_connection()) as conn:
        cursor = conn.cursor()
        info = _students_pk_info(cursor)
        join_cond = _pk_join_condition("s", "a", info)
        cursor.execute(
            f"""
            SELECT
                a.id,
                a.student_id,
                a.matched,
                a.distance,
                a.score,
                a.source,
                a.created_at,
                s.name,
                COALESCE(s.roll_no, s.rollNo) AS roll_no,
                COALESCE(s.username, u.username) AS username
            FROM attendance_logs AS a
            LEFT JOIN students AS s
              ON {join_cond}
            LEFT JOIN users AS u ON u.user_id = s.user_id
            ORDER BY a.id DESC
            LIMIT 20
            """
        )
        rows = cursor.fetchall()

    items = [
        {
            "id": row["id"],
            "studentId": row["student_id"],
            "studentName": row["name"],
            "rollNo": row["roll_no"],
            "username": row["username"],
            "matched": bool(row["matched"]) if row["matched"] is not None else None,
            "distance": row["distance"],
            "score": row["score"],
            "source": row["source"],
            "threshold": MATCH_THRESHOLD,
            "createdAt": row["created_at"],
        }
        for row in rows
    ]
    return jsonify({"items": items})

@app.route("/api/attendance/summary", methods=["GET"])
def attendance_summary():
    with closing(get_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT source,
                   COUNT(*) AS attempts,
                   SUM(CASE WHEN matched = 1 THEN 1 ELSE 0 END) AS successes
            FROM attendance_logs
            GROUP BY source
            """
        )
        rows = cursor.fetchall()

    subjects = []
    total_attempts = 0
    total_successes = 0
    for row in rows:
        attempts = row["attempts"] or 0
        successes = row["successes"] or 0
        total_attempts += attempts
        total_successes += successes
        percent = round((successes / attempts) * 100.0, 2) if attempts else 0.0
        subject_id = row["source"] or "unknown"
        subjects.append(
            {
                "subjectId": subject_id,
                "attendance": percent,
                "present": successes,
                "total": attempts,
            }
        )

    overall_percent = round((total_successes / total_attempts) * 100.0, 2) if total_attempts else 0.0
    return jsonify(
        {
            "subjects": subjects,
            "overall": {
                "present": total_successes,
                "total": total_attempts,
                "attendance": overall_percent,
            },
        }
    )

# Legacy pass-through (if some old UI calls it)
@app.route("/api/verify", methods=["POST"])
def legacy_verify():
    forward_payload = request.get_json(force=True, silent=True)
    if not forward_payload:
        return jsonify({"error": "invalid json"}), 400
    body, response, status = _forward_request(f"{FACENET_URL}/verify", json_payload=forward_payload)
    return response, status

# ----------------------------
# Entrypoint
# ----------------------------
if __name__ == "__main__":
    print("DB_PATH:", DB_PATH, flush=True)
    init_db()
    with closing(get_connection()) as conn:
        cur = conn.cursor()
        pk_info = _students_pk_info(cur)
    print("students PK:", pk_info, flush=True)
    app.run(host="0.0.0.0", port=PORT)
