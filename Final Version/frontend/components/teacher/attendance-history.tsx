"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { useAttendanceStream, createAttendanceRecord } from "@/hooks/use-attendance";

export default function AttendanceHistory() {
  const [sessionId, setSessionId] = useState("");
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("present");
  const [saving, setSaving] = useState(false);
  const trimmedSessionId = sessionId.trim();

  const { records, loading, error } = useAttendanceStream({ sessionId: trimmedSessionId || null });

  const orderedRecords = useMemo(() => records, [records]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmedSessionId || !userId.trim()) return;
    setSaving(true);
    try {
      await createAttendanceRecord({
        sessionId: trimmedSessionId,
        userId: userId.trim(),
        status,
      });
      setUserId("");
    } catch (err) {
      console.error("Failed to create attendance record", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Attendance Stream</CardTitle>
          <CardDescription>Realtime updates are powered by Firestore onSnapshot.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="session-id">Session ID</Label>
              <Input
                id="session-id"
                placeholder="e.g. session_123"
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
              />
            </div>
            <form className="space-y-2" onSubmit={handleSubmit}>
              <Label htmlFor="user-id">Quick mark present</Label>
              <div className="flex gap-2">
                <Input
                  id="user-id"
                  placeholder="student uid"
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  disabled={!trimmedSessionId}
                />
                <Button type="submit" disabled={!trimmedSessionId || !userId.trim() || saving}>
                  {saving ? "Saving…" : "Mark Present"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Creates a Firestore document with a server timestamp and status "{status}".
              </p>
            </form>
          </div>

          <div className="text-sm text-muted-foreground">
            {trimmedSessionId
              ? loading ? "Listening for changes…" : `${orderedRecords.length} record(s) loaded.`
              : "Enter a session ID to start streaming attendance records."}
            {error && <span className="ml-2 text-destructive">{error.message}</span>}
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="p-3">User</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Confidence</th>
                  <th className="p-3">Captured</th>
                </tr>
              </thead>
              <tbody>
                {orderedRecords.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-muted-foreground">
                      No attendance records yet.
                    </td>
                  </tr>
                )}
                {orderedRecords.map((record) => (
                  <tr key={record.id} className="border-t">
                    <td className="p-3">{record.userId}</td>
                    <td className="p-3">
                      <Badge variant={record.status === "present" ? "default" : "secondary"}>
                        {record.status}
                      </Badge>
                    </td>
                    <td className="p-3">{record.confidence != null ? `${Math.round(record.confidence * 100)}%` : "–"}</td>
                    <td className="p-3">{record.capturedAt ? record.capturedAt.toLocaleString() : "pending"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { AttendanceHistory };
