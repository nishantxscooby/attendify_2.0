import express from "express";
import cors from "cors";
import { verifyIdToken } from "./src/firebase.js";
import repo from "./src/repo/firestoreRepo.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const FACENET_URL = (process.env.FACENET_URL || "").replace(/\/$/, "");

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/me", verifyIdToken, (req, res) => {
  const claims = req.firebaseClaims || {};
  res.json({ uid: claims.uid || null, role: claims.role || null });
});

app.get("/attendance", verifyIdToken, async (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId query parameter is required" });
  }

  try {
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const records = await repo.listAttendanceBySession(sessionId, limit);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch attendance", details: error.message });
  }
});

app.post("/attendance", verifyIdToken, async (req, res) => {
  const { sessionId, userId, status = "present", confidence, imagePath, metadata } = req.body || {};

  if (!sessionId || !userId) {
    return res.status(400).json({ error: "sessionId and userId are required" });
  }

  try {
    const docId = await repo.createAttendance({
      sessionId,
      userId,
      status,
      confidence: confidence ?? null,
      imagePath: imagePath ?? null,
      metadata: metadata ?? null,
      createdBy: req.firebaseClaims?.uid || null,
    });

    res.status(201).json({
      id: docId,
      sessionId,
      userId,
      status,
      confidence: confidence ?? null,
      imagePath: imagePath ?? null,
      metadata: metadata ?? null,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create attendance", details: error.message });
  }
});

app.post("/face/verify", verifyIdToken, async (req, res) => {
  if (!FACENET_URL) {
    return res.status(503).json({ error: "FaceNet service not configured" });
  }

  try {
    const response = await fetch(`${FACENET_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: "FaceNet proxy failed", details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Attendance API listening on port ${PORT}`);
});
