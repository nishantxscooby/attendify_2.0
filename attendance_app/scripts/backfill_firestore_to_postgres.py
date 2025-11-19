#!/usr/bin/env python3
"""Backfill Firestore documents into Postgres for initial sync."""

from __future__ import annotations

import argparse
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Sequence, Tuple

import psycopg2
from google.cloud import firestore
from psycopg2.extras import Json, execute_batch

logger = logging.getLogger("backfill")

BATCH_SIZE = 500
CORE_COLLECTIONS = {"attendance", "users", "courses"}
GENERIC_COLLECTIONS = ["organizations", "classes", "sessions"]


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} environment variable is required")
    return value


def _ensure_sslmode(url: str) -> str:
    return url if "sslmode=" in url else (f"{url}&sslmode=require" if "?" in url else f"{url}?sslmode=require")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _resolve_updated_at(payload: Dict[str, Any]) -> datetime:
    updated = _to_datetime(payload.get("updatedAt")) or _to_datetime(payload.get("updated_at"))
    if updated:
        return updated.astimezone(timezone.utc)
    ts_utc = _to_datetime(payload.get("tsUtc")) or _to_datetime(payload.get("ts_utc"))
    if ts_utc:
        return ts_utc.astimezone(timezone.utc)
    return _utcnow()


def _resolve_version(payload: Dict[str, Any]) -> int:
    version = payload.get("version")
    if isinstance(version, int) and version > 0:
        return version
    if isinstance(version, str) and version.isdigit():
        return int(version)
    return 1


def _chunk(sequence: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    for index in range(0, len(sequence), size):
        yield sequence[index:index + size]


def _attendance_rows(docs: Iterable[firestore.DocumentSnapshot]) -> Tuple[List[Tuple[Any, ...]], int]:
    rows: List[Tuple[Any, ...]] = []
    skipped = 0
    for doc in docs:
        data = doc.to_dict() or {}
        user_id = data.get("userId") or data.get("user_id")
        course_id = (
            data.get("courseId")
            or data.get("course_id")
            or data.get("sessionId")
            or data.get("session_id")
        )
        if not user_id or not course_id:
            logger.warning("Skipping attendance %s due to missing user/course", doc.id)
            skipped += 1
            continue
        status = data.get("status") or "unknown"
        ts_utc = _to_datetime(
            data.get("tsUtc")
            or data.get("ts_utc")
            or data.get("capturedAt")
            or data.get("captured_at")
            or data.get("timestamp")
        )
        updated_at = _resolve_updated_at(data)
        ts_utc = ts_utc or updated_at
        rows.append(
            (
                doc.id,
                str(user_id),
                str(course_id),
                str(status),
                ts_utc.astimezone(timezone.utc),
                _resolve_version(data),
                updated_at.astimezone(timezone.utc),
                "firebase",
            )
        )
    return rows, skipped


def _user_rows(docs: Iterable[firestore.DocumentSnapshot]) -> Tuple[List[Tuple[Any, ...]], int]:
    rows: List[Tuple[Any, ...]] = []
    skipped = 0
    for doc in docs:
        data = doc.to_dict() or {}
        email = data.get("email")
        if not email:
            logger.warning("Skipping user %s due to missing email", doc.id)
            skipped += 1
            continue
        updated_at = _resolve_updated_at(data)
        rows.append(
            (
                doc.id,
                str(email).strip().lower(),
                data.get("displayName") or data.get("display_name"),
                data.get("role"),
                _resolve_version(data),
                updated_at.astimezone(timezone.utc),
                "firebase",
            )
        )
    return rows, skipped


def _course_rows(docs: Iterable[firestore.DocumentSnapshot]) -> Tuple[List[Tuple[Any, ...]], int]:
    rows: List[Tuple[Any, ...]] = []
    skipped = 0
    for doc in docs:
        data = doc.to_dict() or {}
        name = data.get("name")
        if not name:
            logger.warning("Skipping course %s due to missing name", doc.id)
            skipped += 1
            continue
        updated_at = _resolve_updated_at(data)
        rows.append(
            (
                doc.id,
                str(name),
                data.get("code"),
                data.get("departmentId") or data.get("department_id"),
                _resolve_version(data),
                updated_at.astimezone(timezone.utc),
                "firebase",
            )
        )
    return rows, skipped


def _generic_rows(
    docs: Iterable[firestore.DocumentSnapshot],
) -> Tuple[List[Tuple[Any, ...]], int]:
    rows: List[Tuple[Any, ...]] = []
    skipped = 0
    for doc in docs:
        data = doc.to_dict() or {}
        if not data:
            logger.warning("Skipping %s because document has no data", doc.id)
            skipped += 1
            continue
        updated_at = _resolve_updated_at(data)
        rows.append(
            (
                doc.id,
                Json(data),
                _resolve_version(data),
                updated_at.astimezone(timezone.utc),
                "firebase",
            )
        )
    return rows, skipped


def _execute_batches(conn, query: str, rows: List[Tuple[Any, ...]]) -> None:
    if not rows:
        return
    for chunk in _chunk(rows, BATCH_SIZE):
        with conn.cursor() as cur:
            execute_batch(cur, query, chunk, page_size=len(chunk))
        conn.commit()


def _backfill_collection(
    conn,
    client,
    collection: str,
) -> Tuple[int, int]:
    docs = list(client.collection(collection).stream())
    if not docs:
        logger.info("No documents found for %s", collection)
        return 0, 0

    if collection == "attendance":
        rows, skipped = _attendance_rows(docs)
        query = (
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
                source = 'firebase'
            ;
            """
        )
    elif collection == "users":
        rows, skipped = _user_rows(docs)
        query = (
            """
            INSERT INTO app_user (id, email, display_name, role, version, updated_at, source)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                display_name = EXCLUDED.display_name,
                role = EXCLUDED.role,
                updated_at = EXCLUDED.updated_at,
                version = GREATEST(app_user.version, EXCLUDED.version),
                source = 'firebase'
            ;
            """
        )
    elif collection == "courses":
        rows, skipped = _course_rows(docs)
        query = (
            """
            INSERT INTO course (id, name, code, department_id, version, updated_at, source)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                code = EXCLUDED.code,
                department_id = EXCLUDED.department_id,
                updated_at = EXCLUDED.updated_at,
                version = GREATEST(course.version, EXCLUDED.version),
                source = 'firebase'
            ;
            """
        )
    else:
        rows, skipped = _generic_rows(docs)
        table = f"{collection}_mirror"
        query = (
            f"""
            INSERT INTO {table} (id, data, version, updated_at, source)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                data = EXCLUDED.data,
                updated_at = EXCLUDED.updated_at,
                version = GREATEST({table}.version, EXCLUDED.version),
                source = 'firebase'
            ;
            """
        )

    _execute_batches(conn, query, rows)
    processed = len(rows)
    logger.info(
        "[%s] processed=%s skipped=%s", collection, processed, skipped
    )
    return processed, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill Firestore collections into Postgres")
    parser.add_argument(
        "--collections",
        type=str,
        default="attendance,users,courses",
        help="Comma separated list of core collections to backfill",
    )
    parser.add_argument(
        "--also-discovered",
        action="store_true",
        help="Include discovered generic collections",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    database_url = _ensure_sslmode(_require_env("DATABASE_URL"))
    service_account = json.loads(_require_env("FIREBASE_ADMIN_JSON"))

    selected = [item.strip() for item in args.collections.split(",") if item.strip()]
    invalid = [item for item in selected if item not in CORE_COLLECTIONS]
    if invalid:
        raise RuntimeError(f"Unsupported collection(s): {', '.join(invalid)}")

    collections = selected[:]
    if args.also_discovered:
        collections += [name for name in GENERIC_COLLECTIONS if name not in collections]

    conn = psycopg2.connect(database_url, sslmode="require")
    client = firestore.Client.from_service_account_info(service_account)

    total_processed = 0
    total_skipped = 0
    try:
        for collection in collections:
            processed, skipped = _backfill_collection(conn, client, collection)
            total_processed += processed
            total_skipped += skipped
    finally:
        conn.close()

    logger.info(
        "Done. processed=%s skipped=%s collections=%s",
        total_processed,
        total_skipped,
        ",".join(collections),
    )


if __name__ == "__main__":
    main()
