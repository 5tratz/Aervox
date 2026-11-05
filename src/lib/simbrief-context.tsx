import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadJson } from './storage'
import { fetchSimbriefOFP, type SimbriefOFP } from './simbrief'

interface SimbriefContextValue {
  ofp: SimbriefOFP | null
  loading: boolean
  error: string | null
  pilotId: string | null
  refresh: () => Promise<void>
  clear: () => void
}

const SimbriefContext = createContext<SimbriefContextValue>({
  ofp: null,
  loading: false,
  error: null,
  pilotId: null,
  refresh: async () => {},
  clear: () => {},
})

export function SimbriefProvider({ children }: { children: ReactNode }) {
  const [ofp, setOfp] = useState<SimbriefOFP | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pilotId, setPilotId] = useState<string | null>(null)

  // Load the saved pilot ID from disk on mount (but DO NOT fetch the OFP).
  // This ensures the UI knows the ID is set, but the plan only loads
  // when the user explicitly clicks "Fetch OFP".
  useEffect(() => {
    loadJson<{ simbriefId?: string }>('settings/user.json').then((saved) => {
      if (saved?.simbriefId) setPilotId(saved.simbriefId)
    })
  }, [])

  const refresh = async () => {
    const saved = await loadJson<{ simbriefId?: string }>('settings/user.json')
    const id = saved?.simbriefId ?? null
    setPilotId(id)

    if (!id) {
      setOfp(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await fetchSimbriefOFP(id)
      setOfp(data)
    } catch (e) {
      setOfp(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    setOfp(null)
    setError(null)
  }

  return (
    <SimbriefContext.Provider value={{ ofp, loading, error, pilotId, refresh, clear }}>
      {children}
    </SimbriefContext.Provider>
  )
}

export function useSimbrief() {
  return useContext(SimbriefContext)
}