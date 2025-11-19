"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AttendanceOverview } from "@/components/student/attendance-overview";
import { ClassSchedule } from "@/components/student/class-schedule";
import { AttendanceRecord } from "@/components/student/attendance-record";
import { LocationStatus } from "@/components/student/location-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, CheckCircle, AlertCircle } from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/student", icon: <Calendar className="h-5 w-5" />, current: true },
  { name: "Attendance", href: "/student/attendance", icon: <CheckCircle className="h-5 w-5" /> },
  { name: "Schedule", href: "/student/schedule", icon: <Clock className="h-5 w-5" /> },
  { name: "Profile", href: "/student/profile", icon: <AlertCircle className="h-5 w-5" /> },
];

export default function StudentDashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Tiny client-side guard so static export waits for localStorage and role
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("idToken") : null;
    const role =
      typeof window !== "undefined"
        ? (localStorage.getItem("role") || localStorage.getItem("userRole") || "").toLowerCase()
        : "";

    if (!token) {
      router.replace("/login");
      return;
    }
    if (role && role !== "student") {
      router.replace("/");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <DashboardLayout title="Student Dashboard" userType="student" navigation={navigation}>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Attendance</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">87%</div>
              <p className="text-xs text-muted-foreground">+2% from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Classes Attended</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">42</div>
              <p className="text-xs text-muted-foreground">Out of 48 total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5/6</div>
              <p className="text-xs text-muted-foreground">Classes attended</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Streak</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">Days consecutive</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <AttendanceOverview refreshToken={0} />
            <AttendanceRecord refreshToken={0} />
          </div>
          <div className="space-y-6">
            <LocationStatus />
            <ClassSchedule />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
