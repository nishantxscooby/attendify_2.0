"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CameraFeed } from "@/components/camera/camera-feed";
import { GeofencingStatus } from "@/components/camera/geofencing-status";
import { ManualAttendance } from "@/components/teacher/manual-attendance";
import { Play, Square, Camera, MapPin, Clock, Users } from "lucide-react";

type PresentableStatus = "present" | "absent" | "late" | "excused";

interface DetectedFace {
  id: string;         // MUST match students.id in DB
  name: string;
  confidence: number; // 0..1
  timestamp: Date;
}

const RECENT_LIMIT = 30;         // keep only last N badges
const DETECTION_FLUSH_MS = 300;  // throttle rate for updates

export default function AttendanceSession() {
  const [classes, setClasses] = useState<Array<{ id: number; class_name: string; section: string | null }>>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [sessionActive, setSessionActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const [sessionTime, setSessionTime] = useState(0);
  const [uniqueCount, setUniqueCount] = useState(0);
  const [totalScans, setTotalScans] = useState(0);
  const [recent, setRecent] = useState<DetectedFace[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Refs (not reactive): fast, no re-render storms
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uniqueRef = useRef<Map<string, DetectedFace>>(new Map());
  const pendingRef = useRef<DetectedFace[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Load classes once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/classes");
        const data = await res.json();
        if (!alive) return;
        if (res.ok && data?.ok && Array.isArray(data.data)) {
          setClasses(data.data);
          if (data.data.length === 1) setSelectedClass(String(data.data[0].id));
        }
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);

  const classLabel = useMemo(() => {
    const cls = classes.find(c => String(c.id) === selectedClass);
    if (!cls) return "";
    return `${cls.class_name}${cls.section ? ` • ${cls.section}` : ""}`;
  }, [classes, selectedClass]);

  function startSession() {
    if (!selectedClass) {
      setMessage("Choose a class to start.");
      return;
    }
    setSessionActive(true);
    setCameraActive(true);
    setSessionTime(0);
    setMessage(null);

    // reset buffers
    uniqueRef.current.clear();
    pendingRef.current = [];
    setUniqueCount(0);
    setTotalScans(0);
    setRecent([]);

    // 1-second timer
    timerRef.current = setInterval(() => setSessionTime(t => t + 1), 1000);
  }

  async function stopSession() {
    setSessionActive(false);
    setCameraActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;

    await saveAttendance();
  }

  // Throttled flush from pending -> state
  function scheduleFlush() {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;

      const pending = pendingRef.current;
      if (pending.length === 0) return;

      // total scans is cheap
      setTotalScans(t => t + pending.length);

      // update unique map with best-confidence record per id
      const map = uniqueRef.current;
      for (const s of pending) {
        const prev = map.get(s.id);
        if (!prev || prev.confidence < s.confidence) map.set(s.id, s);
      }
      pendingRef.current = [];

      // update unique count + recent list (cap)
      setUniqueCount(map.size);
      setRecent(prev => {
        const merged = [...prev, ...pending].slice(-RECENT_LIMIT);
        return merged;
      });
    }, DETECTION_FLUSH_MS);
  }

  // Called by CameraFeed at high FPS -> we throttle updates into small batches
  function handleFaceDetected(faces: DetectedFace[]) {
    if (!faces || faces.length === 0) return;
    // normalize timestamps (ensure Date)
    const normalized = faces.map(f => ({
      ...f,
      timestamp: f.timestamp instanceof Date ? f.timestamp : new Date(f.timestamp as any)
    }));
    pendingRef.current.push(...normalized);
    scheduleFlush();
  }

  function handleManualAttendance(student: { id: string; name: string; status?: PresentableStatus }) {
    const entry: DetectedFace = {
      id: student.id,
      name: student.name,
      confidence: 1.0,
      timestamp: new Date(),
    };
    pendingRef.current.push(entry);
    scheduleFlush();
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  // Save to API using your schema
  async function saveAttendance() {
    if (!selectedClass) {
      setMessage("No class selected.");
      return;
    }
    const uniq = uniqueRef.current;
    if (uniq.size === 0) {
      setMessage("No detections to save.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const items = Array.from(uniq.values()).map(s => ({
        student_id: Number(s.id),            // must exist & be enrolled
        status: "present",                   // normalize late->present for current schema
        time: s.timestamp.toISOString(),
        recognized_name: s.name,
      }));

      const res = await fetch("/api/attendance/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: Number(selectedClass),
          date,
          items,
          source: "facial",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Failed to save attendance");

      setMessage(`Saved ${data.inserted} attendance record(s) for ${classLabel}.`);
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  }

  const timeMMSS = `${String(Math.floor(sessionTime / 60)).padStart(2, "0")}:${String(sessionTime % 60).padStart(2, "0")}`;

  const onRecognizedAdapter = (result: any) => {
    const faces = Array.isArray(result) ? result : (result?.faces ?? []);
    handleFaceDetected(faces);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Facial Attendance
          </CardTitle>
          <CardDescription>Start and manage AI-powered attendance sessions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Class</label>
            <Select value={selectedClass} onValueChange={setSelectedClass} disabled={sessionActive}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={String(cls.id)}>
                    {cls.class_name}{cls.section ? ` • ${cls.section}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sessionActive && (
            <div className="space-y-4 rounded-lg bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">
                    <div className="mr-1 h-2 w-2 animate-pulse rounded-full bg-white" />
                    LIVE SESSION
                  </Badge>
                  <span className="text-sm font-medium">{classLabel}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  {timeMMSS}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-blue-500" />
                  <span>Camera: {cameraActive ? "Active" : "Inactive"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-500" />
                  <span>Geofencing: On</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  <span>Unique Students: {uniqueCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span>Total Scans: {totalScans}</span>
                </div>
              </div>

              {recent.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Recent Detections</h4>
                  <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
                    {recent.slice(-RECENT_LIMIT).map((s, i) => (
                      <Badge key={`${s.id}-${i}`} variant="secondary" className="text-xs">
                        {s.name} {(s.confidence * 100).toFixed(0)}%
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {!sessionActive ? (
              <Button onClick={startSession} disabled={!selectedClass} className="flex-1">
                <Play className="mr-2 h-4 w-4" />
                Start Session
              </Button>
            ) : (
              <Button onClick={stopSession} variant="destructive" disabled={saving} className="flex-1">
                <Square className="mr-2 h-4 w-4" />
                {saving ? "Saving…" : "Stop & Save"}
              </Button>
            )}
          </div>

          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>

      {sessionActive && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CameraFeed
            isActive={cameraActive}
            onToggle={setCameraActive}
            onRecognized={onRecognizedAdapter}
          />
          <GeofencingStatus isActive={sessionActive} />
        </div>
      )}

      {sessionActive && (
        <ManualAttendance classId={selectedClass} onAdd={handleManualAttendance} />
      )}
    </div>
  );
}
