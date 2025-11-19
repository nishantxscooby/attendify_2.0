'use client'

import React from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Users, FileText, BookOpen } from 'lucide-react'

export default function TeacherClassesPage() {
  const navigation = [
    { name: 'Dashboard', href: '/teacher', icon: <Calendar className="h-5 w-5" /> },
    { name: 'Attendance', href: '/teacher/attendance', icon: <Users className="h-5 w-5" /> },
    { name: 'Classes', href: '/teacher/classes', icon: <BookOpen className="h-5 w-5" />, current: true },
    { name: 'Reports', href: '/teacher/reports', icon: <FileText className="h-5 w-5" /> },
  ]

  return (
    <DashboardLayout title="My Classes" userType="teacher" navigation={navigation}>
      <Card>
        <CardHeader>
          <CardTitle>Assigned Classes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="p-3 rounded-md border">Computer Science 101  Section A</li>
            <li className="p-3 rounded-md border">Mathematics 201  Section B</li>
            <li className="p-3 rounded-md border">Physics 301  Lab</li>
          </ul>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
