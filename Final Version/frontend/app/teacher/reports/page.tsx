'use client'

import React from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Users, FileText, BookOpen } from 'lucide-react'

export default function TeacherReportsPage() {
  const navigation = [
    { name: 'Dashboard', href: '/teacher', icon: <Calendar className="h-5 w-5" /> },
    { name: 'Attendance', href: '/teacher/attendance', icon: <Users className="h-5 w-5" /> },
    { name: 'Classes', href: '/teacher/classes', icon: <BookOpen className="h-5 w-5" /> },
    { name: 'Reports', href: '/teacher/reports', icon: <FileText className="h-5 w-5" />, current: true },
  ]

  return (
    <DashboardLayout title="Reports" userType="teacher" navigation={navigation}>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Class Attendance Report</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Downloadable reports for each class.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Student Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Graphs and data exports coming soon.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
