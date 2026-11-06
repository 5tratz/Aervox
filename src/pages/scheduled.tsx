import { useEffect, useMemo, useState } from 'react'
import { Calendar, Search, Filter, RefreshCw, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AirlineLogo } from '@/components/map/panels/airport-logo'
import { cleanAircraftName } from '@/components/map/panels/airport-utils'
import { getAirport } from '@/lib/airports'
import { computeLiveSchedule, type LiveFlight } from '@/lib/live-schedule'
import { ScheduledFlightModal } from '@/components/scheduled-flight-modal'
import { useLocale } from '@/lib/locale-context'
import tzlookup from 'tz-lookup'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type AircraftFamily = 'all' | 'A320' | 'B737' | 'Widebody' | 'Turboprop' | 'Regional' | 'Other'

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function flagOf(icao?: string): string | null {
  if (!icao) return null
  const apt = getAirport(icao)
  if (!apt?.countryCode) return null
  let cc = apt.countryCode.trim().toLowerCase()
  if (cc === 'uk') cc = 'gb'
  return `https://flagcdn.com/${cc}.svg`
}

function airportTooltip(icao?: string): string {
  if (!icao) return 'Unknown Airport'
  const apt = getAirport(icao)
  if (!apt) return icao
  return `${apt.name} · ${apt.city || apt.country}`
}

function departureCountry(icao: string): string | null {
  const apt = getAirport(icao)
  return apt?.country || null
}

function getLocalParts(icao: string, utcMs: number): { time: string, date: string, abbr: string } {
  const apt = getAirport(icao)
  if (!apt) return { time: '—', date: '—', abbr: 'UTC' }
  let tz = 'UTC'
  try { tz = tzlookup(apt.lat, apt.lon) } catch { /* fallback */ }
  const d = new Date(utcMs)
  try {
    return {
      time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz, hour12: false }).format(d),
      date: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: tz }).format(d),
      abbr: new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' }).formatToParts(d).find(p => p.type === 'timeZoneName')?.value ?? 'UTC',
    }
  } catch {
    return { time: '—', date: '—', abbr: 'UTC' }
  }
}

export function ScheduledPage() {
  const { t } = useLocale()
  const [live, setLive] = useState<LiveFlight[]>([])
  const [search, setSearch] = useState('')
  const [filterAirline, setFilterAirline] = useState<string>('all')
  const [filterNetwork, setFilterNetwork] = useState<'all' | 'short' | 'long'>('all')
  const [filterFamily, setFilterFamily] = useState<AircraftFamily>('all')
  const [filterCountry, setFilterCountry] = useState<string>('all')
  const [selected, setSelected] = useState<LiveFlight | null>(null)

  const FAMILY_LABELS: Record<Exclude<AircraftFamily, 'all'>, string> = {
    A320: t('scheduled.familyA320'),
    B737: t('scheduled.familyB737'),
    Widebody: t('scheduled.familyWidebody'),
    Turboprop: t('scheduled.familyTurboprop'),
    Regional: t('scheduled.familyRegional'),
    Other: t('scheduled.familyOther'),
  }

  const statusBadge = (status: LiveFlight['status'], mins: number) => {
    if (status === 'departed') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 whitespace-nowrap">{t('scheduled.statusDeparted')}</span>
    }
    if (status === 'arriving') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 whitespace-nowrap">{t('scheduled.statusArriving')}</span>
    }
    if (status === 'boarding' || mins <= 30) {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/> {t('scheduled.statusBoarding')}</span>
    }
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border whitespace-nowrap"><Clock className="w-2.5 h-2.5"/> {t('scheduled.statusIn')} {formatDuration(mins)}</span>
  }

  useEffect(() => {
    const load = () => setLive(computeLiveSchedule())
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  const handleRefresh = () => {
    setLive(computeLiveSchedule())
  }

  const airlines = useMemo(() => {
    const set = new Set(live.map(r => r.airline))
    return Array.from(set).sort()
  }, [live])

  const families = useMemo(() => {
    const set = new Set(live.map(r => r.aircraftFamily))
    return Array.from(set).sort()
  }, [live])

  const countries = useMemo(() => {
    const set = new Set<string>()
    live.forEach(r => {
      const c = departureCountry(r.departure)
      if (c) set.add(c)
    })
    return Array.from(set).sort()
  }, [live])

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase()
    return live.filter(r => {
      if (filterAirline !== 'all' && r.airline !== filterAirline) return false
      if (filterNetwork !== 'all' && r.network !== filterNetwork) return false
      if (filterFamily !== 'all' && r.aircraftFamily !== filterFamily) return false
      if (filterCountry !== 'all') {
        const c = departureCountry(r.departure)
        if (c !== filterCountry) return false
      }
      if (q) {
        const matchesSearch =
          r.flightNumber.toUpperCase().includes(q) ||
          r.departure.toUpperCase().includes(q) ||
          r.arrival.toUpperCase().includes(q) ||
          r.airline.toUpperCase().includes(q)
        if (!matchesSearch) return false
      }
      return true
    })
  }, [live, search, filterAirline, filterNetwork, filterFamily, filterCountry])

  return (
    <div className="h-full flex flex-col space-y-4 pb-4">

      <div className="flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" /> {t('scheduled.title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('scheduled.desc')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          {t('scheduled.refresh')}
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('scheduled.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <select
          value={filterAirline}
          onChange={(e) => setFilterAirline(e.target.value)}
          className="px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 shrink-0"
        >
          <option value="all">{t('scheduled.allAirlines')}</option>
          {airlines.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
          className="px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 shrink-0"
        >
          <option value="all">{t('scheduled.departingFrom')}</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterFamily}
          onChange={(e) => setFilterFamily(e.target.value as AircraftFamily)}
          className="px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 shrink-0"
        >
          <option value="all">{t('scheduled.allAircraft')}</option>
          {families.map(f => (
            <option key={f} value={f}>{FAMILY_LABELS[f]}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 bg-background border border-border rounded-md p-1 shrink-0">
          <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
          {(['all', 'short', 'long'] as const).map(k => (
            <button
              key={k}
              onClick={() => setFilterNetwork(k)}
              className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors ${
                filterNetwork === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {k === 'all' ? t('common.all') : k === 'short' ? t('scheduled.shortHaul') : t('scheduled.longHaul')}
            </button>
          ))}
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {filtered.length === 0 ? (
          <CardContent className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">
              {t('scheduled.noFlights')}
            </p>
          </CardContent>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('scheduled.colAirline')}</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('scheduled.colFlight')}</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('scheduled.colAircraft')}</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('scheduled.colRoute')}</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('scheduled.colDeparture')}</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('scheduled.colDuration')}</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('scheduled.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const depFlag = flagOf(r.departure)
                  const arrFlag = flagOf(r.arrival)
                  const localDep = getLocalParts(r.departure, r.departureUtc)
                  return (
                    <tr
                      key={`${r.id}-${r.departureUtc}`}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelected(r)}
                    >
                      <td className="px-4 py-3 text-left">
                        <div className="flex items-center gap-2">
                          <AirlineLogo code={r.airlineCode} name={r.airline} />
                          <span className="text-xs font-medium">{r.airline}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-sm">{r.flightNumber}</td>
                      <td className="px-4 py-3 text-center text-xs font-mono">{cleanAircraftName(r.aircraft)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-xs">
                          <div className="flex items-center gap-1">
                            {depFlag && <img src={depFlag} alt="" className="w-3.5 h-2.5 object-cover rounded-[1px]" />}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="font-mono font-semibold cursor-help">{r.departure}</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-background text-foreground border-border shadow-md text-xs">
                                  {airportTooltip(r.departure)}
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
                                  <span className="font-mono font-semibold cursor-help">{r.arrival}</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-background text-foreground border-border shadow-md text-xs">
                                  {airportTooltip(r.arrival)}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-center">
                        <div className="font-mono font-semibold text-foreground flex justify-center items-center gap-1">
                          {localDep.time} <span className="text-[9px] text-muted-foreground font-sans font-normal">{localDep.abbr}</span>
                        </div>
                        <div className="text-muted-foreground text-[10px] mt-0.5">{localDep.date}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center bg-muted/50 border border-border/50 text-foreground px-2.5 py-1 rounded-md text-xs font-mono">
                          {formatDuration(r.durationMin)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {statusBadge(r.status, r.minutesUntilDeparture)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <ScheduledFlightModal
          route={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}