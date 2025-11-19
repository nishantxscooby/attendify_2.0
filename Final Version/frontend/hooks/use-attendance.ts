"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "@/src/firebase";

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  userId: string;
  status: string;
  confidence?: number | null;
  imagePath?: string | null;
  metadata?: Record<string, unknown> | null;
  capturedAt?: Date | null;
}

interface UseAttendanceOptions {
  sessionId?: string | null;
  limit?: number;
}

export function useAttendanceStream({ sessionId, limit = 200 }: UseAttendanceOptions) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!sessionId || !sessionId.trim()) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const attendanceCol = collection(db, "attendance");
    const q = query(
      attendanceCol,
      where("sessionId", "==", sessionId.trim()),
      orderBy("capturedAt", "desc"),
      fsLimit(limit)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            sessionId: data.sessionId,
            userId: data.userId,
            status: data.status ?? "present",
            confidence: data.confidence ?? null,
            imagePath: data.imagePath ?? null,
            metadata: data.metadata ?? null,
            capturedAt: data.capturedAt?.toDate?.() ?? null,
          } satisfies AttendanceRecord;
        });
        setRecords(next);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [limit, sessionId]);

  const state = useMemo(() => ({ records, loading, error }), [records, loading, error]);
  return state;
}

interface CreateAttendanceInput {
  sessionId: string;
  userId: string;
  status?: string;
  confidence?: number | null;
  imagePath?: string | null;
  metadata?: Record<string, unknown> | null;
}

export const createAttendanceRecord = async (input: CreateAttendanceInput) => {
  const { sessionId, userId, status = "present", confidence = null, imagePath = null, metadata = null } = input;
  if (!sessionId || !userId) {
    throw new Error("sessionId and userId are required");
  }

  const payload = {
    sessionId,
    userId,
    status,
    confidence,
    imagePath,
    metadata,
    capturedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "attendance"), payload);
  return docRef.id;
};

export const useCreateAttendance = () => {
  return useCallback(async (input: CreateAttendanceInput) => createAttendanceRecord(input), []);
};
