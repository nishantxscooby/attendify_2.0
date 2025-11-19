"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { SystemOverview } from "@/components/admin/system-overview"
import { UserManagement } from "@/components/admin/user-management"
import { RegistrationPanel } from "@/components/admin/registration-panel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCheck, GraduationCap, Settings } from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/admin", icon: <Settings className="h-5 w-5" />, current: true },
  { name: "Users", href: "/admin/users", icon: <Users className="h-5 w-5" /> },
  { name: "Teachers", href: "/admin/teachers", icon: <UserCheck className="h-5 w-5" /> },
  { name: "Students", href: "/admin/students", icon: <GraduationCap className="h-5 w-5" /> },
]

export default function AdminDashboard() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("idToken") : null
    const role =
      typeof window !== "undefined"
        ? localStorage.getItem("role") || localStorage.getItem("userRole")
        : null

    if (!token) {
      router.replace("/login")
      return
    }
    if (role && role.toLowerCase() !== "admin") {
      router.replace("/")
      return
    }
    setReady(true)
  }, [router])

  if (!ready) return null

  return (
    <DashboardLayout title="Admin Dashboard" userType="admin" navigation={navigation}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,245</div>
              <p className="text-xs text-muted-foreground">+12 from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">87</div>
              <p className="text-xs text-muted-foreground">+3 from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">23</div>
              <p className="text-xs text-muted-foreground">Currently running</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">98%</div>
              <p className="text-xs text-muted-foreground">All systems operational</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RegistrationPanel />
          <SystemOverview />
        </div>

        <UserManagement />
      </div>
    </DashboardLayout>
  )
}
