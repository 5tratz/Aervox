import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadPreferences, savePreferences } from './preferences'
import { readBackgroundAsDataUrl, saveBackgroundImage, deleteBackgroundImage } from './storage'

interface BackgroundContextValue {
  bgUrl: string | null
  bgFilename: string | null
  ready: boolean
  refresh: () => Promise<void>
  setFromFile: (bytes: Uint8Array, ext: string) => Promise<void>
  clear: () => Promise<void>
}

const BackgroundContext = createContext<BackgroundContextValue | null>(null)

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  const [bgFilename, setBgFilename] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const prefs = await loadPreferences()
    setBgFilename(prefs.backgroundImage)
    const url = await readBackgroundAsDataUrl(prefs.backgroundImage)
    setBgUrl(url)
    setReady(true)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const setFromFile = useCallback(async (bytes: Uint8Array, ext: string) => {
    const filename = await saveBackgroundImage(bytes, ext)
    await savePreferences({ ...(await loadPreferences()), backgroundImage: filename })
    setBgFilename(filename)
    setBgUrl(await readBackgroundAsDataUrl(filename))
  }, [])

  const clear = useCallback(async () => {
    if (bgFilename) await deleteBackgroundImage(bgFilename)
    await savePreferences({ ...(await loadPreferences()), backgroundImage: null })
    setBgFilename(null)
    setBgUrl(null)
  }, [bgFilename])

  return (
    <BackgroundContext.Provider value={{ bgUrl, bgFilename, ready, refresh, setFromFile, clear }}>
      {children}
    </BackgroundContext.Provider>
  )
}

export function useBackground() {
  const ctx = useContext(BackgroundContext)
  if (!ctx) throw new Error('useBackground must be inside BackgroundProvider')
  return ctx
}