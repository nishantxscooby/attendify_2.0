"""FastAPI routes to sync Postgres changes back to Firestore."""

from __future__ import annotations

import logging
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore import Client as FirestoreClient
from psycopg2 import sql
from psycopg2.extensions import connection as PGConnection
from psycopg2.extras import Json
from pydantic import BaseModel, Field, validator, root_validator

from .deps import get_fs_client, get_pg_conn

logger = logging.getLogger(__name__)

router = APIRouter()

GENERIC_COLLECTIONS = ("organizations", "classes", "sessions")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_utc(dt: Optional[datetime], fallback: datetime) -> datetime:
    if dt is None:
        return fallback
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _bump_version(existing: Optional[int]) -> int:
    base = existing or 1
    return base + 1


class AttendanceUpsert(BaseModel):
    id: str
    user_id: str = Field(..., alias="userId")
    course_id: str = Field(..., alias="courseId")
    status: str = Field("present")
    ts_utc: Optional[datetime] = Field(None, alias="tsUtc")
    version: Optional[int] = None
    session_id: Optional[str] = Field(None, alias="sessionId")

    class Config:
        allow_population_by_field_name = True
        anystr_strip_whitespace = True

    @root_validator(pre=True)
    def _normalise(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        data = dict(values)
        user = data.get("userId") or data.get("user_id")
        if user:
            data["userId"] = user
        else:
            raise ValueError("userId is required")
        course = (
            data.get("courseId")
            or data.get("course_id")
            or data.get("sessionId")
            or data.get("session_id")
        )
        if course:
            data["courseId"] = course
        else:
            raise ValueError("courseId or sessionId is required")
        if "tsUtc" not in data and "ts_utc" in data:
            data["tsUtc"] = data["ts_utc"]
        return data


class UserUpsert(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = Field(None, alias="displayName")
    role: Optional[str] = None
    version: Optional[int] = None

    class Config:
        allow_population_by_field_name = True
        anystr_strip_whitespace = True

    @validator("email")
    def _normalise_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not value:
            raise ValueError("email is required")
        return value


class CourseUpsert(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    department_id: Optional[str] = Field(None, alias="departmentId")
    version: Optional[int] = None

    class Config:
        allow_population_by_field_name = True
        anystr_strip_whitespace = True

    @validator("name")
    def _validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("name is required")
        return value


class GenericUpsert(BaseModel):
    id: str
    data: Dict[str, Any]
    version: Optional[int] = None

    @validator("data")
    def _validate_data(cls, value: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(value, dict) or not value:
            raise ValueError("data must be a non-empty object")
        return value


class SyncResponse(BaseModel):
    id: str
    version: int
    updated_at: datetime = Field(alias="updatedAt")

    class Config:
        allow_population_by_field_name = True


def _attendance_upsert(
    payload: AttendanceUpsert,
    conn: PGConnection,
    fs: FirestoreClient,
) -> SyncResponse:
    updated_at = _utcnow()
    ts_utc = _ensure_utc(payload.ts_utc, updated_at)
    version = _bump_version(payload.version)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO attendance_event (id, user_id, course_id, status, ts_utc, version, updated_at, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    course_id = EXCLUDED.course_id,
                    status = EXCLUDED.status,
                    ts_utc = EXCLUDED.ts_utc,
                    updated_at = EXCLUDED.updated_at,
                    version = GREATEST(attendance_event.version, EXCLUDED.version),
                    source = 'web'
                ;
                """,
                (
                    payload.id,
                    payload.user_id,
                    payload.course_id,
                    payload.status,
                    ts_utc,
                    version,
                    updated_at,
                    "web",
                ),
            )
        fs.collection("attendance").document(payload.id).set(
            {
                "userId": payload.user_id,
                "courseId": payload.course_id,
                "status": payload.status,
                "tsUtc": ts_utc,
                "updatedAt": updated_at,
                "version": version,
                "source": "web",
            },
            merge=True,
        )
        conn.commit()
    except Exception as exc:  # pragma: no cover - requires integration tests
        conn.rollback()
        logger.exception("Attendance upsert failed for %s", payload.id)
        raise HTTPException(status_code=500, detail="Failed to upsert attendance") from exc
    return SyncResponse(id=payload.id, version=version, updatedAt=updated_at)


def _user_upsert(
    payload: UserUpsert,
    conn: PGConnection,
    fs: FirestoreClient,
) -> SyncResponse:
    updated_at = _utcnow()
    version = _bump_version(payload.version)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app_user (id, email, display_name, role, version, updated_at, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    display_name = EXCLUDED.display_name,
                    role = EXCLUDED.role,
                    updated_at = EXCLUDED.updated_at,
                    version = GREATEST(app_user.version, EXCLUDED.version),
                    source = 'web'
                ;
                """,
                (
                    payload.id,
                    payload.email,
                    payload.display_name,
                    payload.role,
                    version,
                    updated_at,
                    "web",
                ),
            )
        fs.collection("users").document(payload.id).set(
            {
                "email": payload.email,
                "displayName": payload.display_name,
                "role": payload.role,
                "updatedAt": updated_at,
                "version": version,
                "source": "web",
            },
            merge=True,
        )
        conn.commit()
    except Exception as exc:  # pragma: no cover - requires integration tests
        conn.rollback()
        logger.exception("User upsert failed for %s", payload.id)
        raise HTTPException(status_code=500, detail="Failed to upsert user") from exc
    return SyncResponse(id=payload.id, version=version, updatedAt=updated_at)


def _course_upsert(
    payload: CourseUpsert,
    conn: PGConnection,
    fs: FirestoreClient,
) -> SyncResponse:
    updated_at = _utcnow()
    version = _bump_version(payload.version)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO course (id, name, code, department_id, version, updated_at, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    code = EXCLUDED.code,
                    department_id = EXCLUDED.department_id,
                    updated_at = EXCLUDED.updated_at,
                    version = GREATEST(course.version, EXCLUDED.version),
                    source = 'web'
                ;
                """,
                (
                    payload.id,
                    payload.name,
                    payload.code,
                    payload.department_id,
                    version,
                    updated_at,
                    "web",
                ),
            )
        fs.collection("courses").document(payload.id).set(
            {
                "name": payload.name,
                "code": payload.code,
                "departmentId": payload.department_id,
                "updatedAt": updated_at,
                "version": version,
                "source": "web",
            },
            merge=True,
        )
        conn.commit()
    except Exception as exc:  # pragma: no cover - requires integration tests
        conn.rollback()
        logger.exception("Course upsert failed for %s", payload.id)
        raise HTTPException(status_code=500, detail="Failed to upsert course") from exc
    return SyncResponse(id=payload.id, version=version, updatedAt=updated_at)


@router.post("/attendance/upsert", response_model=SyncResponse)
def upsert_attendance(
    payload: AttendanceUpsert,
    conn: PGConnection = Depends(get_pg_conn),
    fs: FirestoreClient = Depends(get_fs_client),
) -> SyncResponse:
    return _attendance_upsert(payload, conn, fs)


@router.post("/users/upsert", response_model=SyncResponse)
def upsert_user(
    payload: UserUpsert,
    conn: PGConnection = Depends(get_pg_conn),
    fs: FirestoreClient = Depends(get_fs_client),
) -> SyncResponse:
    return _user_upsert(payload, conn, fs)


@router.post("/courses/upsert", response_model=SyncResponse)
def upsert_course(
    payload: CourseUpsert,
    conn: PGConnection = Depends(get_pg_conn),
    fs: FirestoreClient = Depends(get_fs_client),
) -> SyncResponse:
    return _course_upsert(payload, conn, fs)


@router.delete("/attendance/{doc_id}")
def delete_attendance(
    doc_id: str,
    conn: PGConnection = Depends(get_pg_conn),
    fs: FirestoreClient = Depends(get_fs_client),
) -> Dict[str, Any]:
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM attendance_event WHERE id = %s", (doc_id,))
        fs.collection("attendance").document(doc_id).delete()
        conn.commit()
    except Exception as exc:  # pragma: no cover - requires integration tests
        conn.rollback()
        logger.exception("Attendance delete failed for %s", doc_id)
        raise HTTPException(status_code=500, detail="Failed to delete attendance") from exc
    return {"id": doc_id, "deleted": True}


@router.delete("/users/{doc_id}")
def delete_user(
    doc_id: str,
    conn: PGConnection = Depends(get_pg_conn),
    fs: FirestoreClient = Depends(get_fs_client),
) -> Dict[str, Any]:
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM app_user WHERE id = %s", (doc_id,))
        fs.collection("users").document(doc_id).delete()
        conn.commit()
    except Exception as exc:  # pragma: no cover - requires integration tests
        conn.rollback()
        logger.exception("User delete failed for %s", doc_id)
        raise HTTPException(status_code=500, detail="Failed to delete user") from exc
    return {"id": doc_id, "deleted": True}


@router.delete("/courses/{doc_id}")
def delete_course(
    doc_id: str,
    conn: PGConnection = Depends(get_pg_conn),
    fs: FirestoreClient = Depends(get_fs_client),
) -> Dict[str, Any]:
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM course WHERE id = %s", (doc_id,))
        fs.collection("courses").document(doc_id).delete()
        conn.commit()
    except Exception as exc:  # pragma: no cover - requires integration tests
        conn.rollback()
        logger.exception("Course delete failed for %s", doc_id)
        raise HTTPException(status_code=500, detail="Failed to delete course") from exc
    return {"id": doc_id, "deleted": True}


class GenericSyncResponse(BaseModel):
    id: str
    version: int
    updated_at: datetime = Field(alias="updatedAt")

    class Config:
        allow_population_by_field_name = True


def _generic_upsert(
    collection: str,
    payload: GenericUpsert,
    conn: PGConnection,
    fs: FirestoreClient,
) -> GenericSyncResponse:
    updated_at = _utcnow()
    version = _bump_version(payload.version)
    table = f"{collection}_mirror"
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL(
                    """
                    INSERT INTO {table} (id, data, version, updated_at, source)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        data = EXCLUDED.data,
                        updated_at = EXCLUDED.updated_at,
                        version = GREATEST({table}.version, EXCLUDED.version),
                        source = 'web'
                    ;
                    """
                ).format(table=sql.Identifier(table)),
                (
                    payload.id,
                    Json(payload.data),
                    version,
                    updated_at,
                    "web",
                ),
            )
        fs_payload = deepcopy(payload.data)
        fs_payload.update(
            {
                "updatedAt": updated_at,
                "version": version,
                "source": "web",
            }
        )
        fs.collection(collection).document(payload.id).set(fs_payload, merge=True)
        conn.commit()
    except Exception as exc:  # pragma: no cover - requires integration tests
        conn.rollback()
        logger.exception("Generic upsert failed for %s/%s", collection, payload.id)
        raise HTTPException(status_code=500, detail=f"Failed to upsert {collection}") from exc
    return GenericSyncResponse(id=payload.id, version=version, updatedAt=updated_at)


def _generic_delete(
    collection: str,
    doc_id: str,
    conn: PGConnection,
    fs: FirestoreClient,
) -> Dict[str, Any]:
    table = f"{collection}_mirror"
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL("DELETE FROM {table} WHERE id = %s").format(table=sql.Identifier(table)),
                (doc_id,),
            )
        fs.collection(collection).document(doc_id).delete()
        conn.commit()
    except Exception as exc:  # pragma: no cover - requires integration tests
        conn.rollback()
        logger.exception("Generic delete failed for %s/%s", collection, doc_id)
        raise HTTPException(status_code=500, detail=f"Failed to delete {collection}") from exc
    return {"id": doc_id, "deleted": True}


for collection_name in GENERIC_COLLECTIONS:
    upsert_path = f"/{collection_name}/upsert"
    delete_path = f"/{collection_name}/{{doc_id}}"

    def _make_upsert(collection: str):
        def _route(
            payload: GenericUpsert,
            conn: PGConnection = Depends(get_pg_conn),
            fs: FirestoreClient = Depends(get_fs_client),
        ) -> GenericSyncResponse:
            return _generic_upsert(collection, payload, conn, fs)

        _route.__name__ = f"upsert_{collection}_generic"
        return _route

    def _make_delete(collection: str):
        def _route(
            doc_id: str,
            conn: PGConnection = Depends(get_pg_conn),
            fs: FirestoreClient = Depends(get_fs_client),
        ) -> Dict[str, Any]:
            return _generic_delete(collection, doc_id, conn, fs)

        _route.__name__ = f"delete_{collection}_generic"
        return _route

    router.post(upsert_path, response_model=GenericSyncResponse)(_make_upsert(collection_name))
    router.delete(delete_path)(_make_delete(collection_name))
