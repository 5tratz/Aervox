import { useState } from 'react'
import { ChevronDown, Crosshair } from 'lucide-react'
import type { Airport } from '@/lib/airports'
import { AIRPORTS } from '@/lib/airports'
import { AirlineLogo } from './airport-logo'
import {
  airlineFromCallsign,
  distanceNm,
  cleanAircraftName,
  type RowPilot
} from './airport-utils'
import tzlookup from 'tz-lookup'

function parseSimbriefTime(raw?: string | null): Date | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (/^\d{2}:\d{2}$/.test(s)) {
    const d = new Date()
    d.setUTCHours(parseInt(s.slice(0, 2), 10), parseInt(s.slice(3, 5), 10), 0, 0)
    return d
  }
  if (/^\d{4}$/.test(s)) {
    const d = new Date()
    d.setUTCHours(parseInt(s.slice(0, 2), 10), parseInt(s.slice(2, 4), 10), 0, 0)
    return d
  }
  if (/^\d{10}$/.test(s)) return new Date(parseInt(s, 10) * 1000)
  if (/^\d{13}$/.test(s)) return new Date(parseInt(s, 10))
  return null
}

function formatLocalAirportTime(utcDate: Date | null, airport: Airport): string {
  if (!utcDate) return '—'

  let tz = 'UTC'
  try {
    tz = tzlookup(airport.lat, airport.lon)
  } catch { /* fallback to UTC */ }

  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
      hour12: false,
    }).format(utcDate)
  } catch {
    return utcDate.toISOString().slice(11, 16)
  }
}

function formatLiveEta(distanceRemaining: number, groundspeed: number, airport: Airport): string {
  if (groundspeed < 50) return '—'
  const hoursRemaining = distanceRemaining / groundspeed
  const minsRemaining = Math.round(hoursRemaining * 60)
  if (minsRemaining > 1440) return '—'

  const etaUtc = new Date()
  etaUtc.setMinutes(etaUtc.getMinutes() + minsRemaining)

  return formatLocalAirportTime(etaUtc, airport)
}

export function LiveFlightRow({
  pilot, airport, type, onShowOnMap,
}: {
  pilot: RowPilot
  airport: Airport
  type: 'departure' | 'arrival' | 'ground'
  onShowOnMap?: (pilot: RowPilot) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const airlineCode = airlineFromCallsign(pilot.callsign)
  const distance = distanceNm(pilot.lat, pilot.lon, airport.lat, airport.lon)

  const routeIcao = type === 'departure' ? pilot.arrival : pilot.departure
  const routeCity = routeIcao ? (AIRPORTS.find(a => a.icao === routeIcao)?.name.split(' ')[0] || routeIcao) : 'Unknown'

  const cleanAircraft = cleanAircraftName(pilot.aircraft)

  let timeTop: string
  let timeBottom: string

  if (pilot.scheduledTime) {
    const schedDate = parseSimbriefTime(pilot.scheduledTime)
    timeTop = formatLocalAirportTime(schedDate, airport)

    const fakeActual = schedDate ? new Date(schedDate.getTime() + 3600000) : null
    timeBottom = formatLocalAirportTime(fakeActual, airport)
  } else if (type === 'arrival' && !pilot.isSelf) {
    timeTop = 'Est.'
    timeBottom = formatLiveEta(distance, pilot.groundspeed, airport)
  } else {
    timeTop = '--:--'
    timeBottom = '--:--'
  }

  let badge = null
  if (pilot.isSelf) {
    badge = <span className="bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">YOU</span>
  } else if (type === 'ground' || pilot.altitude < 100) {
    badge = <span className="bg-muted text-muted-foreground border border-border text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">GROUND</span>
  } else if (pilot.departureStatus === 'Scheduled' || pilot.arrivalStatus === 'Scheduled') {
    badge = <span className="bg-muted text-muted-foreground border border-border text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">SCHED</span>
  } else {
    badge = <span className="bg-yellow-400 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1"><span className="w-1.5 h-1.5 bg-black rounded-full animate-pulse"/> LIVE</span>
  }

  return (
    <div className="bg-background border-b border-border flex flex-col transition-colors">
      <div
        className={`flex items-center px-3 py-3 cursor-pointer hover:bg-muted/30 ${expanded ? 'bg-muted/10' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-[50px] flex flex-col items-start shrink-0">
          <span className="text-sm font-bold text-foreground leading-tight">{timeTop}</span>
          <span className="text-[11px] text-muted-foreground font-medium leading-tight">{timeBottom}</span>
        </div>

        <div className="w-[55px] flex items-center justify-center shrink-0">
          <AirlineLogo code={airlineCode} name={airlineCode} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center px-2">
          <span className="font-bold text-sm text-foreground truncate">
            {routeCity} <span className="text-xs text-muted-foreground font-normal ml-1">{routeIcao}</span>
          </span>
          <span className="text-xs text-muted-foreground font-mono font-medium truncate mt-0.5">
            {pilot.isSelf && pilot.flightNumber ? pilot.flightNumber : pilot.callsign}
          </span>
        </div>

        {/* Right-side centered column */}
        <div className="w-10 flex flex-col items-center justify-center shrink-0">
          <div className="h-4 flex items-center justify-center w-full">
            {badge}
          </div>
          <div className="h-3.5 flex items-center justify-center w-full mt-1">
            <span className="text-[10px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded shadow-sm uppercase leading-none">
              {cleanAircraft}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end shrink-0 gap-1 ml-2">
          {onShowOnMap && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onShowOnMap(pilot)
              }}
              title="Show on Map"
              className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Crosshair className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 bg-muted/10 border-t border-border/50 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-background rounded border border-border p-2 flex flex-col shadow-sm">
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Altitude</span>
              <span className="font-mono text-sm font-semibold">{Math.round(pilot.altitude).toLocaleString()} ft</span>
            </div>
            <div className="bg-background rounded border border-border p-2 flex flex-col shadow-sm">
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Ground Speed</span>
              <span className="font-mono text-sm font-semibold">{Math.round(pilot.groundspeed)} kts</span>
            </div>
            <div className="bg-background rounded border border-border p-2 flex flex-col shadow-sm">
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Route</span>
              <span className="font-mono text-sm font-semibold truncate">
                {pilot.departure || '???'} → {pilot.arrival || '???'}
              </span>
            </div>
            <div className="bg-background rounded border border-border p-2 flex flex-col shadow-sm">
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Position</span>
              <span className="font-mono text-xs text-muted-foreground truncate">{pilot.lat.toFixed(4)}, {pilot.lon.toFixed(4)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}