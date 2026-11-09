import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { activateLicense, getLicenseStatus, type LicenseStatus } from './license'

interface LicenseContextValue {
  status: LicenseStatus | null
  /** True once the first license check has finished. */
  ready: boolean
  activating: boolean
  activate: (token: string) => Promise<LicenseStatus>
  refresh: () => Promise<void>
  /** True when the app should be blocked behind the activation screen. */
  locked: boolean
}

const LicenseContext = createContext<LicenseContextValue | null>(null)

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [ready, setReady] = useState(false)
  const [activating, setActivating] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setStatus(await getLicenseStatus())
    } catch (error) {
      console.error('License check failed:', error)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const next = await getLicenseStatus()
        if (!cancelled) setStatus(next)
      } catch (error) {
        console.error('License check failed:', error)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Re-check when the window regains focus so an expiry, or a clock change,
  // is picked up without restarting the app.
  useEffect(() => {
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const activate = useCallback(async (token: string) => {
    setActivating(true)
    try {
      const next = await activateLicense(token)
      setStatus(next)
      return next
    } finally {
      setActivating(false)
    }
  }, [])

  const value: LicenseContextValue = {
    status,
    ready,
    activating,
    activate,
    refresh,
    locked: status?.state !== 'valid',
  }

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>
}

export function useLicense() {
  const ctx = useContext(LicenseContext)
  if (!ctx) throw new Error('useLicense must be inside LicenseProvider')
  return ctx
}
