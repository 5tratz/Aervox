import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, Plane, MapPin, Clock, TrendingUp, Award,
  CheckCircle2, Navigation, Info, Gauge, ArrowDownToLine, ArrowUpFromLine,
  Hash,
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from 'next-themes'
import tzlookup from 'tz-lookup'
import { getAirport } from '@/lib/airports'
import { useFlightLog, type FlightRecord } from '@/lib/flight-log-context'
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const CARTO_KEY = 'cb1_4vpf_1_4075f48d3947d2fe37c5998e'
const TILES = {
  light: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
  dark: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
}

function coordsOf(icao?: string): [number, number] | null {
  if (!icao) return null
  const apt = getAirport(icao)
  return apt ? [apt.lat, apt.lon] : null
}

function flagOf(icao?: string): string | null {
  if (!icao) return null
  const apt = getAirport(icao)
  if (!apt?.countryCode) return null
  let cc = apt.countryCode.trim().toLowerCase()
  if (cc === 'uk') cc = 'gb'
  return `https://flagcdn.com/${cc}.svg`
}

function cleanAircraftName(raw?: string | null): string {
  if (!raw) return 'UNKNOWN'
  const parenMatch = raw.match(/\(([^)]+)\)/)
  if (parenMatch) {
    const inner = parenMatch[1].trim()
    if (inner.length <= 8) return inner.toUpperCase()
    return raw.split('(')[0].trim().toUpperCase()
  }
  if (raw.includes('_')) {
    const parts = raw.split(/[_ ]+/)
    const icao = parts.find(p => /^[A-Z][0-9A-Z]{2,4}$/i.test(p))
    if (icao) return icao.toUpperCase()
  }
  return raw.split('(')[0].trim().toUpperCase()
}

function toMs(ts: number | null | undefined): number | null {
  if (!ts || ts < 1000000000) return null
  return ts < 100000000000 ? ts * 1000 : ts
}

function fmtDateUTC(ts: number | null | undefined) {
  const ms = toMs(ts)
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtTimeUTC(ts: number | null | undefined) {
  const ms = toMs(ts)
  if (!ms) return '—'
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtLocal(ts: number | null | undefined, timezone: string | null): { time: string; date: string; abbr: string } {
  const ms = toMs(ts)
  if (!ms) return { time: '—', date: '—', abbr: '' }
  const d = new Date(ms)
  const tz = timezone || 'UTC'
  try {
    const timeFmt = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: tz, hour12: false,
    })
    const dateFmt = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', timeZone: tz,
    })
    const abbrFmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' })
    const abbr = abbrFmt.formatToParts(d).find(p => p.type === 'timeZoneName')?.value ?? ''
    return { time: timeFmt.format(d), date: dateFmt.format(d), abbr }
  } catch {
    return { time: fmtTimeUTC(ts), date: fmtDateUTC(ts), abbr: 'UTC' }
  }
}

function getTimezone(icao?: string): string | null {
  if (!icao) return null
  const apt = getAirport(icao)
  if (!apt) return null
  try { return tzlookup(apt.lat, apt.lon) } catch { return null }
}

function fmtDuration(minutes: number | null) {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function airportDot(kind: 'origin' | 'destination') {
  const color = kind === 'origin' ? '#10b981' : '#ef4444'
  return L.divIcon({
    className: `debrief-${kind}-marker`,
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function MapBounds({ path }: { path: [number, number][] }) {
  const map = useMap()

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
      if (path.length === 0) return
      if (path.length === 1) { map.setView(path[0], 10); return }
      const bounds = L.latLngBounds(path)
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 })
    }, 100)
    return () => clearTimeout(timer)
  }, [map, JSON.stringify(path)])

  return null
}

type LandingBand = { label: string; color: string; pill: string; barColor: string; maxFpm: number }

function landingStatus(fpm: number | null): {
  label: string
  color: string
  pill: string
  barColor: string
  pct: number
} {
  const bands: LandingBand[] = [
    { label: 'Smooth', color: 'text-emerald-500', pill: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', barColor: 'bg-emerald-500', maxFpm: 200 },
    { label: 'Firm', color: 'text-yellow-500', pill: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20', barColor: 'bg-yellow-500', maxFpm: 400 },
    { label: 'Hard', color: 'text-orange-500', pill: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', barColor: 'bg-orange-500', maxFpm: 700 },
    { label: 'Very Hard', color: 'text-red-500', pill: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', barColor: 'bg-red-500', maxFpm: 2000 },
  ]

  if (fpm == null) {
    return { label: 'Unknown', color: 'text-muted-foreground', pill: 'bg-muted text-muted-foreground border-border', barColor: 'bg-muted-foreground', pct: 0 }
  }

  const abs = Math.abs(fpm)
  const band = bands.find(b => abs < b.maxFpm) ?? bands[bands.length - 1]
  const pct = Math.min(100, (abs / 1000) * 100)

  return { label: band.label, color: band.color, pill: band.pill, barColor: band.barColor, pct }
}

function deriveStats(flight: FlightRecord) {
  const blockHours = flight.blockMinutes > 0 ? flight.blockMinutes / 60 : 0
  const avgSpeedKts = blockHours > 0 ? flight.totalDistanceNm / blockHours : 0

  const startMs = toMs(flight.startTime)
  const hour = startMs ? new Date(startMs).getUTCHours() : 0
  let timeOfDay = 'Day'
  if (hour >= 5 && hour < 12) timeOfDay = 'Morning'
  else if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon'
  else if (hour >= 17 && hour < 21) timeOfDay = 'Evening'
  else timeOfDay = 'Night'

  return { avgSpeedKts, timeOfDay }
}

function AltitudeSparkline({ profile, className }: { profile: number[]; className?: string }) {
  if (!profile || profile.length < 2) {
    return (
      <div className={`flex items-center justify-center text-[10px] text-muted-foreground ${className ?? ''}`}>
        No altitude data recorded
      </div>
    )
  }

  const width = 400
  const height = 80
  const padding = 4
  const maxAlt = Math.max(...profile, 1000)

  const xStep = (width - padding * 2) / (profile.length - 1)
  const points = profile.map((alt, i) => {
    const x = padding + i * xStep
    const y = height - padding - (Math.max(0, alt) / maxAlt) * (height - padding * 2)
    return [x, y] as [number, number]
  })

  const polyline = points.map(([x, y]) => `${x},${y}`).join(' ')
  const areaPath =
    `M ${padding},${height - padding} ` +
    points.map(([x, y]) => `L ${x},${y}`).join(' ') +
    ` L ${width - padding},${height - padding} Z`

  const peakAlt = Math.round(maxAlt)

  return (
    <div className={`relative ${className ?? ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="altGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#altGradient)" />
        <polyline
          points={polyline}
          fill="none"
          stroke="rgb(59 130 246)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <line
          x1={padding}
          x2={width - padding}
          y1={padding}
          y2={padding}
          stroke="rgb(148 163 184)"
          strokeWidth="0.5"
          strokeDasharray="2,2"
          opacity="0.6"
        />
      </svg>
      <div className="absolute top-0.5 right-1.5 text-[9px] font-mono text-muted-foreground">
        Peak {peakAlt.toLocaleString()} ft
      </div>
    </div>
  )
}

export function FlightDebriefPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { flights } = useFlightLog()

  const [flight, setFlight] = useState<FlightRecord | null>(null)

  useEffect(() => {
    if (!id) return
    const found = flights.find(f => f.id === id)
    setFlight(found ?? null)
  }, [id, flights])

  if (!flight) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Plane className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Flight not found.</p>
        <Button variant="outline" onClick={() => navigate('/logbook')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Logbook
        </Button>
      </div>
    )
  }

  const originCoords = coordsOf(flight.departure)
  const destinationCoords = coordsOf(flight.arrival)

  const straightPath: [number, number][] = []
  if (originCoords) straightPath.push(originCoords)
  if (destinationCoords) straightPath.push(destinationCoords)

  const routePath: [number, number][] =
    (flight.track && flight.track.length >= 2) ? flight.track : straightPath

  const hasRecordedTrack = !!(flight.track && flight.track.length >= 2)
  const cleanedAircraft = cleanAircraftName(flight.aircraft)
  const landing = landingStatus(flight.landingRateFpm)

  const depTz = getTimezone(flight.departure)
  const arrTz = getTimezone(flight.arrival)

  const depLocal = fmtLocal(flight.startTime, depTz)
  const arrLocal = fmtLocal(flight.endTime, arrTz)

  const depFlag = flagOf(flight.departure)
  const arrFlag = flagOf(flight.arrival)

  const { avgSpeedKts, timeOfDay } = deriveStats(flight)

  return (
    <div className="h-full flex flex-col space-y-4 pb-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/logbook')} className="h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Flight Debrief</h1>
            <p className="text-sm text-muted-foreground">
              {fmtDateUTC(flight.startTime)} · {flight.flightNumber || flight.callsign}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 text-xs font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
          </span>
        </div>
      </div>

      {/* Unified route + timing banner */}
      <Card className="shrink-0">
        <CardContent className="p-0">
          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">

            {/* Departure */}
            <div className="p-4 sm:p-5">
              <div className="mb-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Departure</span>
              </div>
              <div className="flex items-center gap-2">
                {depFlag && <img src={depFlag} alt="" className="w-5 h-3.5 object-cover rounded-[2px]" />}
                <span className="text-2xl font-bold font-mono leading-tight">{flight.departure || '???'}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {getAirport(flight.departure)?.name || 'Unknown'}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-lg font-bold font-mono">{depLocal.time}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{depLocal.abbr || 'UTC'}</span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[11px] text-muted-foreground">{depLocal.date}</span>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                {fmtTimeUTC(flight.startTime)}Z
              </div>
            </div>

            {/* Center: block time + aircraft */}
            <div className="flex flex-col items-center justify-center px-4 border-x border-border/60 bg-muted/20 min-w-[140px]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="h-px w-5 bg-border" />
                <Plane className="h-3 w-3 text-primary rotate-45" fill="currentColor" />
                <div className="h-px w-5 bg-border" />
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Block Time
              </div>
              <div className="text-sm font-bold font-mono mt-0.5">{fmtDuration(flight.blockMinutes)}</div>
              <div className="text-[10px] text-muted-foreground mt-1 text-center">
                <div className="font-mono">{cleanedAircraft}</div>
                <div className="font-mono text-[9px] opacity-70">{flight.flightNumber || flight.callsign}</div>
              </div>
            </div>

            {/* Arrival */}
            <div className="p-4 sm:p-5 text-right">
              <div className="mb-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Arrival</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-2xl font-bold font-mono leading-tight">{flight.arrival || '???'}</span>
                {arrFlag && <img src={arrFlag} alt="" className="w-5 h-3.5 object-cover rounded-[2px]" />}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {getAirport(flight.arrival)?.name || 'Unknown'}
              </div>
              <div className="mt-3 flex items-baseline gap-2 justify-end">
                <span className="text-[11px] text-muted-foreground">{arrLocal.date}</span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] text-muted-foreground font-mono">{arrLocal.abbr || 'UTC'}</span>
                <span className="text-lg font-bold font-mono">{arrLocal.time}</span>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                {fmtTimeUTC(flight.endTime)}Z
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">

        {/* Left column */}
        <div className="lg:col-span-1 flex flex-col gap-4 min-h-0">

          {/* Duration + Distance */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Duration</span>
                  <Clock className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="text-lg font-bold font-mono">{fmtDuration(flight.blockMinutes)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Distance</span>
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="text-lg font-bold font-mono">{Math.round(flight.totalDistanceNm)}<span className="text-xs font-normal ml-1">nm</span></div>
              </CardContent>
            </Card>
          </div>

          {/* Landing Rate */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                Landing Rating
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/70 cursor-pointer hover:text-foreground transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="w-64 p-3 bg-background text-foreground border-border shadow-md">
                      <div className="space-y-3">
                        <div>
                          <p className="font-semibold text-sm mb-1">Landing Rating</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Based on your vertical speed at touchdown, measured in feet per minute (fpm).
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="font-medium">Smooth</span></div>
                            <span className="font-mono text-[10px] text-muted-foreground">&lt; 200</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500" /><span className="font-medium">Firm</span></div>
                            <span className="font-mono text-[10px] text-muted-foreground">200 – 400</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500" /><span className="font-medium">Hard</span></div>
                            <span className="font-mono text-[10px] text-muted-foreground">400 – 700</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="font-medium">Very Hard</span></div>
                            <span className="font-mono text-[10px] text-muted-foreground">&gt; 700</span>
                          </div>
                        </div>
                      </div>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold font-mono leading-none ${landing.color}`}>
                  {flight.landingRateFpm != null ? Math.round(flight.landingRateFpm) : '—'}
                </span>
                <span className="text-xs text-muted-foreground">fpm</span>
                <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${landing.pill}`}>
                  {landing.label}
                </span>
              </div>
              <div className="mt-3">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${landing.barColor} transition-all`}
                    style={{ width: `${landing.pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                  <span>Smooth</span>
                  <span>Firm</span>
                  <span>Hard</span>
                  <span>Very Hard</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Flight Details */}
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Flight Details
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 text-xs flex-1 flex flex-col justify-between">
              <div className="space-y-3 flex-1 flex flex-col justify-around">
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Plane className="h-3 w-3" /> Aircraft
                  </span>
                  <span className="font-mono font-semibold">{cleanedAircraft}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Hash className="h-3 w-3" /> Flight Number
                  </span>
                  <span className="font-mono">{flight.flightNumber || flight.callsign}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Gauge className="h-3 w-3" /> Avg Speed
                  </span>
                  <span className="font-mono font-semibold">{Math.round(avgSpeedKts)} kts</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <ArrowUpFromLine className="h-3 w-3" /> Took off
                  </span>
                  <span className="font-mono font-semibold">{fmtTimeUTC(flight.startTime)}Z</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <ArrowDownToLine className="h-3 w-3" /> Landed
                  </span>
                  <span className="font-mono font-semibold">{fmtTimeUTC(flight.endTime)}Z</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> Time of Day
                  </span>
                  <span className="font-semibold">{timeOfDay}</span>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right column */}
        <Card className="lg:col-span-2 overflow-hidden shadow-md flex flex-col min-h-0">
          <CardHeader className="pb-2 pt-3 border-b bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {hasRecordedTrack ? 'Flight Trail' : 'Flight Route'}
              </CardTitle>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Departure
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> Arrival
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 relative flex-1" style={{ minHeight: 400 }}>
            <div className="absolute inset-0">
              <MapContainer
                center={[40, -95]}
                zoom={3}
                minZoom={2}
                maxBounds={[[-90, -180], [90, 180]]}
                maxBoundsViscosity={1.0}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
                scrollWheelZoom={true}
              >
                <TileLayer
                  url={theme === 'dark' ? TILES.dark : TILES.light}
                  attribution='&copy; OpenStreetMap &copy; CARTO'
                />
                <MapBounds path={routePath} />
                {routePath.length > 1 && (
                  <Polyline
                    positions={routePath}
                    pathOptions={{
                      color: hasRecordedTrack ? '#0ea5e9' : '#3b82f6',
                      weight: hasRecordedTrack ? 3 : 4,
                      opacity: 0.9,
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                  />
                )}
                {originCoords && (
                  <Marker position={originCoords} icon={airportDot('origin')}>
                    <Tooltip permanent direction="top" offset={[0, -10]} opacity={1} className="bg-background text-foreground border shadow-md font-mono text-xs font-bold px-2 py-1 rounded-md">
                      {flight.departure}
                    </Tooltip>
                  </Marker>
                )}
                {destinationCoords && (
                  <Marker position={destinationCoords} icon={airportDot('destination')}>
                    <Tooltip permanent direction="top" offset={[0, -10]} opacity={1} className="bg-background text-foreground border shadow-md font-mono text-xs font-bold px-2 py-1 rounded-md">
                      {flight.arrival}
                    </Tooltip>
                  </Marker>
                )}
              </MapContainer>
            </div>
          </CardContent>

          {/* Altitude profile strip */}
          <div className="border-t border-border px-4 py-2 bg-muted/10 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Altitude Profile
              </span>
              {flight.altitudeProfile && flight.altitudeProfile.length > 0 && (
                <span className="text-[9px] text-muted-foreground font-mono">
                  {flight.altitudeProfile.length} samples
                </span>
              )}
            </div>
            <div className="h-14 w-full">
              <AltitudeSparkline profile={flight.altitudeProfile ?? []} className="h-full w-full" />
            </div>
          </div>
        </Card>

      </div>

    </div>
  )
}