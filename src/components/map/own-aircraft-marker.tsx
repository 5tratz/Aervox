import { useEffect, useRef, useState } from 'react'
import { Marker, Polyline, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { useSimConnect, type SimPosition } from '@/lib/simconnect-context'

interface TrailPoint { lat: number; lon: number; alt: number }

let globalTrail: TrailPoint[] = []
let globalLastPoint: TrailPoint | null = null
let globalStationarySince: number | null = null

const STATIONARY_RESET_MS = 10_000  // Reset trail after 10s parked
const STATIONARY_SPEED_KTS = 2      // Under 2 kts = stationary

export function clearTrail(_key: string) {
  globalTrail = []
  globalLastPoint = null
  globalStationarySince = null
}

function makeIcon(heading: number, size: number, isActive: boolean) {
  const color = isActive ? '#ef4444' : '#3b82f6'
  return L.divIcon({
    className: 'own-plane',
    html: `<div style="transform:rotate(${heading}deg);width:${size}px;height:${size}px;color:${color};">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="${size}" height="${size}">
        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function getAltitudeColor(alt: number) {
  if (alt < 3000) return '#22c55e'
  if (alt < 15000) return '#0ea5e9'
  return '#a855f7'
}

export function OwnAircraftMarker({
  labelsMode, iconSize, showTrails, onSelectPilot, isSelected, labelText,
}: {
  labelsMode: 'off' | 'text'
  iconSize: number
  showTrails: boolean
  onSelectPilot: (p: SimPosition) => void
  isSelected: boolean
  flightKey?: number | string | null
  labelText?: string
}) {
  const { position } = useSimConnect()

  const [trail, setTrail] = useState<TrailPoint[]>(globalTrail)
  const [hovered, setHovered] = useState(false)
  const lastAppendRef = useRef<TrailPoint | null>(globalLastPoint)

  const lat = position?.latitude ?? null
  const lon = position?.longitude ?? null
  const alt = position?.altitude ?? 0
  const gs = position?.ground_speed ?? 0
  const onGround = position?.on_ground ?? false

  // Reset trail when the aircraft has been stationary on the ground for 10+ seconds
  useEffect(() => {
    if (!onGround || gs > STATIONARY_SPEED_KTS) {
      // Moving (or in the air) → clear the stationary timer
      globalStationarySince = null
      return
    }

    // On ground and stationary
    const now = Date.now()
    if (globalStationarySince === null) {
      globalStationarySince = now
      return
    }

    if (now - globalStationarySince > STATIONARY_RESET_MS && globalTrail.length > 0) {
      // Been parked for 10s → wipe the trail so next flight starts clean
      globalTrail = []
      globalLastPoint = null
      lastAppendRef.current = null
      setTrail([])
      globalStationarySince = null
    }
  }, [onGround, gs])

  // Append new points whenever the aircraft moves (airborne OR taxiing)
  useEffect(() => {
    if (lat == null || lon == null) return
    const last = lastAppendRef.current
    if (!last || Math.abs(last.lat - lat) + Math.abs(last.lon - lon) > 0.0002) {
      const newPoint = { lat, lon, alt }
      lastAppendRef.current = newPoint
      globalLastPoint = newPoint

      setTrail((prev) => {
        const next = [...prev, newPoint]
        globalTrail = next
        return next
      })
    }
  }, [lat, lon, alt])

  if (lat == null || lon == null || !position) return null

  const currentPosition: SimPosition = position
  const isActive = hovered || isSelected
  const icon = makeIcon(currentPosition.heading ?? 0, iconSize, isActive)

  const displayLabel =
    (labelText && labelText.trim()) ||
    (currentPosition.callsign && currentPosition.callsign.trim()) ||
    currentPosition.title?.split('(')[0].trim().toUpperCase() ||
    'YOU'

  return (
    <>
      {showTrails && trail.length > 1 && (
        <>
          {trail.map((p, i) => {
            if (i === 0) return null
            const prev = trail[i - 1]
            const color = getAltitudeColor(p.alt)
            return (
              <Polyline
                key={`trail-${i}`}
                positions={[[prev.lat, prev.lon], [p.lat, p.lon]]}
                pathOptions={{ color, weight: 3, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
              />
            )
          })}
        </>
      )}

      <Marker
        position={[lat, lon]}
        icon={icon}
        zIndexOffset={isActive ? 2000 : 1500}
        eventHandlers={{
          mouseover: () => setHovered(true),
          mouseout: () => setHovered(false),
          click: () => onSelectPilot(currentPosition),
        }}
      >
        {(isActive || labelsMode === 'text') && (
          <Tooltip
            permanent
            direction="right"
            offset={[iconSize / 2 + 2, 0]}
            className="f24-hover-tooltip"
          >
            {displayLabel}
          </Tooltip>
        )}
      </Marker>
    </>
  )
}