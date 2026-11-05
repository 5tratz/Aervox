import { useState, useEffect, useMemo, useRef } from 'react'
import { CloudRain, ArrowDown, Wind, MapPin, PlaneTakeoff, PlaneLanding, Plane, Building2, ChevronDown, Star } from 'lucide-react'
import { toast } from 'sonner'
import type { Airport } from '@/lib/airports'
import { calculateHumidity, type MetarData } from '@/lib/weather'
import { getFlagSvg } from '../map-constants'
import type { VatsimPilot } from '../use-vatsim-traffic'
import type { SimPosition } from '@/lib/simconnect-context'
import type { SimbriefOFP } from '@/lib/simbrief'
import { LiveFlightRow } from './airport-panel-row'
import { distanceNm, cleanAircraftName, formatTime, type RowPilot } from './airport-utils'
import { useLocale } from '@/lib/locale-context'
import { usePilot } from '@/lib/pilot-context'
import tzlookup from 'tz-lookup'

interface Props {
  airport: Airport
  metar: MetarData | null
  metarLoading: boolean
  showMetarDetails: boolean
  showStats: boolean
  onToggleMetar: () => void
  onToggleStats: () => void
  pilots: VatsimPilot[]
  vatsimOn: boolean
  selfPilot?: SimPosition | null
  selfAircraft?: string | null
  selfCallsign?: string
  selfFlightNumber?: string
  ofp?: SimbriefOFP | null
  onShowOnMap?: (pilot: RowPilot) => void
}

type Tab = 'general' | 'departures' | 'arrivals' | 'ground'

const PERSIST_MS = 3 * 60 * 1000
const ARRIVAL_RADIUS_NM = 15
const DEPARTURE_RADIUS_NM = 15

function getAirportLocalTime(lat: number, lon: number) {
  let tz = 'UTC'
  try {
    tz = tzlookup(lat, lon)
  } catch { /* fallback */ }

  const now = new Date()
  try {
    const timeStr = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
      hour12: false,
    }).format(now)

    const dateStr = new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: 'numeric',
      timeZone: tz,
    }).format(now)

    const tzName = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      timeZoneName: 'long',
    }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? tz

    const offsetPart = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      timeZoneName: 'longOffset',
    }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? 'GMT'

    const offsetStr = offsetPart.replace('GMT', '').trim()
    const formattedOffset = offsetStr ? `(${offsetStr})` : '(GMT+00:00)'

    return { timeStr, dateStr, abbr: tz, tzName, formattedOffset }
  } catch {
    return { timeStr: now.toISOString().slice(11, 16), dateStr: '', abbr: 'UTC', tzName: 'Coordinated Universal Time', formattedOffset: '(UTC+00:00)' }
  }
}

function vatsimToRow(p: VatsimPilot): RowPilot {
  return {
    key: `vatsim-${p.cid}`,
    callsign: p.callsign,
    cid: p.cid,
    aircraft: p.aircraft,
    altitude: p.altitude,
    groundspeed: p.groundspeed,
    departure: p.departure,
    arrival: p.arrival,
    lat: p.lat,
    lon: p.lon,
    isSelf: false,
  }
}

export function AirportPanel({
  airport, metar, metarLoading,
  showMetarDetails, onToggleMetar, 
  pilots, vatsimOn, selfPilot, selfAircraft, selfCallsign = 'YOU', selfFlightNumber, ofp,
  onShowOnMap,
}: Props) {
  const { t } = useLocale()
  const { pilot, update } = usePilot()
  const [activeTab, setActiveTab] = useState<Tab>('general')

  const [trend, setTrend] = useState<'climb' | 'descend' | 'level'>('level')
  const samplesRef = useRef<{ alt: number; t: number }[]>([])

  const [departureTime, setDepartureTime] = useState<number | null>(null)
  const [arrivalTime, setArrivalTime] = useState<number | null>(null)

  const localTime = useMemo(() => getAirportLocalTime(airport.lat, airport.lon), [airport.lat, airport.lon])

  const isFavorite = pilot.favoriteAirports?.includes(airport.icao) || false

  const toggleFavorite = async () => {
    const currentFavorites = pilot.favoriteAirports || []
    let newFavorites: string[]

    if (isFavorite) {
      newFavorites = currentFavorites.filter(icao => icao !== airport.icao)
      toast.success(t('airport.removedFromFavorites'))
    } else {
      newFavorites = [...currentFavorites, airport.icao]
      toast.success(t('airport.addedToFavorites'))
    }

    await update({ favoriteAirports: newFavorites })
  }

  useEffect(() => {
    if (!selfPilot) {
      samplesRef.current = []
      setTrend('level')
      return
    }
    const now = Date.now()
    samplesRef.current.push({ alt: selfPilot.altitude, t: now })
    samplesRef.current = samplesRef.current.filter(s => now - s.t < 3000)

    if (samplesRef.current.length < 2) return

    const first = samplesRef.current[0]
    const last = samplesRef.current[samplesRef.current.length - 1]
    const timeSpanSec = (last.t - first.t) / 1000
    if (timeSpanSec < 1) return

    const deltaAlt = last.alt - first.alt
    const rateFpm = (deltaAlt / timeSpanSec) * 60

    let next: 'climb' | 'descend' | 'level' = 'level'
    if (rateFpm > 300) next = 'climb'
    else if (rateFpm < -300) next = 'descend'

    if (next !== trend) setTrend(next)
  }, [selfPilot?.altitude, selfPilot?.latitude, selfPilot?.longitude, trend])

  const vatsimArrivals = useMemo<RowPilot[]>(() => {
    if (!vatsimOn) return []
    const icao = airport.icao.toUpperCase()
    const iata = airport.iata.toUpperCase()
    return pilots.filter(p => {
      const dest = p.arrival.toUpperCase()
      return dest === icao || dest === iata
    }).map(vatsimToRow)
  }, [pilots, airport, vatsimOn])

  const vatsimDepartures = useMemo<RowPilot[]>(() => {
    if (!vatsimOn) return []
    const icao = airport.icao.toUpperCase()
    const iata = airport.iata.toUpperCase()
    return pilots.filter(p => {
      const dep = p.departure.toUpperCase()
      return dep === icao || dep === iata
    }).map(vatsimToRow)
  }, [pilots, airport, vatsimOn])

  const vatsimGround = useMemo<RowPilot[]>(() => {
    if (!vatsimOn) return []
    return pilots.filter(p => {
      const isLow = p.altitude < 100
      const d = distanceNm(p.lat, p.lon, airport.lat, airport.lon)
      return isLow && d < 10
    }).map(vatsimToRow)
  }, [pilots, airport, vatsimOn])

  const ofpRow = useMemo<RowPilot | null>(() => {
    if (!ofp || !selfPilot) return null
    const depIcao = ofp.origin?.icao_code
    const arrIcao = ofp.destination?.icao_code
    const isDep = depIcao === airport.icao
    const isArr = arrIcao === airport.icao
    if (!isDep && !isArr) return null

    return {
      key: 'simbrief',
      callsign: selfCallsign,
      flightNumber: selfFlightNumber,
      aircraft: cleanAircraftName(ofp.aircraft?.name || selfPilot.title, selfAircraft),
      altitude: selfPilot.altitude,
      groundspeed: selfPilot.ground_speed,
      departure: depIcao ?? '',
      arrival: arrIcao ?? '',
      lat: selfPilot.latitude,
      lon: selfPilot.longitude,
      isSelf: true,
      scheduledTime: formatTime(isDep ? ofp.times?.sched_out : ofp.times?.sched_in),
    } as any
  }, [ofp, airport, selfPilot, selfCallsign, selfFlightNumber, selfAircraft])

  const selfRow = useMemo<RowPilot | null>(() => {
    if (!selfPilot) return null
    return {
      key: 'self',
      callsign: selfCallsign,
      flightNumber: selfFlightNumber,
      aircraft: cleanAircraftName(selfPilot.title, selfAircraft),
      altitude: selfPilot.altitude,
      groundspeed: selfPilot.ground_speed,
      departure: ofp?.origin?.icao_code ?? '',
      arrival: ofp?.destination?.icao_code ?? '',
      lat: selfPilot.latitude,
      lon: selfPilot.longitude,
      isSelf: true,
    }
  }, [selfPilot, selfCallsign, selfFlightNumber, selfAircraft, ofp])

  const { arrivals, departures, ground } = useMemo(() => {
    const now = Date.now()
    let currentDepTime = departureTime
    let currentArrTime = arrivalTime

    const arrList = [...vatsimArrivals]
    const depList = [...vatsimDepartures]
    const groundList = [...vatsimGround]

    if (ofpRow && ofp) {
      const depIcao = ofp.origin?.icao_code
      const arrIcao = ofp.destination?.icao_code

      if (depIcao === airport.icao) {
        let status = 'Scheduled'
        if (selfPilot && !selfPilot.on_ground && trend === 'climb') {
           status = 'Departed'
        }
        depList.unshift({ ...ofpRow, departureStatus: status } as any)
      }

      if (arrIcao === airport.icao && !selfPilot?.on_ground && trend === 'climb') {
        // We are climbing away from origin, do not show in destination arrivals yet
      } else if (arrIcao === airport.icao) {
        let status = 'Scheduled'
        if (selfPilot) {
          const d = distanceNm(selfPilot.latitude, selfPilot.longitude, airport.lat, airport.lon)
          if (selfPilot.on_ground && d < 5) status = 'Landed'
          else if (!selfPilot.on_ground && d < ARRIVAL_RADIUS_NM) status = 'Inbound'
        }
        arrList.unshift({ ...ofpRow, arrivalStatus: status } as any)
      }
    }

    if (selfRow && selfPilot) {
      const d = distanceNm(selfPilot.latitude, selfPilot.longitude, airport.lat, airport.lon)

      if (selfPilot.on_ground && d < 5) {
        groundList.unshift(selfRow)
      }

      const alreadyInDep = depList.some(r => r.key === 'simbrief' || r.key === 'self')
      const alreadyInArr = arrList.some(r => r.key === 'simbrief' || r.key === 'self')

      const isDeparting = !selfPilot.on_ground && d < DEPARTURE_RADIUS_NM && selfPilot.altitude < 15000 && trend === 'climb'
      const recentlyDeparted = currentDepTime !== null && now - currentDepTime < PERSIST_MS

      if (isDeparting || recentlyDeparted) {
        if (isDeparting && currentDepTime === null) currentDepTime = now
        if (!alreadyInDep) {
          depList.unshift({ ...selfRow, departureStatus: 'Departed' } as any)
        }
      } else {
        currentDepTime = null
      }

      const isArriving = !selfPilot.on_ground && d < ARRIVAL_RADIUS_NM && trend === 'descend'
      const isLanded = selfPilot.on_ground && d < 5
      const recentlyArrived = currentArrTime !== null && now - currentArrTime < PERSIST_MS

      if (isArriving || isLanded || recentlyArrived) {
        if ((isArriving || isLanded) && currentArrTime === null) currentArrTime = now
        if (!alreadyInArr) {
          arrList.unshift({ ...selfRow, arrivalStatus: isLanded ? 'Landed' : 'Inbound' } as any)
        }
      } else {
        currentArrTime = null
      }
    }

    return { arrivals: arrList, departures: depList, ground: groundList }
  }, [vatsimArrivals, vatsimDepartures, vatsimGround, selfRow, ofpRow, ofp, selfPilot, trend, airport, departureTime, arrivalTime])

  useEffect(() => {
    if (!selfPilot) {
      if (departureTime !== null) setDepartureTime(null)
      if (arrivalTime !== null) setArrivalTime(null)
      return
    }
    const now = Date.now()
    const d = distanceNm(selfPilot.latitude, selfPilot.longitude, airport.lat, airport.lon)

    const isDeparting = !selfPilot.on_ground && d < DEPARTURE_RADIUS_NM && selfPilot.altitude < 15000 && trend === 'climb'
    const isArriving = !selfPilot.on_ground && d < ARRIVAL_RADIUS_NM && trend === 'descend'
    const isLanded = selfPilot.on_ground && d < 5

    if (isDeparting && departureTime === null) setDepartureTime(now)
    if ((isArriving || isLanded) && arrivalTime === null) setArrivalTime(now)

    if (departureTime !== null && now - departureTime > PERSIST_MS && !isDeparting) setDepartureTime(null)
    if (arrivalTime !== null && now - arrivalTime > PERSIST_MS && !isArriving && !isLanded) setArrivalTime(null)
  }, [selfPilot, trend, airport, departureTime, arrivalTime])

  const imageUrl = `/airports/${airport.icao.toUpperCase()}.webp`
  const placeholderUrl = '/airports/placeholder.svg'

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-zinc-950 text-foreground relative">

      <div className="bg-[#2d2d2d] text-[#fbbf24] p-4 relative shrink-0">
        <div className="flex justify-between items-start mb-1">
          <h2 className="text-xl font-semibold tracking-tight leading-tight line-clamp-2 pr-8">
            {airport.name}
          </h2>
          <button
            onClick={toggleFavorite}
            className={`absolute top-4 right-4 p-1.5 rounded-md transition-colors ${
              isFavorite 
                ? 'text-yellow-400 hover:bg-white/10' 
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm text-white">
          <div dangerouslySetInnerHTML={{ __html: getFlagSvg(airport.countryCode || 'un') }} />
          <span className="font-semibold tracking-widest uppercase">
            {airport.iata} / {airport.icao}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-300 mt-2 font-medium">
          <span className="cursor-help" title={`${t('airport.localTime')} (${localTime.tzName})`}>
            {localTime.timeStr} LT
          </span>
          <span>|</span>
          <span>{localTime.dateStr}</span>
          <span>|</span>
          <span>{t('airport.elevation')} {airport.alt} ft</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-16">
        {activeTab === 'general' && (
          <div className="p-3 space-y-3">
            
            {/* Airport Image */}
            <div className="w-full h-40 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center relative shrink-0">
              <img 
                src={imageUrl} 
                alt={airport.name} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement
                  if (target.src !== window.location.origin + placeholderUrl) {
                    target.src = placeholderUrl
                  }
                }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white dark:bg-zinc-900 rounded border border-border p-2 flex flex-col items-center justify-between h-24">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 text-center leading-tight">{t('airport.conditions')}</span>
                {metarLoading ? (
                  <div className="h-5 w-5 animate-pulse bg-muted rounded-full" />
                ) : (
                  <CloudRain className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="font-semibold text-xs mb-1">{metar?.flight_category || '—'}</span>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded border border-border p-2 flex flex-col items-center justify-between h-24">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 text-center leading-tight">{t('airport.temperature')}</span>
                {metarLoading ? (
                  <div className="h-6 w-12 animate-pulse bg-muted rounded" />
                ) : (
                  <span className="text-xl font-light leading-none">
                    {metar?.temp != null ? `${metar.temp} °C` : '—'}
                  </span>
                )}
                <span className="text-xs opacity-0 mb-1">.</span>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded border border-border p-2 flex flex-col items-center justify-between h-24">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 text-center leading-tight">{t('airport.wind')}</span>
                {metarLoading ? (
                  <div className="h-5 w-10 animate-pulse bg-muted rounded" />
                ) : metar?.wind_speed != null ? (
                  <ArrowDown className="h-5 w-5 text-muted-foreground" style={{ transform: `rotate(${metar.wind_dir}deg)` }} />
                ) : (
                  <Wind className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-semibold text-[11px] mb-1">
                  {metar?.wind_speed != null
                    ? `${metar.wind_dir}° ${metar.wind_speed} kts${metar.wind_gust ? ` (G ${metar.wind_gust})` : ''}`
                    : '—'}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-border rounded overflow-hidden">
              <button
                onClick={onToggleMetar}
                className="w-full py-2 flex items-center justify-center gap-2 text-blue-500 hover:bg-muted text-sm font-medium transition-colors"
              >
                <CloudRain className="h-4 w-4" />
                {t('airport.moreWeather')}
                <ChevronDown className={`h-4 w-4 transition-transform ${showMetarDetails ? 'rotate-180' : ''}`} />
              </button>

              {showMetarDetails && (
                <div className="border-t border-border p-3 space-y-3">
                  {metarLoading ? (
                    <p className="text-xs text-center text-muted-foreground">{t('airport.loadingWeather')}</p>
                  ) : metar ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase">{t('airport.altimeter')}</span>
                          <p className="text-xs font-semibold">{metar.altimeter} hPa</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase">{t('airport.dewPoint')}</span>
                          <p className="text-xs font-semibold">{metar.dewpoint} °C</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase">{t('airport.humidity')}</span>
                          <p className="text-xs font-semibold">{calculateHumidity(metar.temp, metar.dewpoint)} %</p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-border/50">
                        <span className="text-[10px] text-muted-foreground uppercase">{t('airport.latestMetar')}</span>
                        <p className="text-xs font-mono mt-1 text-muted-foreground leading-relaxed break-words">
                          {metar.raw}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-center text-muted-foreground">{t('airport.noMetar')}</p>
                  )}
                </div>
              )}
            </div>

            {/* LIVE NETWORK TRAFFIC */}
            <div className="bg-white dark:bg-zinc-900 border border-border rounded-lg overflow-hidden shadow-sm">
              <div className="w-full py-2.5 px-3 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[13px] font-bold text-foreground tracking-wide uppercase">{t('airport.statsTitle')}</span>
                  <span className="bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold px-2 py-0.5 rounded">{t('airport.live')}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 divide-x divide-border">
                <div className="p-3 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold text-center">{t('airport.liveDepartures')}</span>
                  <p className="font-bold text-lg text-foreground mt-1">{departures.length}</p>
                </div>
                <div className="p-3 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold text-center">{t('airport.liveArrivals')}</span>
                  <p className="font-bold text-lg text-foreground mt-1">{arrivals.length}</p>
                </div>
                <div className="p-3 flex flex-col items-center justify-center border-t border-border">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold text-center">{t('airport.ground')}</span>
                  <p className="font-bold text-lg text-foreground mt-1">{ground.length}</p>
                </div>
                <div className="p-3 flex flex-col items-center justify-center border-t border-border">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold text-center">{t('airport.totalPilots')}</span>
                  <p className="font-bold text-lg text-foreground mt-1">{pilots.length}</p>
                </div>
              </div>
            </div>

            {/* AIRPORT DETAILS */}
            <div className="bg-white dark:bg-zinc-900 border border-border rounded-lg overflow-hidden shadow-sm">
              <div className="w-full py-2.5 px-3 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-2">
                  <PlaneTakeoff className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[13px] font-bold text-foreground tracking-wide uppercase">{t('airport.detailsTitle')}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 divide-x divide-y divide-border text-center">
                <div className="p-2.5 flex flex-col items-center justify-center">
                  <span className="text-[9px] text-muted-foreground uppercase font-semibold">{t('airport.iata')}</span>
                  <p className="text-sm font-semibold">{airport.iata || '—'}</p>
                </div>
                <div className="p-2.5 flex flex-col items-center justify-center">
                  <span className="text-[9px] text-muted-foreground uppercase font-semibold">{t('airport.icao')}</span>
                  <p className="text-sm font-semibold">{airport.icao}</p>
                </div>
                <div className="p-2.5 flex flex-col items-center justify-center">
                  <span className="text-[9px] text-muted-foreground uppercase font-semibold">{t('airport.timezone')}</span>
                  <p className="text-sm font-semibold text-center leading-tight">
                    {localTime.tzName}<br/>
                    <span className="text-xs text-muted-foreground">{localTime.formattedOffset}</span>
                  </p>
                </div>
                <div className="p-2.5 flex flex-col items-center justify-center">
                  <span className="text-[9px] text-muted-foreground uppercase font-semibold">{t('airport.elevation')}</span>
                  <p className="text-sm font-semibold">{airport.alt} ft</p>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'departures' && (
          <div>
            {departures.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-2">
                <PlaneTakeoff className="h-8 w-8 mx-auto opacity-50" />
                <p className="text-sm">{t('airport.noDepartures')} {airport.iata || airport.icao}.</p>
                <p className="text-xs opacity-70">{t('airport.turnOnVatsim')}</p>
              </div>
            ) : (
              departures.map(p => (
                <LiveFlightRow key={p.key} pilot={p} airport={airport} type="departure" onShowOnMap={onShowOnMap} />
              ))
            )}
          </div>
        )}

        {activeTab === 'arrivals' && (
          <div>
            {arrivals.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-2">
                <PlaneLanding className="h-8 w-8 mx-auto opacity-50" />
                <p className="text-sm">{t('airport.noArrivals')} {airport.iata || airport.icao}.</p>
                <p className="text-xs opacity-70">{t('airport.turnOnVatsim')}</p>
              </div>
            ) : (
              arrivals.map(p => (
                <LiveFlightRow key={p.key} pilot={p} airport={airport} type="arrival" onShowOnMap={onShowOnMap} />
              ))
            )}
          </div>
        )}

        {activeTab === 'ground' && (
          <div>
             {ground.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-2">
                <Plane className="h-8 w-8 mx-auto opacity-50" />
                <p className="text-sm">{t('airport.noGround')}</p>
                <p className="text-xs opacity-70">{t('airport.groundHint')}</p>
              </div>
            ) : (
              ground.map(p => (
                <LiveFlightRow key={p.key} pilot={p} airport={airport} type="ground" onShowOnMap={onShowOnMap} />
              ))
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-background border-t border-border flex items-stretch h-12 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
            activeTab === 'general' ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-muted-foreground hover:bg-muted/50'
          }`}
        >
          <MapPin className="h-4 w-4" />
          {t('airport.tabGeneral')}
        </button>
        <button
          onClick={() => setActiveTab('departures')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
            activeTab === 'departures' ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-muted-foreground hover:bg-muted/50'
          }`}
        >
          <PlaneTakeoff className="h-4 w-4" />
          {t('airport.tabDepartures')}
        </button>
        <button
          onClick={() => setActiveTab('arrivals')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
            activeTab === 'arrivals' ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-muted-foreground hover:bg-muted/50'
          }`}
        >
          <PlaneLanding className="h-4 w-4" />
          {t('airport.tabArrivals')}
        </button>
        <button
          onClick={() => setActiveTab('ground')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
            activeTab === 'ground' ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-muted-foreground hover:bg-muted/50'
          }`}
        >
          <Plane className="h-4 w-4" />
          {t('airport.tabGround')}
        </button>
      </div>
    </div>
  )
}