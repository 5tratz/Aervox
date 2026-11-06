import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { saveJson, loadJson } from './storage'
import {
  DEFAULT_PREFS,
  translate,
  formatCurrency,
  type Language,
  type Currency,
  type LocalePrefs,
} from './i18n'

interface LocaleContextValue {
  language: Language
  currency: Currency
  setLanguage: (l: Language) => Promise<void>
  setCurrency: (c: Currency) => Promise<void>
  t: (key: string, params?: Record<string, string | number>) => string
  fmtCurrency: (amount: number) => string
  ready: boolean
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  )
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<LocalePrefs>(DEFAULT_PREFS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    (async () => {
      const stored = await loadJson<LocalePrefs>('settings/locale.json')
      if (stored) setPrefs(stored)
      setReady(true)
    })()
  }, [])

  const setLanguage = async (language: Language) => {
    let nextCurrency = prefs.currency

    // Automatically switch currency based on language
    if (language === 'fr' || language === 'de' || language === 'es') {
      nextCurrency = 'EUR'
    } else if (language === 'en') {
      // If they switch back to English and are currently on EUR, default to GBP
      if (prefs.currency === 'EUR') {
        nextCurrency = 'GBP'
      }
    }

    const next = { ...prefs, language, currency: nextCurrency }
    setPrefs(next)
    await saveJson('settings/locale.json', next)
  }

  const setCurrency = async (currency: Currency) => {
    const next = { ...prefs, currency }
    setPrefs(next)
    await saveJson('settings/locale.json', next)
  }

  const value: LocaleContextValue = {
    language: prefs.language,
    currency: prefs.currency,
    setLanguage,
    setCurrency,
    t: (key, params) => interpolate(translate(prefs.language, key), params),
    fmtCurrency: (amount) => formatCurrency(amount, prefs.currency),
    ready,
  }

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be inside LocaleProvider')
  return ctx
}