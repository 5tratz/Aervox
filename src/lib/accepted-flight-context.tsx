import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadJson, saveJson } from './storage'
import type { ScheduledRoute } from './scheduled-routes'

interface AcceptedFlightContextValue {
  accepted: ScheduledRoute | null
  accept: (route: ScheduledRoute) => Promise<void>
  clear: () => Promise<void>
}

const AcceptedFlightContext = createContext<AcceptedFlightContextValue>({
  accepted: null,
  accept: async () => {},
  clear: async () => {},
})

export function AcceptedFlightProvider({ children }: { children: ReactNode }) {
  const [accepted, setAccepted] = useState<ScheduledRoute | null>(null)

  useEffect(() => {
    loadJson<ScheduledRoute>('settings/accepted-flight.json').then((saved) => {
      if (saved) setAccepted(saved)
    })
  }, [])

  const accept = async (route: ScheduledRoute) => {
    setAccepted(route)
    await saveJson('settings/accepted-flight.json', route)
  }

  const clear = async () => {
    setAccepted(null)
    await saveJson('settings/accepted-flight.json', null)
  }

  return (
    <AcceptedFlightContext.Provider value={{ accepted, accept, clear }}>
      {children}
    </AcceptedFlightContext.Provider>
  )
}

export function useAcceptedFlight() {
  return useContext(AcceptedFlightContext)
}