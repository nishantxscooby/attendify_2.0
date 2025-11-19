"use client"

import { useState } from "react"

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { AttendanceOverview } from '@/components/student/attendance-overview'
import { AttendanceRecord } from '@/components/student/attendance-record'
import { Button } from '@/components/ui/button'
import { Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { apiFetch } from '@/lib/api'

export default function StudentAttendancePage() {
  const [refreshToken, setRefreshToken] = useState(0)
  const [isCheckingIn, setIsCheckingIn] = useState(false)

  const handleCheckIn = async () => {
    setIsCheckingIn(true)
    try {
      const gps = await new Promise<{ lat: number; lng: number }>((resolve) =>
        navigator.geolocation
          ? navigator.geolocation.getCurrentPosition(
              (position) =>
                resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
              () => resolve({ lat: 0, lng: 0 })
            )
          : resolve({ lat: 0, lng: 0 })
      )

      const response = await apiFetch('/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lectureId: 'demo', gps }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Request failed with status ${response.status}`)
      }

      const data = await response.json()
      console.log('check-in result', data)
      alert(data.ok ? 'Checked in!' : 'Check-in failed')
      setRefreshToken((prev) => prev + 1)
    } catch (error) {
      console.error('Check-in error', error)
      alert('Unable to check in. Please try again.')
    } finally {
      setIsCheckingIn(false)
    }
  }

  return (
    <DashboardLayout
      title="Attendance"
      userType="student"
      navigation={[
        { name: 'Dashboard', href: '/student', icon: <Calendar className="h-5 w-5" /> },
        { name: 'Attendance', href: '/student/attendance', icon: <CheckCircle className="h-5 w-5" />, current: true },
        { name: 'Schedule', href: '/student/schedule', icon: <Clock className="h-5 w-5" /> },
        { name: 'Profile', href: '/student/profile', icon: <AlertCircle className="h-5 w-5" /> },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Today</h2>
          <Button onClick={handleCheckIn} disabled={isCheckingIn}>
            {isCheckingIn ? 'Checking in...' : 'GPS Check-in'}
          </Button>
        </div>
        <AttendanceOverview refreshToken={refreshToken} />
        <AttendanceRecord refreshToken={refreshToken} />
      </div>
    </DashboardLayout>
  )
}

