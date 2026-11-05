import { useEffect, useRef } from 'react'
import { useSimConnect } from './simconnect-context'
import { useFlightLog } from './flight-log-context'
import { useSimbrief } from './simbrief-context'
import { usePilot } from './pilot-context'
import { nearestAirport } from './airports'
import { toast } from 'sonner'

function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3440.065
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const AIRPORT_PROXIMITY_LIMIT_NM = 10
const TRACK_SAMPLE_MS = 10_000
const TRACK_MIN_MOVE_DEG = 0.0001
const ALTITUDE_SAMPLE_MS = 5_000

export function FlightLogger() {
  const { lastFlightEnded, lastFlightStarted, position } = useSimConnect()
  const { addFlight } = useFlightLog()
  const { ofp } = useSimbrief()
  const { pilot } = usePilot()

  const processedRef = useRef<number>(0)
  const trackRef = useRef<[number, number][]>([])
  const altitudeRef = useRef<number[]>([])
  const trackIntervalRef = useRef<number | null>(null)
  const altitudeIntervalRef = useRef<number | null>(null)
  const currentPositionRef = useRef<{ lat: number; lon: number; alt: number } | null>(null)
  const flightActiveRef = useRef<boolean>(false)

  const addFlightRef = useRef(addFlight)
  const ofpRef = useRef(ofp)
  const pilotCallsignRef = useRef(pilot.callsign)
  const pilotFlightNumberRef = useRef(pilot.flightNumber)

  useEffect(() => {
    addFlightRef.current = addFlight
  }, [addFlight])

  useEffect(() => {
    ofpRef.current = ofp
  }, [ofp])

  useEffect(() => {
    pilotCallsignRef.current = pilot.callsign
    pilotFlightNumberRef.current = pilot.flightNumber
  }, [pilot.callsign, pilot.flightNumber])

  useEffect(() => {
    if (!position) return
    if (position.latitude == null || position.longitude == null) return
    currentPositionRef.current = {
      lat: position.latitude,
      lon: position.longitude,
      alt: position.altitude ?? 0,
    }
  }, [position])

  // Start recording when a flight starts
  useEffect(() => {
    if (!lastFlightStarted) return
    if (flightActiveRef.current) return

    flightActiveRef.current = true
    trackRef.current = []
    altitudeRef.current = []

    if (lastFlightStarted.latitude != null && lastFlightStarted.longitude != null) {
      trackRef.current.push([lastFlightStarted.latitude, lastFlightStarted.longitude])
      altitudeRef.current.push(position?.altitude ?? 0)
    }

    // Track: sample every 10s, only when moved enough
    if (trackIntervalRef.current !== null) {
      window.clearInterval(trackIntervalRef.current)
    }
    trackIntervalRef.current = window.setInterval(() => {
      const pos = currentPositionRef.current
      if (!pos) return
      const last = trackRef.current[trackRef.current.length - 1]
      if (last && Math.abs(last[0] - pos.lat) < TRACK_MIN_MOVE_DEG && Math.abs(last[1] - pos.lon) < TRACK_MIN_MOVE_DEG) {
        return
      }
      trackRef.current.push([pos.lat, pos.lon])
    }, TRACK_SAMPLE_MS)

    // Altitude: sample every 5s, always (altitude changes even when stationary in lat/lon)
    if (altitudeIntervalRef.current !== null) {
      window.clearInterval(altitudeIntervalRef.current)
    }
    altitudeIntervalRef.current = window.setInterval(() => {
      const pos = currentPositionRef.current
      if (!pos) return
      altitudeRef.current.push(pos.alt)
    }, ALTITUDE_SAMPLE_MS)
  }, [lastFlightStarted])

  // Log the flight when it ends
  useEffect(() => {
    if (!lastFlightEnded) return
    if (lastFlightEnded.timestamp <= processedRef.current) return
    processedRef.current = lastFlightEnded.timestamp

    const fe = lastFlightEnded
    const currentOfp = ofpRef.current
    const currentCallsign = pilotCallsignRef.current
    const currentFlightNumber = pilotFlightNumberRef.current

    flightActiveRef.current = false
    if (trackIntervalRef.current !== null) {
      window.clearInterval(trackIntervalRef.current)
      trackIntervalRef.current = null
    }
    if (altitudeIntervalRef.current !== null) {
      window.clearInterval(altitudeIntervalRef.current)
      altitudeIntervalRef.current = null
    }

    let departure = currentOfp?.origin?.icao_code ?? ''
    let arrival = currentOfp?.destination?.icao_code ?? ''

    if (!departure) {
      const apt = nearestAirport(fe.start_latitude, fe.start_longitude)
      if (apt) {
        const dist = distanceNm(fe.start_latitude, fe.start_longitude, apt.lat, apt.lon)
        if (dist <= AIRPORT_PROXIMITY_LIMIT_NM) {
          departure = apt.icao || apt.iata || ''
        }
      }
    }

    if (!arrival) {
      const apt = nearestAirport(fe.end_latitude, fe.end_longitude)
      if (apt) {
        const dist = distanceNm(fe.end_latitude, fe.end_longitude, apt.lat, apt.lon)
        if (dist <= AIRPORT_PROXIMITY_LIMIT_NM) {
          arrival = apt.icao || apt.iata || ''
        }
      }
    }

    const distance = distanceNm(
      fe.start_latitude,
      fe.start_longitude,
      fe.end_latitude,
      fe.end_longitude,
    )

    const blockMinutes = Math.round(fe.duration_seconds / 60)
    const endTime = fe.timestamp * 1000
    const startTime = endTime - fe.duration_seconds * 1000
    const callsign = currentCallsign || fe.callsign || 'UNKNOWN'

    // Finalise track: make sure start and end positions are present
    const track = [...trackRef.current]
    const first = track[0]
    if (!first || Math.abs(first[0] - fe.start_latitude) > 0.001 || Math.abs(first[1] - fe.start_longitude) > 0.001) {
      track.unshift([fe.start_latitude, fe.start_longitude])
    }
    const last = track[track.length - 1]
    if (!last || Math.abs(last[0] - fe.end_latitude) > 0.001 || Math.abs(last[1] - fe.end_longitude) > 0.001) {
      track.push([fe.end_latitude, fe.end_longitude])
    }

    // Finalise altitude profile: ensure it has a beginning and an end
    const altProfile = [...altitudeRef.current]
    if (altProfile.length === 0) {
      altProfile.push(0, 0)
    } else if (altProfile.length === 1) {
      altProfile.push(altProfile[0])
    }

    addFlightRef.current({
      callsign,
      flightNumber: currentFlightNumber || callsign,
      aircraft: fe.aircraft || 'UNKNOWN',
      departure,
      arrival,
      startTime,
      endTime,
      blockMinutes,
      totalDistanceNm: Math.round(distance),
      landingRateFpm: fe.landing_rate_fpm,
      status: 'completed',
      track: track.length >= 2 ? track : undefined,
      altitudeProfile: altProfile.length >= 2 ? altProfile : undefined,
    })

    trackRef.current = []
    altitudeRef.current = []

    toast.success(`Flight logged: ${departure || '???'} → ${arrival || '???'} (${blockMinutes} min)`)
  }, [lastFlightEnded])

  useEffect(() => {
    return () => {
      if (trackIntervalRef.current !== null) {
        window.clearInterval(trackIntervalRef.current)
      }
      if (altitudeIntervalRef.current !== null) {
        window.clearInterval(altitudeIntervalRef.current)
      }
    }
  }, [])

  return null
}