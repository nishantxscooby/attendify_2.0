'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Users, GraduationCap } from 'lucide-react'

export default function AdminTeachersPage() {
  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: <User className="h-5 w-5" /> },
    { name: 'Users', href: '/admin/users', icon: <Users className="h-5 w-5" /> },
    { name: 'Teachers', href: '/admin/teachers', icon: <GraduationCap className="h-5 w-5" />, current: true },
    { name: 'Students', href: '/admin/students', icon: <Users className="h-5 w-5" /> },
  ]

  const teachers = [
    { id: 'T001', name: 'Prof. Smith', subject: 'Computer Science' },
    { id: 'T002', name: 'Dr. Johnson', subject: 'Mathematics' },
  ]

  return (
    <DashboardLayout title="Teachers" userType="admin" navigation={navigation}>
      <Card>
        <CardHeader><CardTitle>Teacher Directory</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {teachers.map(t => (
              <li key={t.id} className="border rounded-md p-3">
                <div className="font-medium">{t.name}</div>
                <div className="text-sm text-muted-foreground">{t.subject}</div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
