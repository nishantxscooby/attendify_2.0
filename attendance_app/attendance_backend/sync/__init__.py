"""Sync package wiring Postgres ↔ Firestore for FastAPI."""

from .routes import router

__all__ = ["router"]
