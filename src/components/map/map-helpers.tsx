import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

export function FollowAircraft({
  lat,
  lon,
  shouldFollow
}: {
  lat: number | null
  lon: number | null
  shouldFollow: boolean
}) {
  const map = useMap()
  const lastRef = useRef<{ lat: number; lon: number } | null>(null)
  const wasFollowingRef = useRef(false)

  useEffect(() => {
    if (!shouldFollow || lat == null || lon == null) {
      wasFollowingRef.current = false
      return
    }

    // First tick when following starts — jump straight to the position
    if (!wasFollowingRef.current) {
      wasFollowingRef.current = true
      map.setView([lat, lon], map.getZoom(), { animate: false })
      lastRef.current = { lat, lon }
      return
    }

    // Skip if the aircraft hasn't moved enough to warrant a pan
    const last = lastRef.current
    if (last && Math.abs(last.lat - lat) < 0.00005 && Math.abs(last.lon - lon) < 0.00005) {
      return
    }

    lastRef.current = { lat, lon }

    // Smooth continuous pan — short duration so it's always chasing
    map.panTo([lat, lon], {
      animate: true,
      duration: 0.8,       // seconds — short enough to feel continuous
      easeLinearity: 0.5,  // constant-speed glide instead of ease-in-out
      noMoveStart: true,   // don't fire movestart (avoids marker jitter)
    })
  }, [lat, lon, map, shouldFollow])

  return null
}

export function MapClickHandler({ onMapClick }: { onMapClick: () => void }) {
  const map = useMap()
  useEffect(() => {
    map.on('click', onMapClick)
    return () => { map.off('click', onMapClick) }
  }, [map, onMapClick])
  return null
}

export function TileBrightness({ brightness }: { brightness: number }) {
  const map = useMap()
  useEffect(() => {
    const pane = map.getPane('tilePane')
    if (pane) {
      pane.style.filter = `brightness(${brightness}%)`
    }
  }, [map, brightness])
  return null
}