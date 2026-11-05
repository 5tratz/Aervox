import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, Download, Search, Trash2, Award, Clock, Plane,
  AlertTriangle, MapPin, TrendingUp, Filter, Info,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useFlightLog } from '@/lib/flight-log-context'
import { useLocale } from '@/lib/locale-context'
import { toast } from 'sonner'
import { getAirport } from '@/lib/airports'
import tzlookup from 'tz-lookup'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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

function flagOf(icao?: string): string | null {
  if (!icao) return null
  const apt = getAirport(icao)
  if (!apt?.countryCode) return null
  let cc = apt.countryCode.trim().toLowerCase()
  if (cc === 'uk') cc = 'gb'
  return `https://flagcdn.com/${cc}.svg`
}

function getTimezone(icao?: string): string | null {
  if (!icao) return null
  const apt = getAirport(icao)
  if (!apt) return null
  try {
    return tzlookup(apt.lat, apt.lon)
  } catch {
    return null
  }
}

function getTimezoneAbbr(timezone: string | null): string {
  if (!timezone) return 'UTC'
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(new Date())
    return parts.find(p => p.type === 'timeZoneName')?.value ?? 'UTC'
  } catch {
    return 'UTC'
  }
}

function formatLocalDateTime(ts: number | null | undefined, timezone: string | null) {
  const ms = toMs(ts)
  if (!ms) return { date: '—', time: '—', abbr: 'UTC' }

  const tz = timezone || 'UTC'
  try {
    const timeStr = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
      hour12: false,
    }).format(new Date(ms))

    const dateStr = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: tz,
    }).format(new Date(ms))

    const abbr = getTimezoneAbbr(tz)

    return { date: dateStr, time: timeStr, abbr }
  } catch {
    const d = new Date(ms)
    return {
      date: d.toLocaleDateString('en-GB'),
      time: d.toISOString().slice(11, 16),
      abbr: 'UTC'
    }
  }
}

function fmtDuration(minutes: number | null) {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function toMs(ts: number | null | undefined) {
  if (!ts || ts < 1000000000) return null
  return ts < 100000000000 ? ts * 1000 : ts
}

function landingBadge(fpm: number | null, t: any): { pill: string; text: string; label: string } {
  if (fpm == null) {
    return {
      pill: 'bg-muted text-muted-foreground border-border',
      text: 'text-muted-foreground',
      label: '—',
    }
  }
  const abs = Math.abs(fpm)
  if (abs < 200) {
    return {
      pill: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      text: 'text-emerald-500',
      label: t('debrief.smooth'),
    }
  }
  if (abs < 400) {
    return {
      pill: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
      text: 'text-yellow-500',
      label: t('debrief.firm'),
    }
  }
  if (abs < 700) {
    return {
      pill: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
      text: 'text-orange-500',
      label: t('debrief.hard'),
    }
  }
  return {
    pill: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    text: 'text-red-500',
    label: t('debrief.veryHard'),
  }
}

function airportTooltip(icao?: string): string {
  if (!icao) return 'Unknown Airport'
  const apt = getAirport(icao)
  if (!apt) return icao
  return `${apt.name} · ${apt.city || apt.country}`
}

type SortKey = 'date' | 'duration' | 'distance' | 'landing'

export function LogbookPage() {
  const navigate = useNavigate()
  const { t } = useLocale()
  const { flights, deleteFlight, clearAll } = useFlightLog()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('date')
  const [confirm, setConfirm] = useState<
    | { type: 'single'; id: string }
    | { type: 'all' }
    | null
  >(null)

  const stats = useMemo(() => {
    const totalMins = flights.reduce((s, f) => s + f.blockMinutes, 0)
    const totalNm = flights.reduce((s, f) => s + f.totalDistanceNm, 0)
    const landingRates = flights.map(f => f.landingRateFpm).filter((v): v is number => v != null)
    const avgLanding = landingRates.length
      ? Math.round(landingRates.reduce((a, b) => a + b, 0) / landingRates.length)
      : 0
    const bestLanding = landingRates.length ? Math.round(Math.max(...landingRates)) : 0
    const worstLanding = landingRates.length ? Math.round(Math.min(...landingRates)) : 0
    const uniqueAirports = new Set<string>()
    flights.forEach(f => {
      if (f.departure) uniqueAirports.add(f.departure)
      if (f.arrival) uniqueAirports.add(f.arrival)
    })

    return {
      totalFlights: flights.length,
      totalHours: Math.floor(totalMins / 60),
      totalMinutes: totalMins % 60,
      totalDistance: Math.round(totalNm),
      avgLanding,
      bestLanding,
      worstLanding,
      uniqueAirports: uniqueAirports.size,
    }
  }, [flights])

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase()
    const list = q
      ? flights.filter(f =>
          (f.flightNumber || f.callsign).toUpperCase().includes(q) ||
          f.aircraft.toUpperCase().includes(q) ||
          f.departure.toUpperCase().includes(q) ||
          f.arrival.toUpperCase().includes(q)
        )
      : [...flights]

    list.sort((a, b) => {
      switch (sortBy) {
        case 'duration': return b.blockMinutes - a.blockMinutes
        case 'distance': return b.totalDistanceNm - a.totalDistanceNm
        case 'landing':  return (b.landingRateFpm ?? 0) - (a.landingRateFpm ?? 0)
        default:         return b.startTime - a.startTime
      }
    })
    return list
  }, [flights, search, sortBy])

  const handleConfirm = () => {
    if (!confirm) return
    if (confirm.type === 'single') {
      deleteFlight(confirm.id)
      toast.success(t('logbook.flightDeleted'))
    } else {
      clearAll()
      toast.success(t('logbook.historyCleared'))
    }
    setConfirm(null)
  }

  const exportCsv = () => {
    const rows = [
      ['Flight Number', 'Aircraft', 'Departure', 'Arrival', 'Takeoff Time', 'Takeoff Date', 'Takeoff TZ', 'Block (min)', 'Distance (nm)', 'Landing Rate (fpm)', 'Status', 'Arrival Date'],
      ...filtered.map(f => {
        const depTz = getTimezone(f.departure)
        const arrTz = getTimezone(f.arrival)
        const depLocal = formatLocalDateTime(f.startTime, depTz)
        const arrLocal = formatLocalDateTime(f.endTime, arrTz)

        return [
          f.flightNumber || f.callsign,
          cleanAircraftName(f.aircraft),
          f.departure,
          f.arrival,
          depLocal.time,
          depLocal.date,
          depLocal.abbr,
          String(f.blockMinutes),
          String(Math.round(f.totalDistanceNm)),
          String(f.landingRateFpm ?? ''),
          `Landed ${arrLocal.time} ${arrLocal.abbr}`,
          arrLocal.date,
        ]
      }),
    ]
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aervox-logbook-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('logbook.exportSuccess'))
  }

  return (
    <div className="h-full flex flex-col space-y-4 pb-4">

      <div className="flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> {t('logbook.title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('logbook.desc')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={flights.length === 0}>
            <Download className="h-4 w-4 mr-2" /> {t('logbook.exportCsv')}
          </Button>
          {flights.length > 0 && (
            <Button variant="destructive" onClick={() => setConfirm({ type: 'all' })}>
              <Trash2 className="h-4 w-4 mr-2" /> {t('common.clear')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{t('logbook.statsFlights')}</span>
              <Plane className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{stats.totalFlights}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{t('logbook.statsCompleted')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{t('logbook.statsTime')}</span>
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{stats.totalHours}h {stats.totalMinutes}m</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{t('logbook.statsBlockTime')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{t('logbook.statsDistance')}</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{stats.totalDistance.toLocaleString()} nm</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{stats.uniqueAirports} {t('logbook.statsAirports')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{t('logbook.statsAvgLanding')}</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/70 cursor-help hover:text-foreground transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="w-64 p-3 bg-background text-foreground border-border shadow-md">
                      <div className="space-y-3">
                        <div>
                          <p className="font-semibold text-sm mb-1">{t('debrief.landingRating')}</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {t('debrief.landingInfo')}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="font-medium">{t('debrief.smooth')}</span>
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground">&lt; 200</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-yellow-500" />
                              <span className="font-medium">{t('debrief.firm')}</span>
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground">200 – 400</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-orange-500" />
                              <span className="font-medium">{t('debrief.hard')}</span>
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground">400 – 700</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="font-medium">{t('debrief.veryHard')}</span>
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground">&gt; 700</span>
                          </div>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Award className="h-4 w-4 text-primary" />
            </div>
            <div className={`text-2xl font-bold ${landingBadge(stats.avgLanding, t).text}`}>
              {stats.avgLanding} <span className="text-sm font-normal text-foreground">fpm</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 flex gap-2">
              <span>{t('logbook.best')} <span className={landingBadge(stats.bestLanding, t).text}>{stats.bestLanding}</span></span>
              <span>·</span>
              <span>{t('logbook.worst')} <span className={landingBadge(stats.worstLanding, t).text}>{stats.worstLanding}</span></span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('logbook.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-1 bg-background border border-border rounded-md p-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
          {(['date', 'duration', 'distance', 'landing'] as SortKey[]).map(k => (
            <button
              key={k}
              onClick={() => setSortBy(k)}
              className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors ${
                sortBy === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {t(`logbook.sort${k.charAt(0).toUpperCase() + k.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {filtered.length === 0 ? (
          <CardContent className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">
              {flights.length === 0
                ? t('logbook.noFlights')
                : t('logbook.noMatches')}
            </p>
          </CardContent>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground" title="The flight number you entered in your profile for this flight.">{t('logbook.colFlight')}</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground" title="The aircraft you flew for this flight.">{t('logbook.colAircraft')}</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground" title="The departure and arrival airports (ICAO).">{t('logbook.colRoute')}</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground" title="The local time and date you took off.">{t('logbook.colTakeoff')}</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground" title="The total block time from gate to gate.">{t('logbook.colBlock')}</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground" title="The total distance flown in nautical miles.">{t('logbook.colDistance')}</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground" title="The landing rate recorded at touchdown in feet per minute (fpm).">{t('logbook.colLanding')}</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground" title="The final status of the flight and arrival time.">{t('logbook.colStatus')}</th>
                  <th className="text-center px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => {
                  const depFlag = flagOf(f.departure)
                  const arrFlag = flagOf(f.arrival)
                  const depTz = getTimezone(f.departure)
                  const arrTz = getTimezone(f.arrival)

                  const depLocal = formatLocalDateTime(f.startTime, depTz)
                  const arrLocal = formatLocalDateTime(f.endTime, arrTz)
                  const badge = landingBadge(f.landingRateFpm, t)

                  return (
                    <tr
                      key={f.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/logbook/${f.id}`)}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-sm text-center">{f.flightNumber || f.callsign}</td>
                      <td className="px-4 py-3 text-xs font-medium text-center">{cleanAircraftName(f.aircraft)}</td>
                      <td className="px-4 py-3 text-center">
                        {f.departure || f.arrival ? (
                          <div className="flex items-center justify-center gap-1.5 text-xs">
                            <div className="flex items-center gap-1">
                              {depFlag && <img src={depFlag} alt="" className="w-3.5 h-2.5 object-cover rounded-[1px]" />}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="font-mono font-semibold cursor-help">
                                      {f.departure || '—'}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="bg-background text-foreground border-border shadow-md text-xs">
                                    {airportTooltip(f.departure)}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <span className="text-muted-foreground">→</span>
                            <div className="flex items-center gap-1">
                              {arrFlag && <img src={arrFlag} alt="" className="w-3.5 h-2.5 object-cover rounded-[1px]" />}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="font-mono font-semibold cursor-help">
                                      {f.arrival || '—'}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="bg-background text-foreground border-border shadow-md text-xs">
                                    {airportTooltip(f.arrival)}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                            <MapPin className="h-3 w-3" /> {t('common.unknown')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-center">
                        <div className="font-mono font-semibold text-foreground flex justify-center items-center gap-1">
                          {depLocal.time} <span className="text-[9px] text-muted-foreground font-sans font-normal">{depLocal.abbr}</span>
                        </div>
                        <div className="text-muted-foreground text-[10px] mt-0.5">{depLocal.date}</div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs">{fmtDuration(f.blockMinutes)}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs">{Math.round(f.totalDistanceNm)} nm</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.pill}`}>
                          {f.landingRateFpm != null ? `${Math.round(f.landingRateFpm)} fpm` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20 whitespace-nowrap">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                            {t('logbook.statusLanded')} {arrLocal.time} {arrLocal.abbr}
                          </span>
                          <span className="text-[9px] text-muted-foreground">{arrLocal.date}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirm({ type: 'single', id: f.id })
                          }}
                          className="text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title={t('logbook.deleteFlight')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null) }}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center text-destructive">
              {confirm?.type === 'all' ? t('logbook.clearTitle') : t('logbook.deleteTitle')}
            </DialogTitle>
            <DialogDescription className="text-center">
              {confirm?.type === 'all'
                ? t('logbook.clearDesc')
                : t('logbook.deleteDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleConfirm}>
              {confirm?.type === 'all' ? t('common.clear') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}