import { invoke } from '@tauri-apps/api/core'
import type { Language } from './i18n'

export type LicenseState = 'none' | 'valid' | 'expired' | 'invalid' | 'tampered'

export interface LicenseStatus {
  state: LicenseState
  /** "dev" | "trial" | "sub3" | "sub6" | "sub12" */
  tier: string | null
  key_id: string | null
  /** Unix seconds. */
  activated_at: number | null
  /** Unix seconds. null means the license never expires. */
  expires_at: number | null
  days_remaining: number | null
  /** Grouped code, e.g. "1A2B-3C4D-5E6F-7081". */
  machine_code: string
  reason: string | null
}

const TIER_LABEL_KEYS: Record<string, string> = {
  dev: 'license.tierDev',
  trial: 'license.tierTrial',
  sub3: 'license.tierSub3',
  sub6: 'license.tierSub6',
  sub12: 'license.tierSub12',
}

const DATE_LOCALES: Record<Language, string> = {
  en: 'en-GB',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
}

export function tierLabelKey(tier: string | null | undefined): string {
  if (!tier) return 'license.tierUnknown'
  return TIER_LABEL_KEYS[tier] ?? 'license.tierUnknown'
}

export function formatLicenseDate(
  unixSeconds: number | null | undefined,
  language: Language = 'en'
): string {
  if (!unixSeconds) return '—'
  return new Date(unixSeconds * 1000).toLocaleDateString(DATE_LOCALES[language], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function getLicenseStatus(): Promise<LicenseStatus> {
  return invoke<LicenseStatus>('license_status')
}

export function activateLicense(token: string): Promise<LicenseStatus> {
  return invoke<LicenseStatus>('license_activate', { token })
}

export function getMachineCode(): Promise<string> {
  return invoke<string>('license_machine_code')
}

export function clearLicense(): Promise<void> {
  return invoke<void>('license_clear')
}
