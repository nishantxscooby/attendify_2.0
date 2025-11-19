'use client'

import React from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ClassSchedule } from '@/components/student/class-schedule'
import { Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react'

export default function StudentSchedulePage(): JSX.Element {
  return (
    <DashboardLayout
      title="Schedule"
      userType="student"
      navigation={[
        { name: 'Dashboard', href: '/student', icon: <Calendar className="h-5 w-5" /> },
        { name: 'Attendance', href: '/student/attendance', icon: <CheckCircle className="h-5 w-5" /> },
        { name: 'Schedule', href: '/student/schedule', icon: <Clock className="h-5 w-5" />, current: true },
        { name: 'Profile', href: '/student/profile', icon: <AlertCircle className="h-5 w-5" /> },
      ]}
    >
      <div className="space-y-6">
        <ClassSchedule />
      </div>
    </DashboardLayout>
  )
}
