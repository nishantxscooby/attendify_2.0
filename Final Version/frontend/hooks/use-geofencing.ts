"use client"

import { useState, useEffect, useCallback } from "react"

interface GeofenceConfig {
  center: { lat: number; lng: number }
  radius: number // in meters
  name: string
}

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: Date
}

interface UseGeofencingReturn {
  isActive: boolean
  location: LocationData | null
  isInsideGeofence: boolean
  distance: number | null
  error: string | null
  startTracking: () => void
  stopTracking: () => void
  updateGeofence: (config: GeofenceConfig) => void
}

export function useGeofencing(initialGeofence?: GeofenceConfig): UseGeofencingReturn {
  const [isActive, setIsActive] = useState(false)
  const [location, setLocation] = useState<LocationData | null>(null)
  const [isInsideGeofence, setIsInsideGeofence] = useState(false)
  const [distance, setDistance] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [geofence, setGeofence] = useState<GeofenceConfig>(
    initialGeofence || {
      center: { lat: 40.7128, lng: -74.006 }, // Default: NYC
      radius: 500,
      name: "Campus",
    },
  )

  const calculateDistance = useCallback(
    (lat: number, lng: number): number => {
      const R = 6371e3 // Earth's radius in meters
      const φ1 = (geofence.center.lat * Math.PI) / 180
      const φ2 = (lat * Math.PI) / 180
      const Δφ = ((lat - geofence.center.lat) * Math.PI) / 180
      const Δλ = ((lng - geofence.center.lng) * Math.PI) / 180

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

      return R * c
    },
    [geofence.center],
  )

  const updateLocation = useCallback(
    (position: GeolocationPosition) => {
      const newLocation: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date(),
      }

      setLocation(newLocation)
      setError(null)

      // Calculate distance from geofence center
      const dist = calculateDistance(newLocation.latitude, newLocation.longitude)
      setDistance(dist)

      // Check if inside geofence
      const inside = dist <= geofence.radius
      setIsInsideGeofence(inside)

      // Log geofence events
      if (inside !== isInsideGeofence) {
        console.log(`[v0] Geofence ${inside ? "entered" : "exited"}: ${geofence.name}`)
        console.log(`[v0] Distance from center: ${dist.toFixed(2)}m`)
      }
    },
    [calculateDistance, geofence.radius, geofence.name, isInsideGeofence],
  )

  const handleLocationError = useCallback((error: GeolocationPositionError) => {
    console.error("Geolocation error:", error)
    let errorMessage = "Unable to get location"

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = "Location access denied. Please enable location services."
        break
      case error.POSITION_UNAVAILABLE:
        errorMessage = "Location information unavailable."
        break
      case error.TIMEOUT:
        errorMessage = "Location request timed out."
        break
    }

    setError(errorMessage)
    setIsInsideGeofence(false)
  }, [])

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser")
      return
    }

    setIsActive(true)
    setError(null)

    const watchId = navigator.geolocation.watchPosition(updateLocation, handleLocationError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000, // 30 seconds
    })

    // Store watch ID for cleanup
    ;(window as any).geofenceWatchId = watchId

    console.log(`[v0] Geofencing started for: ${geofence.name}`)
  }, [updateLocation, handleLocationError, geofence.name])

  const stopTracking = useCallback(() => {
    if ((window as any).geofenceWatchId) {
      navigator.geolocation.clearWatch((window as any).geofenceWatchId)
      ;(window as any).geofenceWatchId = null
    }

    setIsActive(false)
    setLocation(null)
    setDistance(null)
    setIsInsideGeofence(false)

    console.log(`[v0] Geofencing stopped`)
  }, [])

  const updateGeofence = useCallback(
    (config: GeofenceConfig) => {
      setGeofence(config)
      console.log(`[v0] Geofence updated: ${config.name} (${config.radius}m radius)`)

      // Recalculate if we have a current location
      if (location) {
        const dist = calculateDistance(location.latitude, location.longitude)
        setDistance(dist)
        setIsInsideGeofence(dist <= config.radius)
      }
    },
    [location, calculateDistance],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking()
    }
  }, [stopTracking])

  return {
    isActive,
    location,
    isInsideGeofence,
    distance,
    error,
    startTracking,
    stopTracking,
    updateGeofence,
  }
}
