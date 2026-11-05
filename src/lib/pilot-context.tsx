import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadJson, saveJson } from './storage'
import { invoke } from '@tauri-apps/api/core'
import { useFlightLog } from './flight-log-context'
import { remove, exists, BaseDirectory } from '@tauri-apps/plugin-fs'

export interface PilotIdentity {
  displayName: string
  callsign: string
  flightNumber: string
  email: string
  simbriefId: string
  avatarFilename: string | null
  createdAt: number | null
  lastLoginAt: number | null
  favoriteAirports: string[]
}

interface StoredAuth {
  email: string
  passwordHash: string
  displayName: string
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
  favoriteAirports: [],
}

interface PilotContextValue {
  pilot: PilotIdentity
  ready: boolean
  isLoggedIn: boolean
  update: (updates: Partial<PilotIdentity>) => Promise<void>
  refresh: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => Promise<void>
}

const PilotContext = createContext<PilotContextValue>({
  pilot: DEFAULT_IDENTITY,
  ready: false,
  isLoggedIn: false,
  update: async () => {},
  refresh: async () => {},
  login: async () => {},
  register: async () => {},
  logout: async () => {},
})

export function PilotProvider({ children }: { children: ReactNode }) {
  const [pilot, setPilot] = useState<PilotIdentity>(DEFAULT_IDENTITY)
  const [ready, setReady] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  
  // Get the flight log clear function
  const { clearAll: clearFlightLog } = useFlightLog()

  const refresh = async () => {
    try {
      const localSession = localStorage.getItem('aervox:session')
      const localProfile = localStorage.getItem('aervox:profile')
      
      let hasSession = localSession === 'true'
      let merged: PilotIdentity = DEFAULT_IDENTITY

      if (localProfile) {
        try {
          merged = { ...DEFAULT_IDENTITY, ...JSON.parse(localProfile) }
        } catch { /* corrupted local storage, ignore */ }
      }

      if (!hasSession || !merged.email) {
        const saved = await loadJson<Partial<PilotIdentity>>('settings/user.json')
        const session = await loadJson<{ loggedIn: boolean }>('settings/session.json')
        
        if (saved) merged = { ...DEFAULT_IDENTITY, ...saved }
        if (session?.loggedIn) hasSession = true
      }

      const now = Date.now()
      if (merged.createdAt === null) merged.createdAt = now
      if (!merged.favoriteAirports) merged.favoriteAirports = []
      
      setPilot(merged)
      setIsLoggedIn(hasSession && !!merged.email)
    } catch (err) {
      console.error('Failed to load pilot data:', err)
      setIsLoggedIn(false)
    } finally {
      setReady(true)
    }
  }

  const update = async (updates: Partial<PilotIdentity>) => {
    const next = { ...pilot, ...updates }
    await saveJson('settings/user.json', next)
    localStorage.setItem('aervox:profile', JSON.stringify(next))
    setPilot(next)
  }

  const login = async (email: string, password: string) => {
    const auth = await loadJson<StoredAuth>('settings/auth.json')
    if (!auth || auth.email !== email.toLowerCase().trim()) {
      throw new Error('Invalid email or password.')
    }

    const isValid = await invoke<boolean>('verify_password', { 
      password, 
      hash: auth.passwordHash 
    })
    
    if (!isValid) throw new Error('Invalid email or password.')

    const now = Date.now()
    const next: PilotIdentity = {
      ...pilot,
      email: auth.email,
      displayName: auth.displayName,
      createdAt: pilot.createdAt ?? now,
      lastLoginAt: now,
    }
    
    await saveJson('settings/user.json', next)
    await saveJson('settings/session.json', { loggedIn: true })
    
    localStorage.setItem('aervox:profile', JSON.stringify(next))
    localStorage.setItem('aervox:session', 'true')
    
    setPilot(next)
    setIsLoggedIn(true)
  }

  const register = async (email: string, password: string, displayName: string) => {
    const existing = await loadJson<StoredAuth>('settings/auth.json')
    if (existing && existing.email === email.toLowerCase().trim()) {
      throw new Error('An account with this email already exists.')
    }

    const passwordHash = await invoke<string>('hash_password', { password })
    
    const newAuth: StoredAuth = { 
      email: email.toLowerCase().trim(), 
      passwordHash, 
      displayName 
    }
    
    await saveJson('settings/auth.json', newAuth)
    
    // Wipe the flight log state
    await clearFlightLog()

    // Wipe the flight log file directly
    try {
      if (await exists('settings/flights.json', { baseDir: BaseDirectory.AppData })) {
        await remove('settings/flights.json', { baseDir: BaseDirectory.AppData })
      }
    } catch (e) {
      console.error('Failed to wipe flight log file:', e)
    }

    await login(email, password)
  }

  const logout = async () => {
    await saveJson('settings/session.json', { loggedIn: false })
    localStorage.removeItem('aervox:session')
    localStorage.removeItem('aervox:profile')
    setIsLoggedIn(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <PilotContext.Provider value={{ pilot, ready, isLoggedIn, update, refresh, login, register, logout }}>
      {children}
    </PilotContext.Provider>
  )
}

export function usePilot() {
  return useContext(PilotContext)
}