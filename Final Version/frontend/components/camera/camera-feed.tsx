"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Camera, CameraOff, Users, AlertCircle } from "lucide-react"
import { apiJson } from "@/lib/api"

export interface AttendanceMarkResult {
  matched: boolean
  studentId: number | null
  username?: string | null
  name?: string | null
  recognizedName?: string | null
  distance: number | null
  score: number | null
  threshold: number
  createdAt: string
  source?: string
  classId?: number | null
  attendanceRecorded?: boolean
}

interface CameraFeedProps {
  isActive: boolean
  onToggle: (active: boolean) => void
  onRecognized?: (result: AttendanceMarkResult) => void
  classId?: number | null
}

export function CameraFeed({ isActive, onToggle, onRecognized, classId }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string>("")
  const [frameCount, setFrameCount] = useState(0)
  const [records, setRecords] = useState<AttendanceMarkResult[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (isActive) {
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      stopCamera()
    }
  }, [isActive])

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      })

      setStream(mediaStream)
      setError("")
      inFlightRef.current = false

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
      }

      beginFrameCapture()
    } catch (err) {
      console.error("Error accessing camera:", err)
      setError("Unable to access camera. Please check permissions.")
      onToggle(false)
    }
  }

  const stopCamera = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    inFlightRef.current = false
    setRecords([])
    setFrameCount(0)
  }

  const beginFrameCapture = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    intervalRef.current = setInterval(() => {
      if (!isActive) return
      captureAndAnalyzeFrame()
    }, 5000)
  }

  const captureAndAnalyzeFrame = async () => {
    if (inFlightRef.current) {
      return
    }

    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setFrameCount((prev) => prev + 1)

    try {
      inFlightRef.current = true
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
      const payload: Record<string, unknown> = { image: dataUrl, source: "webcam" }
      if (typeof classId === "number" && Number.isFinite(classId)) {
        payload.classId = classId
      }
      const result = await apiJson<AttendanceMarkResult>("/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      setRecords((prev) => [...prev, result].slice(-10))
      onRecognized?.(result)
    } catch (err) {
      console.error("Error sending frame to attendance endpoint:", err)
      setError("Unable to send frame to attendance service.")
    } finally {
      inFlightRef.current = false
    }
  }

  const handleToggle = () => {
    onToggle(!isActive)
  }

  const latestRecords = records.slice().reverse()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Camera Feed
            </CardTitle>
            <CardDescription>Live camera feed for face recognition attendance</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isActive && (
              <Badge variant="default" className="bg-green-500">
                <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                LIVE
              </Badge>
            )}
            <Button onClick={handleToggle} variant={isActive ? "destructive" : "default"} size="sm">
              {isActive ? <CameraOff className="h-4 w-4 mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
              {isActive ? "Stop" : "Start"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        <div className="relative">
          <video
            ref={videoRef}
            className="w-full h-64 bg-gray-900 rounded-lg object-cover"
            autoPlay
            muted
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />

          {!isActive && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
              <div className="text-center">
                <Camera className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Camera is off</p>
              </div>
            </div>
          )}

          {isActive && (
            <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
              Frames: {frameCount}
            </div>
          )}
        </div>

        {isActive && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Recognized Students ({records.length})
              </h4>
              <span className="text-xs text-muted-foreground">Latest 10</span>
            </div>

            {latestRecords.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {latestRecords.map((record, index) => (
                  <div key={`${record.createdAt}-${index}`} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <span className="text-sm font-medium">
                        {record.matched
                          ? record.recognizedName || record.name || record.username || (record.studentId ? `ID ${record.studentId}` : "Unknown")
                          : "Unknown"}
                      </span>
                      {record.score !== null && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {(record.score * 100).toFixed(0)}% confidence
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(record.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No recognitions yet</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
