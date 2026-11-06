import type { SimPosition } from '@/lib/simconnect-context'
import { FlightInfoPanel, type FlightInfoPilot } from './vatsim-panel'
import type { SimbriefOFP } from '@/lib/simbrief'
import { usePilot } from '@/lib/pilot-context'
import { useLocale } from '@/lib/locale-context'
import { getOwnTrail } from '../own-aircraft-marker'

function cleanAircraftName(title?: string | null) {
  if (!title) return 'AIRCRAFT'
  const parenMatch = title.match(/\(([^)]+)\)/)
  if (parenMatch) {
    const inner = parenMatch[1].trim()
    if (inner.length <= 8) return inner.toUpperCase()
    return title.split('(')[0].trim().toUpperCase()
  }
  return title.split('(')[0].trim().toUpperCase()
}

export function OwnAircraftPanel({
  pos,
  ofp,
  onFollow,
  isFollowing,
}: {
  pos: SimPosition
  ofp?: SimbriefOFP | null
  onFollow?: () => void
  isFollowing?: boolean
}) {
  const { t } = useLocale()
  const { pilot: profile } = usePilot()
  
  const ownTrail = getOwnTrail()

  const pilot: FlightInfoPilot = {
    callsign: profile.callsign || pos.callsign || t('airport.you'),
    aircraft: cleanAircraftName(pos.title),
    lat: pos.latitude,
    lon: pos.longitude,
    altitude: pos.altitude,
    groundspeed: pos.ground_speed,
    heading: pos.heading,
    departure: '',
    arrival: '',
    track: ownTrail, 
  }

  return (
    <FlightInfoPanel
      source="SIM"
      pilot={pilot}
      ofp={ofp}
      flightNumber={profile.flightNumber}
      onFollow={onFollow}
      isFollowing={isFollowing}
    />
  )
}