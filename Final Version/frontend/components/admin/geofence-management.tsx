"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MapPin, Plus, Edit, Trash2, Save } from "lucide-react"

interface GeofenceZone {
  id: string
  name: string
  center: { lat: number; lng: number }
  radius: number
  status: "active" | "inactive"
  createdAt: string
  description: string
}

export function GeofenceManagement() {
  const [zones, setZones] = useState<GeofenceZone[]>([
    {
      id: "zone1",
      name: "Main Campus",
      center: { lat: 40.7128, lng: -74.006 },
      radius: 500,
      status: "active",
      createdAt: "2024-01-01",
      description: "Primary campus area including all academic buildings",
    },
    {
      id: "zone2",
      name: "Library Building",
      center: { lat: 40.713, lng: -74.005 },
      radius: 100,
      status: "active",
      createdAt: "2024-01-02",
      description: "Library and study areas",
    },
    {
      id: "zone3",
      name: "Sports Complex",
      center: { lat: 40.7125, lng: -74.007 },
      radius: 200,
      status: "inactive",
      createdAt: "2024-01-03",
      description: "Athletic facilities and sports grounds",
    },
  ])

  const [isEditing, setIsEditing] = useState(false)
  const [editingZone, setEditingZone] = useState<GeofenceZone | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    latitude: "",
    longitude: "",
    radius: "",
    description: "",
  })

  const handleEdit = (zone: GeofenceZone) => {
    setEditingZone(zone)
    setFormData({
      name: zone.name,
      latitude: zone.center.lat.toString(),
      longitude: zone.center.lng.toString(),
      radius: zone.radius.toString(),
      description: zone.description,
    })
    setIsEditing(true)
  }

  const handleSave = () => {
    if (editingZone) {
      // Update existing zone
      setZones((prev) =>
        prev.map((zone) =>
          zone.id === editingZone.id
            ? {
                ...zone,
                name: formData.name,
                center: {
                  lat: Number.parseFloat(formData.latitude),
                  lng: Number.parseFloat(formData.longitude),
                },
                radius: Number.parseInt(formData.radius),
                description: formData.description,
              }
            : zone,
        ),
      )
    } else {
      // Add new zone
      const newZone: GeofenceZone = {
        id: `zone${zones.length + 1}`,
        name: formData.name,
        center: {
          lat: Number.parseFloat(formData.latitude),
          lng: Number.parseFloat(formData.longitude),
        },
        radius: Number.parseInt(formData.radius),
        status: "active",
        createdAt: new Date().toISOString().split("T")[0],
        description: formData.description,
      }
      setZones((prev) => [...prev, newZone])
    }

    // Reset form
    setIsEditing(false)
    setEditingZone(null)
    setFormData({ name: "", latitude: "", longitude: "", radius: "", description: "" })
  }

  const handleDelete = (zoneId: string) => {
    setZones((prev) => prev.filter((zone) => zone.id !== zoneId))
  }

  const toggleZoneStatus = (zoneId: string) => {
    setZones((prev) =>
      prev.map((zone) =>
        zone.id === zoneId ? { ...zone, status: zone.status === "active" ? "inactive" : "active" } : zone,
      ),
    )
  }

  const getStatusBadge = (status: string) => {
    return status === "active" ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Inactive</Badge>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Geofence Management
              </CardTitle>
              <CardDescription>Configure and manage geofencing zones for attendance validation</CardDescription>
            </div>
            <Button onClick={() => setIsEditing(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Zone
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone Name</TableHead>
                <TableHead>Coordinates</TableHead>
                <TableHead>Radius</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{zone.name}</div>
                      <div className="text-sm text-muted-foreground">{zone.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-mono">
                      <div>{zone.center.lat.toFixed(6)}</div>
                      <div>{zone.center.lng.toFixed(6)}</div>
                    </div>
                  </TableCell>
                  <TableCell>{zone.radius}m</TableCell>
                  <TableCell>
                    <button onClick={() => toggleZoneStatus(zone.id)}>{getStatusBadge(zone.status)}</button>
                  </TableCell>
                  <TableCell>{zone.createdAt}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(zone)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(zone.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit/Add Zone Form */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>{editingZone ? "Edit Geofence Zone" : "Add New Geofence Zone"}</CardTitle>
            <CardDescription>Configure the geofencing parameters for attendance validation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Zone Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Main Campus"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="radius">Radius (meters)</Label>
                <Input
                  id="radius"
                  type="number"
                  placeholder="500"
                  value={formData.radius}
                  onChange={(e) => setFormData((prev) => ({ ...prev, radius: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  placeholder="40.7128"
                  value={formData.latitude}
                  onChange={(e) => setFormData((prev) => ({ ...prev, latitude: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  placeholder="-74.0060"
                  value={formData.longitude}
                  onChange={(e) => setFormData((prev) => ({ ...prev, longitude: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of the zone"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                {editingZone ? "Update Zone" : "Create Zone"}
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
