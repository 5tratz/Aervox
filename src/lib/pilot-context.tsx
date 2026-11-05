import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadJson, saveJson } from './storage'
import { invoke } from '@tauri-apps/api/core'

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

  const refresh = async () => {
    const saved = await loadJson<Partial<PilotIdentity>>('settings/user.json')
    const session = await loadJson<{ loggedIn: boolean }>('settings/session.json')
    
    const now = Date.now()
    const merged: PilotIdentity = {
      ...DEFAULT_IDENTITY,
      ...(saved ?? {}),
    }
    if (merged.createdAt === null) merged.createdAt = now
    
    setPilot(merged)
    setIsLoggedIn(session?.loggedIn === true)
    setReady(true)
  }

  const update = async (updates: Partial<PilotIdentity>) => {
    const next = { ...pilot, ...updates }
    await saveJson('settings/user.json', next)
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
    await login(email, password)
  }

  const logout = async () => {
    await saveJson('settings/session.json', { loggedIn: false })
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