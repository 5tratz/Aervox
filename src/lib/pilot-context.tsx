import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadJson, saveJson } from './storage'

export interface PilotIdentity {
  displayName: string
  callsign: string
  flightNumber: string
  email: string
  simbriefId: string
  avatarFilename: string | null
  createdAt: number | null
  lastLoginAt: number | null
}

const DEFAULT_IDENTITY: PilotIdentity = {
  displayName: '',
  callsign: '',
  flightNumber: '',
  email: '',
  simbriefId: '',
  avatarFilename: null,
  createdAt: null,
  lastLoginAt: null,
}

interface PilotContextValue {
  pilot: PilotIdentity
  ready: boolean
  update: (updates: Partial<PilotIdentity>) => Promise<void>
  refresh: () => Promise<void>
}

const PilotContext = createContext<PilotContextValue>({
  pilot: DEFAULT_IDENTITY,
  ready: false,
  update: async () => {},
  refresh: async () => {},
})

export function PilotProvider({ children }: { children: ReactNode }) {
  const [pilot, setPilot] = useState<PilotIdentity>(DEFAULT_IDENTITY)
  const [ready, setReady] = useState(false)

  const refresh = async () => {
    const saved = await loadJson<Partial<PilotIdentity>>('settings/user.json')
    const now = Date.now()
    const merged: PilotIdentity = {
      ...DEFAULT_IDENTITY,
      ...(saved ?? {}),
    }
    if (merged.createdAt === null) merged.createdAt = now
    setPilot(merged)
    setReady(true)
  }

  const update = async (updates: Partial<PilotIdentity>) => {
    // 1. Create the new object
    const next = { ...pilot, ...updates }
    
    // 2. Write to disk FIRST. If this fails, it throws a real error.
    await saveJson('settings/user.json', next)
    
    // 3. Only update React state if the disk write succeeded.
    setPilot(next)
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <PilotContext.Provider value={{ pilot, ready, update, refresh }}>
      {children}
    </PilotContext.Provider>
  )
}

export function usePilot() {
  return useContext(PilotContext)
}