"""Minimal FaceNet-like microservice with deterministic embeddings."""
import base64
import io
import os
import pickle
import threading
from typing import Dict, List, Tuple, Optional, Union

import numpy as np
from flask import Flask, jsonify, request
from PIL import Image

# -----------------------------
# Config
# -----------------------------
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.4"))
EMBEDDINGS_PATH = os.getenv(
    "EMBEDDINGS_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "embeddings.pkl"),
)
PORT = int(os.getenv("PORT", "5001"))

# -----------------------------
# App / State
# -----------------------------
app = Flask(__name__)
_embeddings: Dict[str, np.ndarray] = {}
_lock = threading.Lock()

# -----------------------------
# Persistence
# -----------------------------
def _load_embeddings() -> None:
    if os.path.exists(EMBEDDINGS_PATH):
        with open(EMBEDDINGS_PATH, "rb") as handle:
            raw = pickle.load(handle)
        with _lock:
            _embeddings.clear()
            for key, value in raw.items():
                _embeddings[key] = np.asarray(value, dtype="float32")


def _save_embeddings() -> None:
    with _lock:
        serializable = {k: v.tolist() for k, v in _embeddings.items()}
    with open(EMBEDDINGS_PATH, "wb") as handle:
        pickle.dump(serializable, handle)

# -----------------------------
# Image / Embedding helpers
# -----------------------------
def _normalize_base64(data: str) -> bytes:
    """Accept data URLs or raw/url-safe base64; fix padding."""
    payload = (data or "").strip()
    if payload.startswith("data:"):
        payload = payload.split(",", 1)[1]
    payload = payload.replace(" ", "").replace("\n", "").replace("\r", "")
    # urlsafe chars already handled by urlsafe_b64decode
    missing = len(payload) % 4
    if missing:
        payload += "=" * (4 - missing)
    return base64.urlsafe_b64decode(payload)


def _decode_image(source: Union[bytes, str]) -> np.ndarray:
    """Return BGR uint8 image."""
    blob = source if isinstance(source, (bytes, bytearray)) else _normalize_base64(source)
    image = Image.open(io.BytesIO(blob))
    # Normalize mode → RGB
    if image.mode != "RGB":
        image = image.convert("RGB")
    rgb = np.asarray(image, dtype="uint8")
    bgr = rgb[:, :, ::-1].copy()
    return bgr


def _compute_embedding(image_bgr: np.ndarray) -> np.ndarray:
    """Deterministic 64x64 L2-normalized vector."""
    rgb = image_bgr[:, :, ::-1]
    resized = Image.fromarray(rgb).resize((64, 64))
    vec = np.asarray(resized, dtype="float32").reshape(-1)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec


def _distance(a: np.ndarray, b: np.ndarray) -> float:
    if a.shape != b.shape:
        raise ValueError("embedding shapes do not match")
    return float(np.linalg.norm(a - b))


def _score_from_distance(distance: float) -> float:
    return max(0.0, 1.0 - float(distance))


def _extract_image_from_request() -> Optional[bytes]:
    """Get raw image bytes from either multipart 'image' or JSON {image: <b64/dataURL>}."""
    if request.files:
        file = request.files.get("image")
        if file:
            return file.read()
        return None
    payload = request.get_json(silent=True) or {}
    val = payload.get("image")
    if not val:
        return None
    return _normalize_base64(val) if isinstance(val, str) else val

# -----------------------------
# Routes
# -----------------------------
@app.get("/health")
def health():
    return jsonify({"ok": True})

# --- Embedding APIs (for backend) ---
@app.post("/embed")
def embed():
    """
    Accepts:
      - JSON: { "image": "<dataURL or base64>" }
      - OR multipart: image=@file
    Returns:
      { "embedding": [float, ...], "ok": true }
    """
    # Try multipart first
    img_bytes = None
    if request.files:
        f = request.files.get("image")
        if f:
            img_bytes = f.read()
    if img_bytes is None:
        payload = request.get_json(force=True, silent=True)
        if not payload or "image" not in payload:
            return jsonify({"error": "image is required"}), 400
        val = payload["image"]
        img_bytes = _normalize_base64(val) if isinstance(val, str) else val

    try:
        emb = _compute_embedding(_decode_image(img_bytes))
    except Exception as e:
        return jsonify({"error": f"decode_failed: {e}"}), 400

    return jsonify({"embedding": emb.tolist(), "ok": True})


@app.post("/embed_upload")
def embed_upload():
    """Explicit multipart-only variant for convenience."""
    file = request.files.get("image")
    if not file:
        return jsonify({"error": "multipart field 'image' is required"}), 400
    try:
        emb = _compute_embedding(_decode_image(file.read()))
    except Exception as e:
        return jsonify({"error": f"decode_failed: {e}"}), 400
    return jsonify({"embedding": emb.tolist(), "ok": True})

# --- Pairwise verify ---
@app.post("/verify")
def verify():
    payload = request.get_json(force=True, silent=True)
    if not payload or "image_a" not in payload or "image_b" not in payload:
        return jsonify({"error": "fields 'image_a' and 'image_b' are required"}), 400

    image_a = _compute_embedding(_decode_image(payload["image_a"]))
    image_b = _compute_embedding(_decode_image(payload["image_b"]))
    distance = _distance(image_a, image_b)
    score = _score_from_distance(distance)
    return jsonify(
        {
            "match": distance <= MATCH_THRESHOLD,
            "distance": distance,
            "score": score,
            "threshold": MATCH_THRESHOLD,
        }
    )


@app.post("/verify_upload")
def verify_upload():
    file_a = request.files.get("image_a")
    file_b = request.files.get("image_b")
    if not file_a or not file_b:
        return jsonify({"error": "multipart fields 'image_a' and 'image_b' are required"}), 400

    image_a = _compute_embedding(_decode_image(file_a.read()))
    image_b = _compute_embedding(_decode_image(file_b.read()))
    distance = _distance(image_a, image_b)
    score = _score_from_distance(distance)
    return jsonify(
        {
            "match": distance <= MATCH_THRESHOLD,
            "distance": distance,
            "score": score,
            "threshold": MATCH_THRESHOLD,
        }
    )

# --- Enrollment / Recognition ---
@app.post("/enroll")
def enroll():
    """
    Enroll a student with an image.
    Accepts:
      - multipart: fields student_id|studentId + image=@file
      - JSON: { "student_id"|"studentId": "...", "image": "<dataURL/base64>" }
    """
    student_id = None
    image_bytes = None

    if request.files:
        student_id = request.form.get("student_id") or request.form.get("studentId")
        file = request.files.get("image")
        if file:
            image_bytes = file.read()
    else:
        payload = request.get_json(force=True, silent=True)
        if payload:
            student_id = payload.get("student_id") or payload.get("studentId")
            image_field = payload.get("image")
            if image_field is not None:
                image_bytes = _normalize_base64(image_field) if isinstance(image_field, str) else image_field

    if not student_id or not image_bytes:
        return jsonify({"error": "student_id and image are required"}), 400

    emb = _compute_embedding(_decode_image(image_bytes))
    with _lock:
        _embeddings[str(student_id)] = emb
    _save_embeddings()
    return jsonify({"ok": True, "studentId": student_id})


def _recognize_from_image(image_bgr: np.ndarray) -> Tuple[List[dict], List[dict]]:
    probe = _compute_embedding(image_bgr)
    with _lock:
        if not _embeddings:
            return [], []
        results: List[dict] = []
        for sid, stored in _embeddings.items():
            dist = _distance(probe, stored)
            results.append(
                {
                    "student_id": sid,
                    "distance": dist,
                    "score": _score_from_distance(dist),
                    "match": dist <= MATCH_THRESHOLD,
                }
            )
    results.sort(key=lambda x: x["distance"])

    # Dummy single "face" covering full frame for compatibility
    h, w = image_bgr.shape[:2]
    faces: List[dict] = []
    if h > 0 and w > 0:
        top = results[0] if results else None
        faces.append(
            {
                "bbox": [0, 0, int(w), int(h)],
                "confidence": 1.0,
                "distance": top.get("distance") if top else None,
                "match": (top["student_id"] if top and top["distance"] <= MATCH_THRESHOLD else None),
            }
        )
    return results, faces


@app.post("/recognize")
def recognize():
    img_bytes = _extract_image_from_request()
    if not img_bytes:
        return jsonify({"error": "image is required"}), 400

    try:
        image_bgr = _decode_image(img_bytes)
    except Exception as e:
        return jsonify({"error": f"decode_failed: {e}"}), 400

    recognized, faces = _recognize_from_image(image_bgr)
    return jsonify({"recognized": recognized, "faces": faces, "threshold": MATCH_THRESHOLD})

# -----------------------------
# Bootstrap
# -----------------------------
_load_embeddings()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
