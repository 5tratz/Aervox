import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export interface FlightRecord {
  id: string
  callsign: string
  flightNumber?: string
  aircraft: string
  departure: string
  arrival: string
  startTime: number
  endTime: number
  blockMinutes: number
  totalDistanceNm: number
  landingRateFpm: number | null
  status: 'completed'
  track?: [number, number][]
  altitudeProfile?: number[]
}

interface FlightLogContextValue {
  flights: FlightRecord[]
  addFlight: (flight: Omit<FlightRecord, 'id'>) => void
  deleteFlight: (id: string) => void
  clearAll: () => void
}

const STORAGE_KEY = 'aervox:flight-log'

const FlightLogContext = createContext<FlightLogContextValue>({
  flights: [],
  addFlight: () => {},
  deleteFlight: () => {},
  clearAll: () => {},
})

export function FlightLogProvider({ children }: { children: ReactNode }) {
  const [flights, setFlights] = useState<FlightRecord[]>([])
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as FlightRecord[]
        if (Array.isArray(parsed)) setFlights(parsed)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!hydratedRef.current) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flights))
    } catch { /* ignore */ }
  }, [flights])

  const addFlight = (flight: Omit<FlightRecord, 'id'>) => {
    const record: FlightRecord = {
      ...flight,
      id: `flight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }
    setFlights((prev) => [record, ...prev])
  }

  const deleteFlight = (id: string) => {
    setFlights((prev) => prev.filter(f => f.id !== id))
  }

  const clearAll = () => setFlights([])

  return (
    <FlightLogContext.Provider value={{ flights, addFlight, deleteFlight, clearAll }}>
      {children}
    </FlightLogContext.Provider>
  )
}

export function useFlightLog() {
  return useContext(FlightLogContext)
}