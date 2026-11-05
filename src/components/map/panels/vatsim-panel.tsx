import { Plane, Navigation, Crosshair } from 'lucide-react'
import { Polyline } from 'react-leaflet'
import type { VatsimPilot } from '../use-vatsim-traffic'
import { AIRPORTS } from '@/lib/airports'
import { getAircraftImage } from '@/lib/aircraft-images'
import type { SimbriefOFP } from '@/lib/simbrief'
import { useMemo } from 'react'
import { cleanAircraftName } from './airport-utils'

function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3440.065
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getTimezone(lon: number) {
  const offset = Math.round(lon / 15)
  const sign = offset >= 0 ? '+' : '-'
  const absOffset = Math.abs(offset).toString().padStart(2, '0')
  return `UTC${sign}${absOffset}:00`
}

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

function formatLocalTime(utcDate: Date | null, lon: number | null): string {
  if (!utcDate || lon === null || lon === undefined) return '—'
  const offsetHours = Math.round(lon / 15)
  const local = new Date(utcDate.getTime() + offsetHours * 3600000)
  const hh = local.getUTCHours().toString().padStart(2, '0')
  const mm = local.getUTCMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
}

function getDayOfWeek(utcDate: Date | null): string {
  if (!utcDate) return ''
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return days[utcDate.getUTCDay()]
}

function formatDuration(secondsStr?: string | null): string {
  if (!secondsStr) return '—'
  const secs = parseInt(String(secondsStr), 10)
  if (!isFinite(secs) || secs <= 0) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function formatTimeFromMs(ms: number): string {
  const d = new Date(ms)
  const hh = d.getUTCHours().toString().padStart(2, '0')
  const mm = d.getUTCMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}Z`
}

export interface FlightInfoPilot {
  callsign: string
  aircraft: string
  lat: number
  lon: number
  altitude: number
  groundspeed: number
  heading: number
  departure: string
  arrival: string
}

export function RouteLayer({ ofp }: { ofp: SimbriefOFP | null }) {
  const points = useMemo(() => {
    if (!ofp) return null
    const depIcao = ofp.origin?.icao_code
    const arrIcao = ofp.destination?.icao_code
    if (!depIcao || !arrIcao) return null
    const dep = AIRPORTS.find(a => a.icao === depIcao)
    const arr = AIRPORTS.find(a => a.icao === arrIcao)
    if (!dep || !arr) return null
    return [[dep.lat, dep.lon], [arr.lat, arr.lon]] as [number, number][]
  }, [ofp])

  if (!points) return null

  return (
    <Polyline
      positions={points}
      pathOptions={{ color: '#fbbf24', weight: 3, dashArray: '5, 10', opacity: 0.8 }}
    />
  )
}

export function FlightInfoPanel({
  pilot, source, ofp, flightNumber, onFollow, isFollowing
}: {
  pilot: FlightInfoPilot
  source: 'SIM' | 'VATSIM'
  ofp?: SimbriefOFP | null
  flightNumber?: string
  onFollow?: () => void
  isFollowing?: boolean
}) {
  const isOwn = source === 'SIM'
  const depIcao = ofp?.origin?.icao_code || pilot.departure
  const arrIcao = ofp?.destination?.icao_code || pilot.arrival
  const altIcao = ofp?.alternate?.icao_code

  const arr = AIRPORTS.find(a => a.icao === arrIcao || a.iata === arrIcao)
  const dep = AIRPORTS.find(a => a.icao === depIcao || a.iata === depIcao)

  let distanceToDest = 0
  let totalDistance = 0

  if (arr) {
    distanceToDest = distanceNm(pilot.lat, pilot.lon, arr.lat, arr.lon)
  }
  if (dep && arr) {
    totalDistance = distanceNm(dep.lat, dep.lon, arr.lat, arr.lon)
  }

  const altStr = pilot.altitude.toLocaleString()
  
  // Clean the aircraft name for display and image lookup
  const displayAircraft = cleanAircraftName(pilot.aircraft)
  const imgSrc = getAircraftImage(displayAircraft)

  const schedOutDate = isOwn ? parseSimbriefTime(ofp?.times?.sched_out) : null
  const actualOffDate = isOwn ? parseSimbriefTime(ofp?.times?.actual_off ?? ofp?.times?.sched_off) : null
  const schedInDate = isOwn ? parseSimbriefTime(ofp?.times?.sched_in) : null
  const estInDate = isOwn ? parseSimbriefTime(ofp?.times?.est_in) : null

  const depLon = dep?.lon ?? null
  const arrLon = arr?.lon ?? null

  const depTimeLocal = isOwn ? formatLocalTime(schedOutDate, depLon) : '—'
  const depActualLocal = isOwn ? formatLocalTime(actualOffDate, depLon) : '—'
  const arrTimeLocal = isOwn ? formatLocalTime(schedInDate, arrLon) : '—'
  const arrEstLocal = isOwn ? formatLocalTime(estInDate, arrLon) : '—'

  const depDay = isOwn ? getDayOfWeek(schedOutDate) : ''
  const arrDay = isOwn ? getDayOfWeek(schedInDate) : ''

  const enroute = isOwn ? formatDuration(ofp?.times?.est_time_enroute) : '—'

  let calcDepActual = '—'
  let calcArrEst = '—'
  let calcEnroute = '—'

  if (!isOwn && totalDistance > 0 && pilot.groundspeed > 50) {
    const distanceFlown = totalDistance - distanceToDest
    const timeFlownMins = (distanceFlown / pilot.groundspeed) * 60
    const timeRemainingMins = (distanceToDest / pilot.groundspeed) * 60
    const totalMins = timeFlownMins + timeRemainingMins

    const now = Date.now()
    calcDepActual = formatTimeFromMs(now - timeFlownMins * 60 * 1000)
    calcArrEst = formatTimeFromMs(now + timeRemainingMins * 60 * 1000)

    const h = Math.floor(totalMins / 60)
    const m = Math.floor(totalMins % 60)
    calcEnroute = `${h}h ${m.toString().padStart(2, '0')}m`
  }

  const displayDepActual = isOwn ? depActualLocal : calcDepActual
  const displayArrEst = isOwn ? arrEstLocal : calcArrEst
  const displayEnroute = isOwn ? enroute : calcEnroute

  const cruiseAlt = isOwn && ofp?.general?.initial_altitude
    ? `${parseInt(ofp.general.initial_altitude, 10).toLocaleString()} ft`
    : '—'
  const cruiseTas = isOwn && ofp?.general?.cruise_tas ? `${ofp.general.cruise_tas} kts` : '—'
  const rampFuel = isOwn && ofp?.fuel?.plan_ramp ? `${parseInt(ofp.fuel.plan_ramp, 10).toLocaleString()} kg` : '—'
  const payload = isOwn && ofp?.weights?.payload ? `${parseInt(ofp.weights.payload, 10).toLocaleString()} kg` : '—'
  const registration = ofp?.aircraft?.reg

  const depFullName = dep
    ? `${dep.name} (${dep.icao}${dep.iata ? ' / ' + dep.iata : ''})`
    : depIcao || 'Unknown'
  const arrFullName = arr
    ? `${arr.name} (${arr.icao}${arr.iata ? ' / ' + arr.iata : ''})`
    : arrIcao || 'Unknown'

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-zinc-950 text-foreground">

      <div className="bg-[#2d2d2d] text-white p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold tracking-tight text-[#fbbf24]">{flightNumber || pilot.callsign}</h2>
          <div className="flex items-center gap-1">
            {onFollow && (
              <button
                onClick={onFollow}
                title={isFollowing ? 'Stop following' : 'Follow this aircraft on the map'}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  isFollowing
                    ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/40'
                    : 'bg-zinc-700/50 text-gray-300 hover:bg-blue-500/20 hover:text-blue-300'
                }`}
              >
                <Crosshair className={`h-3 w-3 ${isFollowing ? 'animate-pulse' : ''}`} />
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
            <span className="text-xs bg-zinc-700/50 px-2 py-1 rounded text-gray-300 flex items-center gap-1">
              <Navigation className="h-3 w-3" /> {source}
            </span>
          </div>
        </div>
		<div className="text-sm text-gray-300 font-mono text-xs opacity-80 flex items-center gap-2">
		  <span>{displayAircraft || 'Unknown Aircraft'}</span>
		  {isOwn && registration && <span className="text-zinc-400">· {registration}</span>}
		  {flightNumber && pilot.callsign !== flightNumber && (
			<span className="ml-auto bg-zinc-700/50 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">
			  {pilot.callsign}
			</span>
		  )}
		</div>
      </div>

      <div className="relative w-full h-44 border-b border-border overflow-hidden bg-zinc-950">
        <img
          src={imgSrc}
          alt={displayAircraft}
          className={`w-full h-full object-cover ${imgSrc.endsWith('.png') ? 'object-[center_85%]' : 'object-center'}`}
          draggable={false}
          onError={(e) => { (e.target as HTMLImageElement).src = '/aircraft/placeholder.svg' }}
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 border-b border-border">
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="text-center flex-1">
            <div
              className="text-3xl font-bold tracking-tight cursor-help"
              title={depFullName}
            >
              {depIcao || '???'}
            </div>
            <div className="text-[11px] font-semibold text-foreground mt-1 truncate px-1">
              {dep?.name ? dep.name.split(' ')[0] : 'Departure'}
            </div>
            <div className="text-[9px] text-muted-foreground uppercase">
              {dep ? getTimezone(dep.lon) : '---'}
            </div>
          </div>

          <div className="flex flex-col items-center px-2 w-16">
            <div className="h-8 w-8 rounded-full bg-white border border-border flex items-center justify-center shadow-sm z-10">
              <Plane className="h-4 w-4 text-[#fbbf24] rotate-45" fill="currentColor" />
            </div>
            <div className="w-full border-t border-border mt-[-16px] -z-0" />
          </div>

          <div className="text-center flex-1">
            <div
              className="text-3xl font-bold tracking-tight cursor-help"
              title={arrFullName}
            >
              {arrIcao || '???'}
            </div>
            <div className="text-[11px] font-semibold text-foreground mt-1 truncate px-1">
              {arr?.name ? arr.name.split(' ')[0] : 'Arrival'}
            </div>
            <div className="text-[9px] text-muted-foreground uppercase">
              {arr ? getTimezone(arr.lon) : '---'}
            </div>
          </div>
        </div>

        {isOwn && altIcao && (
          <div className="px-4 pb-2 text-[10px] text-muted-foreground">
            ALT: <span className="font-mono font-semibold text-foreground">{altIcao}</span>
          </div>
        )}

        {isOwn && ofp?.general?.route && (
          <div className="px-3 py-2 border-t border-border bg-muted/10 text-[10px] font-mono text-muted-foreground truncate" title={ofp.general.route}>
            Route: {ofp.general.route}
          </div>
        )}

        <div className="grid grid-cols-2 divide-x divide-border border-t border-border mt-2">
          <div className="flex flex-col">
            {isOwn && (
              <div className="flex justify-between px-3 py-1.5 border-b border-border/50 text-xs">
                <span className="text-muted-foreground">
                  SCHEDULED {depDay && <span className="text-[9px]">{depDay}</span>}
                </span>
                <span className="font-semibold font-mono">{depTimeLocal}</span>
              </div>
            )}
            <div className="flex justify-between px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">
                ACTUAL {!isOwn && <span className="text-[9px] text-muted-foreground">(Calc)</span>}
              </span>
              <span className="font-semibold font-mono">{displayDepActual}</span>
            </div>
          </div>

          <div className="flex flex-col">
            {isOwn && (
              <div className="flex justify-between px-3 py-1.5 border-b border-border/50 text-xs">
                <span className="text-muted-foreground">
                  SCHEDULED {arrDay && <span className="text-[9px]">{arrDay}</span>}
                </span>
                <span className="font-semibold font-mono">{arrTimeLocal}</span>
              </div>
            )}
            <div className="flex justify-between px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">
                ESTIMATED {!isOwn && <span className="text-[9px] text-muted-foreground">(Calc)</span>}
              </span>
              <span className="font-semibold font-mono flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                {displayArrEst}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-muted/30 p-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <span>ENROUTE: <span className="font-mono text-foreground">{displayEnroute}</span></span>
          <span>{Math.round(distanceToDest)} nm to {arrIcao || '—'}</span>
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-border p-3 flex flex-col items-center justify-center shadow-sm">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Altitude</span>
            <span className="font-mono text-xl font-light">{altStr} <span className="text-sm">ft</span></span>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-border p-3 flex flex-col items-center justify-center shadow-sm">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Ground Speed</span>
            <span className="font-mono text-xl font-light">{Math.round(pilot.groundspeed)} <span className="text-sm">kts</span></span>
          </div>
        </div>

        {isOwn ? (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-border p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cruise Altitude</span>
              <span className="font-mono text-xs font-semibold">{cruiseAlt}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cruise TAS</span>
              <span className="font-mono text-xs font-semibold">{cruiseTas}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ramp Fuel</span>
              <span className="font-mono text-xs font-semibold">{rampFuel}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Payload</span>
              <span className="font-mono text-xs font-semibold">{payload}</span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-border/50 pt-2">
              <span className="text-muted-foreground">Flight Duration</span>
              <span className="font-mono text-xs font-semibold">{enroute}</span>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-border p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Heading</span>
              <span className="font-mono text-xs font-semibold">{Math.round(pilot.heading)}°</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-mono text-xs font-semibold">{Math.round(distanceToDest)} nm</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Position</span>
              <span className="font-mono text-xs text-muted-foreground">{pilot.lat.toFixed(4)}, {pilot.lon.toFixed(4)}</span>
            </div>
          </div>
        )}

        {isOwn && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-border p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Heading</span>
              <span className="font-mono font-semibold">{Math.round(pilot.heading)}°</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Position</span>
              <span className="font-mono text-xs text-muted-foreground">{pilot.lat.toFixed(4)}, {pilot.lon.toFixed(4)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function VatsimPanel({ pilot, onFollow, isFollowing }: { pilot: VatsimPilot; onFollow?: () => void; isFollowing?: boolean }) {
  const adapted: FlightInfoPilot = {
    callsign: pilot.callsign,
    aircraft: pilot.aircraft,
    lat: pilot.lat,
    lon: pilot.lon,
    altitude: pilot.altitude,
    groundspeed: pilot.groundspeed,
    heading: pilot.heading,
    departure: pilot.departure,
    arrival: pilot.arrival,
  }
  return <FlightInfoPanel source="VATSIM" pilot={adapted} onFollow={onFollow} isFollowing={isFollowing} />
}