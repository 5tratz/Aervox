import { invoke } from '@tauri-apps/api/core'

export interface MetarData {
  icao: string
  raw: string
  wind_dir: number | null
  wind_speed: number | null
  wind_gust: number | null
  visibility: string | null
  weather: string | null
  clouds: string | null
  flight_category: string | null
  temp: number | null
  dewpoint: number | null
  altimeter: number | null
  obs_time: string | null
}

// ── Cache System (from your old app) ──
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 mins
const NEGATIVE_CACHE_TTL_MS = 2 * 60 * 1000 // 2 mins

type CacheEntry =
  | { kind: 'ok'; data: MetarData; at: number }
  | { kind: 'err'; message: string; at: number }

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<MetarData | null>>()

function getCached(icao: string): MetarData | null | 'ERROR' {
  const key = icao.toUpperCase()
  const entry = cache.get(key)
  if (!entry) return null

  const age = Date.now() - entry.at
  if (entry.kind === 'ok') {
    if (age > CACHE_TTL_MS) {
      cache.delete(key)
      return null
    }
    return entry.data
  }
  
  if (age > NEGATIVE_CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return 'ERROR'
}

export async function fetchMetar(icao: string): Promise<MetarData | null> {
  const key = icao.toUpperCase()
  
  // 1. Check cache
  const cached = getCached(key)
  if (cached === 'ERROR') return null
  if (cached) return cached

  // 2. Check if already fetching
  if (inFlight.has(key)) return inFlight.get(key)!

  // 3. Fetch via Rust backend
  const promise = (async () => {
    try {
      const data = await invoke<MetarData>('fetch_metar', { icao: key })
      cache.set(key, { kind: 'ok', data, at: Date.now() })
      return data
    } catch (err) {
      console.warn(`METAR fetch failed for ${key}:`, err)
      cache.set(key, { kind: 'err', message: String(err), at: Date.now() })
      return null
    } finally {
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, promise)
  return promise
}

export function calculateHumidity(temp: number | null, dewp: number | null): number {
  if (temp == null || dewp == null) return 0
  const e = Math.exp((17.625 * dewp) / (243.04 + dewp))
  const es = Math.exp((17.625 * temp) / (243.04 + temp))
  return Math.round(100 * (e / es))
}