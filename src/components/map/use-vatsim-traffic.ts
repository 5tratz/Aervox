import { useEffect, useRef, useState } from 'react'

const VATSIM_URL = 'https://data.vatsim.net/v3/vatsim-data.json?interpolate=true'
const POLL_MS = 10_000 
const RETRY_MS = 5_000
const MAX_TRACK_POINTS = 100 // ~25 min of history per VATSIM pilot

export interface VatsimTrackPoint {
  lat: number
  lon: number
  alt: number
  spd: number
  time: number
}

export interface VatsimPilot {
  cid: number
  callsign: string
  lat: number
  lon: number
  altitude: number
  groundspeed: number
  heading: number
  aircraft: string
  departure: string
  arrival: string
  track: VatsimTrackPoint[]
}

interface RawVatsim {
  pilots: Array<{
    cid: number
    callsign: string
    latitude: number
    longitude: number
    altitude: number
    groundspeed: number
    heading: number
    track?: any[]
    flight_plan?: {
      aircraft?: string
      departure?: string
      arrival?: string
    } | null
  }>
}

export function useVatsimTraffic(enabled: boolean) {
  const [pilots, setPilots] = useState<VatsimPilot[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const trackHistoryRef = useRef<Map<number, VatsimTrackPoint[]>>(new Map())

  useEffect(() => {
    if (!enabled) {
      setPilots([])
      abortRef.current?.abort()
      abortRef.current = null
      trackHistoryRef.current.clear()
      return
    }

    let cancelled = false
    let timer: number | undefined
    let hasSucceededOnce = false

    const scheduleNext = (delay: number) => {
      if (cancelled) return
      timer = window.setTimeout(poll, delay)
    }

    const poll = async () => {
      if (cancelled) return

      if (document.visibilityState !== 'visible') {
        scheduleNext(POLL_MS)
        return
      }

      const ctrl = new AbortController()
      abortRef.current = ctrl

      try {
        const res = await fetch(VATSIM_URL, { signal: ctrl.signal })
        if (res.ok && !cancelled) {
          const data = (await res.json()) as RawVatsim
          const seenCids = new Set<number>()

          const next: VatsimPilot[] = data.pilots.map((p) => {
            seenCids.add(p.cid)

            const history = trackHistoryRef.current.get(p.cid) ?? []
            const lastHistoryPoint = history[history.length - 1]
            
            const currentPoint: VatsimTrackPoint = { 
              lat: p.latitude, 
              lon: p.longitude, 
              alt: p.altitude, 
              spd: p.groundspeed, 
              time: Date.now() 
            }

            const hasMoved =
              !lastHistoryPoint ||
              Math.abs(lastHistoryPoint.lat - p.latitude) > 0.0005 ||
              Math.abs(lastHistoryPoint.lon - p.longitude) > 0.0005

            if (hasMoved) {
              history.push(currentPoint)
              if (history.length > MAX_TRACK_POINTS) {
                history.shift()
              }
              trackHistoryRef.current.set(p.cid, history)
            }

            return {
              cid: p.cid,
              callsign: p.callsign,
              lat: p.latitude,
              lon: p.longitude,
              altitude: p.altitude,
              groundspeed: p.groundspeed,
              heading: p.heading,
              aircraft: p.flight_plan?.aircraft ?? '',
              departure: p.flight_plan?.departure ?? '',
              arrival: p.flight_plan?.arrival ?? '',
              track: history,
            }
          })

          for (const cid of trackHistoryRef.current.keys()) {
            if (!seenCids.has(cid)) {
              trackHistoryRef.current.delete(cid)
            }
          }

          setPilots(next)
          hasSucceededOnce = true
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.warn('[vatsim] fetch failed', err)
        }
      }

      scheduleNext(hasSucceededOnce ? POLL_MS : RETRY_MS)
    }

    poll()

    return () => {
      cancelled = true
      abortRef.current?.abort()
      abortRef.current = null
      if (timer) window.clearTimeout(timer)
      trackHistoryRef.current.clear()
    }
  }, [enabled])

  return { pilots }
}