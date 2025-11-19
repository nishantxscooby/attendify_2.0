"""Firebase Admin utilities for Firestore access and token verification."""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

import firebase_admin
from fastapi import HTTPException, status
from firebase_admin import auth, credentials, firestore

_logger = logging.getLogger(__name__)


def _initialise_app() -> None:
    if firebase_admin._apps:
        return

    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    try:
        if cred_path:
            _logger.info("Initialising Firebase Admin with explicit credentials")
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            _logger.info("Initialising Firebase Admin with default credentials")
            firebase_admin.initialize_app()
    except Exception as exc:  # pragma: no cover - defensive logging only
        _logger.exception("Failed to initialise Firebase Admin SDK: %s", exc)
        raise


_initialise_app()


def get_firestore() -> firestore.Client:
    """Return the shared Firestore client."""
    return firestore.client()


def verify_bearer(authorization: Optional[str]) -> Dict[str, Any]:
    """Verify the Firebase ID token provided in an Authorization header."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must be in the format 'Bearer <token>'",
        )

    try:
        return auth.verify_id_token(token)
    except Exception as exc:  # pragma: no cover - token verification errors
        _logger.warning("Failed to verify Firebase token: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase ID token",
        ) from exc
