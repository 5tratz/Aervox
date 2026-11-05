import tzlookup from 'tz-lookup'
import { getAirport } from './airports'
import { SCHEDULED_ROUTES, type ScheduledRoute } from './scheduled-routes'

const LOOKAHEAD_HOURS = 24
const LOOKBEHIND_MIN = 120

export interface LiveFlight extends ScheduledRoute {
  departureUtc: number
  arrivalUtc: number
  minutesUntilDeparture: number
  status: 'upcoming' | 'boarding' | 'departed' | 'arriving'
}

function getAirportTimezone(icao: string): string {
  const apt = getAirport(icao)
  if (!apt) return 'UTC'
  try {
    return tzlookup(apt.lat, apt.lon)
  } catch {
    return 'UTC'
  }
}

/**
 * Get the offset in minutes for a given timezone at a given UTC timestamp.
 * Positive = east of UTC, negative = west. Handles DST correctly.
 */
function getTimezoneOffsetMinutes(timezone: string, utcMs: number): number {
  const date = new Date(utcMs)
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = dtf.formatToParts(date)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? '0')

  let hour = get('hour')
  if (hour === 24) hour = 0

  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'))
  return (asUtc - utcMs) / 60_000
}

/**
 * Convert "HH:MM in the airport's local time" to a UTC timestamp,
 * for the given calendar date in the airport's timezone.
 */
function localWallClockToUtc(
  icao: string,
  timeStr: string,
  reference: Date
): number {
  const tz = getAirportTimezone(icao)
  const [hh, mm] = timeStr.split(':').map(Number)

  // Get the calendar date (Y/M/D) in the airport's timezone for the reference moment
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference)

  const y = Number(dateParts.find(p => p.type === 'year')?.value ?? '1970')
  const m = Number(dateParts.find(p => p.type === 'month')?.value ?? '01')
  const d = Number(dateParts.find(p => p.type === 'day')?.value ?? '01')

  const naiveUtc = Date.UTC(y, m - 1, d, hh, mm, 0, 0)

  let offsetMin = getTimezoneOffsetMinutes(tz, naiveUtc)
  let result = naiveUtc - offsetMin * 60_000

  // Second pass for DST boundary cases
  const offsetMin2 = getTimezoneOffsetMinutes(tz, result)
  if (offsetMin2 !== offsetMin) {
    result = naiveUtc - offsetMin2 * 60_000
  }

  return result
}

/**
 * Return the day-of-week (0=Sunday..6=Saturday) in the airport's timezone.
 */
function getDayOfWeekInTimezone(icao: string, reference: Date): number {
  const tz = getAirportTimezone(icao)
  const weekdayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  }).format(reference)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[weekdayStr] ?? 0
}

export function computeLiveSchedule(reference: Date = new Date()): LiveFlight[] {
  const nowMs = reference.getTime()
  const minMs = nowMs - LOOKBEHIND_MIN * 60_000
  const maxMs = nowMs + LOOKAHEAD_HOURS * 3_600_000

  const out: LiveFlight[] = []

  for (const route of SCHEDULED_ROUTES) {
    if (!route.daysOfWeek) continue
    if (!route.departureTime) continue

    // Day-of-week must be evaluated at the AIRPORT's timezone, not the user's PC
    const dayOfWeek = getDayOfWeekInTimezone(route.departure, reference)
    if (!route.daysOfWeek.includes(dayOfWeek)) continue

    const departureUtc = localWallClockToUtc(route.departure, route.departureTime, reference)
    const arrivalUtc = departureUtc + route.durationMin * 60_000

    if (departureUtc < minMs || departureUtc > maxMs) continue

    const minutesUntilDeparture = Math.round((departureUtc - nowMs) / 60_000)

    let status: LiveFlight['status'] = 'upcoming'
    if (minutesUntilDeparture < 0) status = 'departed'
    else if (minutesUntilDeparture <= 30) status = 'boarding'
    if (minutesUntilDeparture < -LOOKBEHIND_MIN) continue
    if (nowMs >= arrivalUtc - 15 * 60_000 && nowMs < arrivalUtc) status = 'arriving'

    out.push({
      ...route,
      departureUtc,
      arrivalUtc,
      minutesUntilDeparture,
      status,
    })
  }

  out.sort((a, b) => a.departureUtc - b.departureUtc)
  return out
}