from __future__ import annotations
from fastapi.middleware.cors import CORSMiddleware

import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

from firebase_client import verify_bearer
from repo_firestore import FirestoreRepo

app = FastAPI(title="Attendance Backend", version="2.0.0")

from fastapi.middleware.cors import CORSMiddleware
import os

_allowed = os.getenv("ALLOWED_ORIGINS", "*")
origins = [o.strip() for o in _allowed.split(",") if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,          # e.g. ["https://attendify-nishant.web.app"]
    allow_credentials=True,
    allow_methods=["*"],            # GET, POST, OPTIONS, etc.
    allow_headers=["*"],            # Authorization, Content-Type, etc.
)

# --- CORS ---
import os
_ALO = os.getenv("ALLOWED_ORIGINS", "*").strip()
_allow_origins = ["*"] if _ALO in ("", "*") else [o.strip() for o in _ALO.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
    expose_headers=["*"],
    max_age=86400,
)
print("CORS enabled for:", _allow_origins)
import os
_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
_allow_origins = ["*"] if _origins_env.strip() in ("", "*") else [o.strip() for o in _origins_env.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],   # includes Authorization
    allow_credentials=False,
    expose_headers=["*"],
    max_age=86400,
)
# --- CORS ---
import os
_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
_allow_origins = ["*"] if _origins_env.strip() in ("", "*") else [o.strip() for o in _origins_env.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],   # includes Authorization
    allow_credentials=False,
    expose_headers=["*"],
    max_age=86400,
)
FACENET_URL = os.getenv("FACENET_URL", "").rstrip("/")
PROJECT_ID = os.getenv("PROJECT_ID")

_repo = FirestoreRepo()


class AttendanceCreate(BaseModel):
    sessionId: str = Field(..., min_length=1)
    userId: str = Field(..., min_length=1)
    status: str = Field(default="present", min_length=1)
    confidence: Optional[float] = None
    imagePath: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class AttendanceRecord(BaseModel):
    id: str
    sessionId: str
    userId: str
    status: str
    confidence: Optional[float] = None
    imagePath: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    capturedAt: Optional[datetime] = None


def _serialize_timestamp(value: Any) -> Optional[datetime]:
    if hasattr(value, "to_datetime"):
        return value.to_datetime()
    if isinstance(value, datetime):
        return value
    return None


async def auth_dependency(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    return verify_bearer(authorization)


@app.get("/health", tags=["system"])
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/me", tags=["auth"])
async def me(claims: Dict[str, Any] = Depends(auth_dependency)) -> Dict[str, Optional[str]]:
    return {"uid": claims.get("uid"), "role": claims.get("role")}


@app.get("/attendance", response_model=List[AttendanceRecord], tags=["attendance"])
async def list_attendance(
    session_id: str = Query(..., alias="sessionId", min_length=1),
    limit: int = Query(200, ge=1, le=500),
    _: Dict[str, Any] = Depends(auth_dependency),
) -> List[AttendanceRecord]:
    records = _repo.list_attendance_by_session(session_id=session_id, limit=limit)
    payload: List[AttendanceRecord] = []
    for item in records:
        item["capturedAt"] = _serialize_timestamp(item.get("capturedAt"))
        payload.append(AttendanceRecord(**item))
    return payload

from fastapi import Response
from fastapi.responses import JSONResponse

@app.options("/{rest_of_path:path}")
def any_options(rest_of_path: str):
    # CORSMiddleware should already add CORS headers; this is just to avoid 405s
    return Response(status_code=204)


@app.post("/attendance", response_model=AttendanceRecord, status_code=status.HTTP_201_CREATED, tags=["attendance"])
async def create_attendance(
    body: AttendanceCreate,
    claims: Dict[str, Any] = Depends(auth_dependency),
) -> AttendanceRecord:
    data: Dict[str, Any] = body.model_dump()
    data.setdefault("createdBy", claims.get("uid"))
    doc_id = _repo.create_attendance(data)
    record = {
        "id": doc_id,
        **data,
        "capturedAt": datetime.utcnow(),
    }
    return AttendanceRecord(**record)

@app.get("/healthz")
def healthz():
    return {"status":"ok"}



__all__ = ["app"]


from fastapi import Response, Request

@app.options("/{path:path}")
def _any_options(path: str, request: Request):
    origin = request.headers.get("origin") or ""
    import os
    allowed = os.getenv("ALLOWED_ORIGINS", "*")
    allow_origin = "*" if allowed.strip() in ("", "*") else (origin if origin in [o.strip() for o in allowed.split(",")] else "")
    headers = {
        "access-control-allow-origin": allow_origin or "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "Authorization,Content-Type",
        "access-control-max-age": "86400",
    }
    return Response(status_code=204, headers=headers)


from fastapi import Request, Response
import os, pathlib, inspect

@app.get("/__whoami")
def __whoami():
    import sys
    try:
        import app as app_mod
        app_file = inspect.getsourcefile(app_mod) or getattr(app_mod, "__file__", None)
    except Exception:
        app_file = __file__
    return {
        "file": __file__,
        "detected_app_file": app_file,
        "cwd": os.getcwd(),
        "listdir_cwd": sorted(os.listdir(os.getcwd()))[:50],
    }

@app.options("/__whoami", include_in_schema=False)
def __whoami_options(request: Request):
    origin = request.headers.get("origin") or "*"
    return Response(status_code=204, headers={
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "Authorization,Content-Type",
        "access-control-max-age": "86400",
    })