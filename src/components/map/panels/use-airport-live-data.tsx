import { useState, useEffect, useMemo, useRef } from 'react'
import type { Airport } from '@/lib/airports'
import type { VatsimPilot } from '../use-vatsim-traffic'
import type { SimPosition } from '@/lib/simconnect-context'
import { cleanAircraftName, type RowPilot, distanceNm } from './airport-utils'

function getAirportLocalTime(lon: number) {
  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000
  const offsetMs = (lon / 15) * 3600000
  const local = new Date(utcMs + offsetMs)
  
  return {
    time: local.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    date: local.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
  }
}

interface Props {
  airport: Airport
  pilots: VatsimPilot[]
  vatsimOn: boolean
  selfPilot?: SimPosition | null
  selfAircraft?: string | null
  selfCallsign: string
}

export function useAirportLiveData({
  airport, pilots, vatsimOn, selfPilot, selfAircraft, selfCallsign,
}: Props) {
  const localTimeObj = useMemo(() => getAirportLocalTime(airport.lon), [airport.lon])

  const vatsimArrivals = useMemo<RowPilot[]>(() => {
    if (!vatsimOn) return []
    const icao = airport.icao.toUpperCase()
    const iata = airport.iata.toUpperCase()
    return pilots.filter(p => {
      const dest = p.arrival.toUpperCase()
      return dest === icao || dest === iata
    }).map(p => ({
      key: `vatsim-${p.cid}`,
      callsign: p.callsign,
      aircraft: p.aircraft,
      altitude: p.altitude,
      groundspeed: p.groundspeed,
      departure: p.departure,
      arrival: p.arrival,
      lat: p.lat,
      lon: p.lon,
      isSelf: false,
    }))
  }, [pilots, airport, vatsimOn])

  const vatsimDepartures = useMemo<RowPilot[]>(() => {
    if (!vatsimOn) return []
    const icao = airport.icao.toUpperCase()
    const iata = airport.iata.toUpperCase()
    return pilots.filter(p => {
      const dep = p.departure.toUpperCase()
      return dep === icao || dep === iata
    }).map(p => ({
      key: `vatsim-${p.cid}`,
      callsign: p.callsign,
      aircraft: p.aircraft,
      altitude: p.altitude,
      groundspeed: p.groundspeed,
      departure: p.departure,
      arrival: p.arrival,
      lat: p.lat,
      lon: p.lon,
      isSelf: false,
    }))
  }, [pilots, airport, vatsimOn])

  const [trend, setTrend] = useState<'climb' | 'descend' | 'level'>('level')
  const samplesRef = useRef<{ alt: number; t: number }[]>([])

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
  }, [selfPilot?.altitude, selfPilot?.latitude, selfPilot?.longitude])

  const selfRow = useMemo<RowPilot | null>(() => {
    if (!selfPilot) return null
    return {
      key: 'self',
      callsign: selfCallsign,
      aircraft: cleanAircraftName(selfPilot.title, selfAircraft),
      altitude: selfPilot.altitude,
      groundspeed: selfPilot.ground_speed,
      departure: '',
      arrival: '',
      lat: selfPilot.latitude,
      lon: selfPilot.longitude,
      isSelf: true,
    }
  }, [selfPilot, selfCallsign, selfAircraft])

  const arrivals = useMemo<RowPilot[]>(() => {
    const list = [...vatsimArrivals]
    if (selfRow && selfPilot) {
      const d = distanceNm(selfPilot.latitude, selfPilot.longitude, airport.lat, airport.lon)
      const isArrival = !selfPilot.on_ground && d < 30 && selfPilot.altitude > 500 && trend === 'descend'
      if (isArrival) list.unshift(selfRow)
    }
    return list
  }, [vatsimArrivals, selfRow, selfPilot, trend, airport])

  const departures = useMemo<RowPilot[]>(() => {
    const list = [...vatsimDepartures]
    if (selfRow && selfPilot) {
      const d = distanceNm(selfPilot.latitude, selfPilot.longitude, airport.lat, airport.lon)
      const isDeparture = !selfPilot.on_ground && d < 30 && selfPilot.altitude < 15000 && trend === 'climb'
      if (isDeparture) list.unshift(selfRow)
    }
    return list
  }, [vatsimDepartures, selfRow, selfPilot, trend, airport])

  return { localTimeObj, arrivals, departures }
}