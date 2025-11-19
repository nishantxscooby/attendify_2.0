'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { User, Users, GraduationCap } from 'lucide-react'

export default function AdminUsersPage() {
  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: <User className="h-5 w-5" /> },
    { name: 'Users', href: '/admin/users', icon: <Users className="h-5 w-5" />, current: true },
    { name: 'Teachers', href: '/admin/teachers', icon: <GraduationCap className="h-5 w-5" /> },
    { name: 'Students', href: '/admin/students', icon: <Users className="h-5 w-5" /> },
  ]

  // Mock data – later replace with API fetch
  const users = [
    { id: 1, name: 'Alice Johnson', role: 'Student', email: 'alice@example.com' },
    { id: 2, name: 'Prof. Smith', role: 'Teacher', email: 'smith@college.edu' },
    { id: 3, name: 'Admin1', role: 'Admin', email: 'admin1@system.com' },
  ]

  return (
    <DashboardLayout title="Users" userType="admin" navigation={navigation}>
      <Card>
        <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.role}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
