import { loadJson, saveJson } from './storage'

export interface AppPreferences {
  showAiTrafficOnMap: boolean
  /** Filename inside settings/backgrounds/, or null for none. */
  backgroundImage: string | null
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  showAiTrafficOnMap: false,
  backgroundImage: null,
}

const FILE = 'settings/preferences.json'

export async function loadPreferences(): Promise<AppPreferences> {
  const saved = await loadJson<Partial<AppPreferences>>(FILE)
  return { ...DEFAULT_PREFERENCES, ...(saved ?? {}) }
}

export async function savePreferences(prefs: AppPreferences): Promise<void> {
  await saveJson(FILE, prefs)
}

export async function updatePreference<K extends keyof AppPreferences>(
  key: K,
  value: AppPreferences[K]
): Promise<AppPreferences> {
  const current = await loadPreferences()
  const next = { ...current, [key]: value }
  await savePreferences(next)
  return next
}