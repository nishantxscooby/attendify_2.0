"""One-time migration from SQLite to Firestore.

Usage (macOS / Linux):
  python sqlite_to_firestore.py

Before running:
  1. Set `SQLITE_DB_PATH` and `PROJECT_ID` constants below, or override via env vars
     `SQLITE_DB_PATH` / `FIRESTORE_PROJECT_ID`.
  2. For local testing against the emulator, export FIRESTORE_EMULATOR_HOST.
  3. For production, ensure GOOGLE_APPLICATION_CREDENTIALS points to a service account key,
     or run on Cloud Run with Workload Identity (no key file required).
"""
from __future__ import annotations

import math
import os
import sqlite3
from typing import Any, Dict, Iterable, List, Sequence, Tuple

from google.cloud import firestore

# --- Configuration ---------------------------------------------------------
SQLITE_DB_PATH = os.getenv("SQLITE_DB_PATH", "/path/to/attendance_system.db")
PROJECT_ID = os.getenv("FIRESTORE_PROJECT_ID", os.getenv("PROJECT_ID"))
COLLECTION_PREFIX = os.getenv("COLLECTION_PREFIX", "")  # e.g., "legacy_"

MAX_BATCH_WRITES = 450  # safety margin under Firestore's 500 operations per batch


def ensure_config() -> None:
    if not SQLITE_DB_PATH or not os.path.exists(SQLITE_DB_PATH):
        raise FileNotFoundError(
            f"SQLite database not found at '{SQLITE_DB_PATH}'. Update SQLITE_DB_PATH before running."
        )
    if not PROJECT_ID:
        raise RuntimeError("PROJECT_ID (or FIRESTORE_PROJECT_ID) must be set before running migration.")


def get_sqlite_tables(conn: sqlite3.Connection) -> List[str]:
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    return [row[0] for row in cursor.fetchall()]


def get_table_schema(conn: sqlite3.Connection, table: str) -> Tuple[List[str], List[str]]:
    cursor = conn.execute(f"PRAGMA table_info('{table}')")
    columns: List[str] = []
    pk_columns: List[Tuple[int, str]] = []
    for cid, name, _type, _notnull, _default, pk_idx in cursor.fetchall():
        columns.append(name)
        if pk_idx:
            pk_columns.append((pk_idx, name))
    pk_columns_sorted = [name for _, name in sorted(pk_columns, key=lambda item: item[0])]
    return columns, pk_columns_sorted


def normalize_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, memoryview):
        value = value.tobytes()
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8")
        except UnicodeDecodeError:
            return value.decode("utf-8", errors="replace")
    if isinstance(value, (int, float, bool, str)):
        return value
    # Fallback to string representation for unsupported types (e.g., datetime)
    return str(value)


def chunked(iterable: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    for start in range(0, len(iterable), size):
        yield iterable[start : start + size]


def migrate_table(
    conn: sqlite3.Connection,
    client: firestore.Client,
    table: str,
    columns: List[str],
    pk_columns: List[str],
) -> int:
    cursor = conn.execute(f"SELECT * FROM '{table}'")
    rows = cursor.fetchall()
    if not rows:
        return 0

    collection_name = f"{COLLECTION_PREFIX}{table}"
    collection_ref = client.collection(collection_name)

    total_batches = math.ceil(len(rows) / MAX_BATCH_WRITES)
    imported_count = 0

    for batch_rows in chunked(rows, MAX_BATCH_WRITES):
        batch = client.batch()
        for row in batch_rows:
            row_dict = {col: normalize_value(value) for col, value in zip(columns, row)}

            doc_id = None
            if pk_columns:
                pk_values = [row_dict.get(pk) for pk in pk_columns]
                if all(value is not None for value in pk_values):
                    doc_id = "_".join(str(value) for value in pk_values)

            if doc_id:
                doc_ref = collection_ref.document(str(doc_id))
            else:
                doc_ref = collection_ref.document()

            batch.set(doc_ref, row_dict)
            imported_count += 1

        batch.commit()

    print(f"Imported {imported_count} rows from table '{table}'")
    return imported_count


def main() -> None:
    ensure_config()

    # Connect to SQLite (read-only mode)
    sqlite_uri = f"file:{SQLITE_DB_PATH}?mode=ro"
    conn = sqlite3.connect(sqlite_uri, uri=True)
    conn.row_factory = sqlite3.Row

    tables = get_sqlite_tables(conn)
    if not tables:
        print("No tables found to migrate.")
        return

    client = firestore.Client(project=PROJECT_ID)

    total_rows = 0
    for table in tables:
        columns, pk_columns = get_table_schema(conn, table)
        rows_imported = migrate_table(conn, client, table, columns, pk_columns)
        total_rows += rows_imported

    conn.close()
    print(f"Migration complete. Imported {total_rows} rows across {len(tables)} tables.")


if __name__ == "__main__":
    main()
