"""Firestore repository helpers for attendance operations."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from google.cloud import firestore

from firebase_client import get_firestore


class FirestoreRepo:
    """Lightweight data-access layer around Firestore collections."""

    def __init__(self, client: Optional[firestore.Client] = None) -> None:
        self._client = client or get_firestore()

    # Collection helpers -------------------------------------------------
    @property
    def attendance_collection(self) -> firestore.CollectionReference:
        return self._client.collection("attendance")

    @property
    def users_collection(self) -> firestore.CollectionReference:
        return self._client.collection("users")

    @property
    def sessions_collection(self) -> firestore.CollectionReference:
        return self._client.collection("sessions")

    @property
    def classes_collection(self) -> firestore.CollectionReference:
        return self._client.collection("classes")

    # CRUD helpers -------------------------------------------------------
    def create_attendance(self, data: Dict[str, Any]) -> str:
        doc_ref = self.attendance_collection.document()
        payload = dict(data)
        payload.setdefault("capturedAt", firestore.SERVER_TIMESTAMP)
        doc_ref.set(payload)
        return doc_ref.id

    def list_attendance_by_session(self, session_id: str, limit: int = 200) -> List[Dict[str, Any]]:
        query = (
            self.attendance_collection
            .where("sessionId", "==", session_id)
            .order_by("capturedAt", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )
        docs = query.stream()
        results: List[Dict[str, Any]] = []
        for snap in docs:
            record = snap.to_dict() or {}
            record["id"] = snap.id
            results.append(record)
        return results

    def get_user(self, uid: str) -> Optional[Dict[str, Any]]:
        snap = self.users_collection.document(uid).get()
        if not snap.exists:
            return None
        user = snap.to_dict() or {}
        user.setdefault("id", snap.id)
        return user

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        snap = self.sessions_collection.document(session_id).get()
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        data.setdefault("id", snap.id)
        return data

    def get_class(self, class_id: str) -> Optional[Dict[str, Any]]:
        snap = self.classes_collection.document(class_id).get()
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        data.setdefault("id", snap.id)
        return data
