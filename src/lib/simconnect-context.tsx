import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

export interface SimPosition {
  latitude: number
  longitude: number
  altitude: number
  ground_speed: number
  heading: number
  on_ground: boolean
  title: string
  callsign: string
  timestamp: number
  flight_start?: number | null 

  light_landing?: boolean
  light_taxi?: boolean
  light_strobe?: boolean
  light_beacon?: boolean
  light_nav?: boolean
  light_logo?: boolean
  light_wing?: boolean
  light_recognition?: boolean
  light_cabin?: boolean

  ap_master?: boolean
  ap_hdg?: boolean
  ap_alt?: boolean
  ap_nav?: boolean
  ap_appr?: boolean
  ap_vs?: boolean
  at_armed?: boolean

  flaps_index?: number
  gear_handle_down?: boolean
  spoilers_pct?: number
  parking_brake?: boolean

  eng1_combustion?: boolean
  eng2_combustion?: boolean
  eng3_combustion?: boolean
  eng4_combustion?: boolean

  exit0_open?: number
  exit1_open?: number

  systems_valid?: boolean
}

export interface FlightStartedPayload {
  latitude: number
  longitude: number
  aircraft: string
  timestamp: number
  callsign: string
}

export interface FlightEndedPayload {
  start_latitude: number
  start_longitude: number
  end_latitude: number
  end_longitude: number
  duration_seconds: number
  aircraft: string
  landing_rate_fpm: number | null
  timestamp: number
  callsign: string
}

interface SimContextValue {
  connected: boolean
  position: SimPosition | null
  lastFlightStarted: FlightStartedPayload | null
  lastFlightEnded: FlightEndedPayload | null
  aircraftFromFile: string | null
  error: string | null
}

const SimContext = createContext<SimContextValue>({
  connected: false,
  position: null,
  lastFlightStarted: null,
  lastFlightEnded: null,
  aircraftFromFile: null,
  error: null,
})

export function SimConnectProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [position, setPosition] = useState<SimPosition | null>(null)
  const [lastFlightStarted, setLastFlightStarted] = useState<FlightStartedPayload | null>(null)
  const [lastFlightEnded, setLastFlightEnded] = useState<FlightEndedPayload | null>(null)
  const [aircraftFromFile, setAircraftFromFile] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let unlisteners: UnlistenFn[] = []
    let cancelled = false

    const setup = async () => {
	const un1 = await listen<boolean>('simconnect-connected', (e) => {
	  setConnected(e.payload)
	  if (e.payload) {
		setError(null)
	  } else {
		// Clear aircraft marker on genuine disconnect (Rust only emits `false`
		// on real disconnects, not on menu/flight transitions).
		setPosition(null)
		setAircraftFromFile(null)
	  }
	})
      const un2 = await listen<SimPosition>('sim-data', (e) => {
        setPosition(e.payload)
        setConnected(true)
      })
      const un3 = await listen<string>('simconnect-error', (e) => setError(e.payload))
      const un4 = await listen<FlightStartedPayload>('flight-started', (e) => setLastFlightStarted(e.payload))
      const un5 = await listen<FlightEndedPayload>('flight-ended', (e) => setLastFlightEnded(e.payload))
      const un6 = await listen<string>('aircraft-detected', (e) => setAircraftFromFile(e.payload))

      if (cancelled) { un1(); un2(); un3(); un4(); un5(); un6(); return }
      unlisteners = [un1, un2, un3, un4, un5, un6]

      try {
        await invoke('start_simconnect')
      } catch (err) {
        console.error('start_simconnect failed:', err)
      }
    }

    setup()

    return () => {
      cancelled = true
      unlisteners.forEach((un) => un())
    }
  }, [])

  return (
    <SimContext.Provider value={{ connected, position, lastFlightStarted, lastFlightEnded, aircraftFromFile, error }}>
      {children}
    </SimContext.Provider>
  )
}

export function useSimConnect() {
  return useContext(SimContext)
}