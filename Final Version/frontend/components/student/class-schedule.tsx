"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, MapPin, User } from "lucide-react"

export function ClassSchedule() {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" })

  const schedule = [
    {
      time: "09:00 AM",
      subject: "Computer Science 101",
      instructor: "Dr. Smith",
      room: "Room 201",
      status: "upcoming",
      duration: "1h 30m",
    },
    {
      time: "11:00 AM",
      subject: "Mathematics 201",
      instructor: "Prof. Johnson",
      room: "Room 105",
      status: "current",
      duration: "2h 00m",
    },
    {
      time: "02:00 PM",
      subject: "Physics 301",
      instructor: "Dr. Williams",
      room: "Lab 301",
      status: "upcoming",
      duration: "1h 45m",
    },
    {
      time: "04:00 PM",
      subject: "English Literature",
      instructor: "Ms. Brown",
      room: "Room 150",
      status: "upcoming",
      duration: "1h 30m",
    },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "current":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Live</Badge>
      case "upcoming":
        return <Badge variant="outline">Upcoming</Badge>
      case "completed":
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Completed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Schedule</CardTitle>
        <CardDescription>{today} - Your classes for today</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {schedule.map((cls, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                cls.status === "current" ? "border-green-200 bg-green-50" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{cls.time}</span>
                    <span className="text-sm text-muted-foreground">({cls.duration})</span>
                  </div>
                  <h3 className="font-semibold">{cls.subject}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {cls.instructor}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {cls.room}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {getStatusBadge(cls.status)}
                  {cls.status === "current" && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      In Progress
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
