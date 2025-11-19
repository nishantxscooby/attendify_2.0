"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, CheckCircle, XCircle, AlertTriangle } from "lucide-react"

interface GeofencingStatusProps {
  isActive: boolean
}

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: Date
}

export function GeofencingStatus({ isActive }: GeofencingStatusProps) {
  const [location, setLocation] = useState<LocationData | null>(null)
  const [locationStatus, setLocationStatus] = useState<"checking" | "inside" | "outside" | "error">("checking")
  const [error, setError] = useState<string>("")

  // Mock campus boundaries (in a real app, this would be more sophisticated)
  const campusBoundaries = {
    center: { lat: 40.7128, lng: -74.006 }, // Example: NYC coordinates
    radius: 500, // 500 meters radius
  }

  useEffect(() => {
    if (isActive) {
      startLocationTracking()
    } else {
      stopLocationTracking()
    }

    return () => {
      stopLocationTracking()
    }
  }, [isActive])

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser")
      setLocationStatus("error")
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(),
        }

        setLocation(newLocation)
        setError("")

        // Check if location is within campus boundaries
        const isWithinBoundaries = checkLocationBoundaries(newLocation)
        setLocationStatus(isWithinBoundaries ? "inside" : "outside")
      },
      (error) => {
        console.error("Geolocation error:", error)
        setError("Unable to get location. Please enable location services.")
        setLocationStatus("error")
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // 1 minute
      },
    )

    // Store watch ID for cleanup
    ;(window as any).geolocationWatchId = watchId
  }

  const stopLocationTracking = () => {
    if ((window as any).geolocationWatchId) {
      navigator.geolocation.clearWatch((window as any).geolocationWatchId)
      ;(window as any).geolocationWatchId = null
    }
    setLocation(null)
    setLocationStatus("checking")
  }

  const checkLocationBoundaries = (loc: LocationData): boolean => {
    // Calculate distance from campus center using Haversine formula
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (campusBoundaries.center.lat * Math.PI) / 180
    const φ2 = (loc.latitude * Math.PI) / 180
    const Δφ = ((loc.latitude - campusBoundaries.center.lat) * Math.PI) / 180
    const Δλ = ((loc.longitude - campusBoundaries.center.lng) * Math.PI) / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c

    return distance <= campusBoundaries.radius
  }

  const getStatusIcon = () => {
    switch (locationStatus) {
      case "inside":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "outside":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return <MapPin className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = () => {
    switch (locationStatus) {
      case "inside":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Inside Campus</Badge>
      case "outside":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Outside Campus</Badge>
      case "error":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Location Error</Badge>
      default:
        return <Badge variant="outline">Checking...</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Geofencing Status
        </CardTitle>
        <CardDescription>Location-based attendance validation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium">Location Status</span>
          </div>
          {getStatusBadge()}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {location && !error && (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">Latitude:</span>
                <div className="font-mono">{location.latitude.toFixed(6)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Longitude:</span>
                <div className="font-mono">{location.longitude.toFixed(6)}</div>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Accuracy:</span>
              <span className="ml-2">±{Math.round(location.accuracy)}m</span>
            </div>
            <div>
              <span className="text-muted-foreground">Last Updated:</span>
              <span className="ml-2">{location.timestamp.toLocaleTimeString()}</span>
            </div>
          </div>
        )}

        {!isActive && (
          <div className="text-center py-4">
            <MapPin className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Geofencing is inactive</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
