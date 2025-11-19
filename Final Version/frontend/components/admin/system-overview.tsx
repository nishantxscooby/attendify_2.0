"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Activity, Database, Camera, MapPin } from "lucide-react"

export function SystemOverview() {
  const systemStats = [
    {
      name: "Database",
      status: "operational",
      uptime: 99.9,
      icon: <Database className="h-4 w-4" />,
      description: "All database connections healthy",
    },
    {
      name: "Camera System",
      status: "operational",
      uptime: 98.5,
      icon: <Camera className="h-4 w-4" />,
      description: "23 cameras active across campus",
    },
    {
      name: "Geofencing",
      status: "operational",
      uptime: 99.2,
      icon: <MapPin className="h-4 w-4" />,
      description: "Location services running smoothly",
    },
    {
      name: "Face Recognition",
      status: "warning",
      uptime: 95.8,
      icon: <Activity className="h-4 w-4" />,
      description: "Minor performance degradation detected",
    },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "operational":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Operational</Badge>
      case "warning":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Warning</Badge>
      case "error":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Error</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Overview
        </CardTitle>
        <CardDescription>Monitor system health and performance metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {systemStats.map((system, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {system.icon}
                  <h3 className="font-medium text-sm">{system.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{system.uptime}%</span>
                  {getStatusBadge(system.status)}
                </div>
              </div>
              <Progress value={system.uptime} className="h-2" />
              <p className="text-xs text-muted-foreground">{system.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-sm mb-2">Recent Activity</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>• 15 new students registered today</p>
            <p>• 23 active attendance sessions</p>
            <p>• 1,245 face recognition scans completed</p>
            <p>• System backup completed at 2:00 AM</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
