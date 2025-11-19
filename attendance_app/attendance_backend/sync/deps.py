"""Dependency helpers for sync routes."""

from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from typing import Generator

import psycopg2
from psycopg2.extensions import connection as PGConnection
from google.cloud import firestore

logger = logging.getLogger(__name__)


def _apply_sslmode(url: str) -> str:
    """Ensure the Postgres URL enforces sslmode=require."""
    if "sslmode=" in url:
        return url
    return f"{url}&sslmode=require" if "?" in url else f"{url}?sslmode=require"


@lru_cache(maxsize=1)
def _database_url() -> str:
    raw_url = os.getenv("DATABASE_URL")
    if not raw_url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    return _apply_sslmode(raw_url)


@lru_cache(maxsize=1)
def _service_account() -> dict:
    raw_json = os.getenv("FIREBASE_ADMIN_JSON")
    if not raw_json:
        raise RuntimeError("FIREBASE_ADMIN_JSON environment variable is not set")
    try:
        return json.loads(raw_json)
    except json.JSONDecodeError as exc:    # pragma: no cover - defensive
        logger.error("Invalid FIREBASE_ADMIN_JSON value: %s", exc)
        raise RuntimeError("FIREBASE_ADMIN_JSON is not valid JSON") from exc


@lru_cache(maxsize=1)
def _firestore_client() -> firestore.Client:
    return firestore.Client.from_service_account_info(_service_account())


def get_pg_conn() -> Generator[PGConnection, None, None]:
    """Yield a psycopg2 connection with SSL enforced."""
    conn = psycopg2.connect(_database_url(), sslmode="require")
    try:
        yield conn
    finally:
        try:
            conn.close()
        except Exception:    # pragma: no cover - cleanup best effort
            logger.warning("Failed to close Postgres connection", exc_info=False)


def get_fs_client() -> firestore.Client:
    """Return a cached Firestore client built from the service account."""
    return _firestore_client()
