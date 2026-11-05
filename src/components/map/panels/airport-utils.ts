export function airlineFromCallsign(callsign: string): string {
  const match = callsign.match(/^([A-Z]{2,3})/)
  return match ? match[1] : callsign.substring(0, 3)
}

export function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3440.065
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const AIRCRAFT_ALIASES: Record<string, string> = {
  'A318': 'A318', 'A319': 'A319', 'A320': 'A20N', 'A321': 'A21N',
  'A320NEO': 'A20N', 'A321NEO': 'A21N', 'A320CEO': 'A320', 'A321CEO': 'A321',
  'A330': 'A333', 'A330NEO': 'A339', 'A330-300': 'A333', 'A330-900': 'A339',
  'A340': 'A343', 'A350': 'A359', 'A350-900': 'A359', 'A350-1000': 'A35K',
  'A380': 'A388', 'A220': 'BCS3', 'A223': 'BCS3',
  'B737': 'B738', 'B738': 'B738', 'B739': 'B739', 'B737-800': 'B738',
  'B737MAX': 'B38M', 'B737MAX8': 'B38M', 'B38M': 'B38M',
  'B747': 'B748', 'B747-8': 'B748', 'B748': 'B748',
  'B757': 'B752', 'B752': 'B752',
  'B767': 'B763', 'B763': 'B763',
  'B777': 'B77W', 'B77W': 'B77W', 'B777-300': 'B77W', 'B777-200': 'B772',
  'B787': 'B789', 'B787-9': 'B789', 'B789': 'B789', 'B787-8': 'B788', 'B788': 'B788',
  'ATR72': 'AT76', 'AT76': 'AT76',
  'CRJ7': 'CRJ7', 'CRJ9': 'CRJ9', 'CRJ700': 'CRJ7', 'CRJ900': 'CRJ9',
  'E175': 'E170', 'E190': 'E190', 'E195': 'E195', 'E170': 'E170', 'E145': 'E145',
  'MD11': 'MD11', 'DC10': 'DC10',
}

export function cleanAircraftName(title?: string | null, fromFile?: string | null): string {
  const raw = (title || fromFile || '').trim()
  if (!raw) return 'UNKNOWN'

  const base = raw.split('/')[0].split('-')[0].trim().toUpperCase()

  if (AIRCRAFT_ALIASES[base]) return AIRCRAFT_ALIASES[base]

  const tokens = base.split(/\s+/).filter(Boolean)
  for (let len = tokens.length; len >= 1; len--) {
    const joined = tokens.slice(0, len).join('')
    if (AIRCRAFT_ALIASES[joined]) return AIRCRAFT_ALIASES[joined]
  }

  if (base.length > 6) {
    const icao = tokens.find(p => /^[A-Z][0-9A-Z]{2,4}$/i.test(p))
    if (icao) return icao
  }

  return base
}

// Universal SimBrief time formatter — handles HHMM, HH:MM, epoch seconds, epoch ms
export function formatTime(val?: string | number | null): string {
  if (val === undefined || val === null || val === '') return '—'
  const s = String(val).trim()

  if (/^\d{2}:\d{2}$/.test(s)) return s

  if (/^\d{4}$/.test(s)) {
    return `${s.slice(0, 2)}:${s.slice(2)}`
  }

  if (/^\d{10}$/.test(s)) {
    const d = new Date(parseInt(s, 10) * 1000)
    const hh = d.getUTCHours().toString().padStart(2, '0')
    const mm = d.getUTCMinutes().toString().padStart(2, '0')
    return `${hh}:${mm}`
  }

  if (/^\d{13}$/.test(s)) {
    const d = new Date(parseInt(s, 10))
    const hh = d.getUTCHours().toString().padStart(2, '0')
    const mm = d.getUTCMinutes().toString().padStart(2, '0')
    return `${hh}:${mm}`
  }

  return s
}

export interface RowPilot {
  key: string
  callsign: string
  flightNumber?: string
  cid?: number
  aircraft: string
  altitude: number
  groundspeed: number
  departure: string
  arrival: string
  lat: number
  lon: number
  isSelf: boolean
  departureStatus?: string
  arrivalStatus?: string
  scheduledTime?: string
}