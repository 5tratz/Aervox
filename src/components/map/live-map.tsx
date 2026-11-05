import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useSimConnect, type SimPosition } from '@/lib/simconnect-context'
import { useTheme } from 'next-themes'
import { getAirport, type Airport } from '@/lib/airports'
import { fetchMetar, type MetarData } from '@/lib/weather'
import { loadJson, saveJson } from '@/lib/storage'
import { useLocale } from '@/lib/locale-context'
import { toast } from 'sonner'
import { useSimbrief } from '@/lib/simbrief-context'
import { usePilot } from '@/lib/pilot-context'

import { MAP_STYLES, WORLD_BOUNDS } from './map-constants'
import { FollowAircraft, TileBrightness } from './map-helpers'
import { VisibleAirports } from './airports-layer'
import { RainRadarLayer } from './rain-radar-layer'
import { WindLayer } from './wind-layer'
import { OwnAircraftMarker } from './own-aircraft-marker'
import { useVatsimTraffic, type VatsimPilot } from './use-vatsim-traffic'
import { VatsimLayer } from './vatsim-layer'
import { BottomBar, type SidebarTab } from './bottom-bar'
import { SidePanel } from './side-panel'
import { SettingsPanel, type MapSettings } from './panels/settings-panel'
import { WeatherPanel } from './panels/weather-panel'
import { FlightsPanel } from './panels/flights-panel'
import { AirportPanel } from './panels/airport-panel'
import { VatsimPanel, RouteLayer } from './panels/vatsim-panel'
import { OwnAircraftPanel } from './panels/own-aircraft-panel'
import { type RowPilot } from './panels/airport-utils'

const VATSIM_CSS = `
  .vatsim-plane { background: transparent; border: 0; cursor: pointer; }
  .own-plane { background: transparent; border: 0; cursor: pointer; }
  .vatsim-tooltip { background: transparent !important; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
  .vatsim-tooltip::before { display: none !important; }
  .vatsim-lbl-inner {
    display: flex; flex-direction: column;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px; line-height: 1.2;
    background: rgba(15,23,42,0.85); color: #f8fafc;
    padding: 2px 5px; border-radius: 3px; white-space: nowrap;
    border: 1px solid rgba(245,158,11,0.6);
    box-shadow: 0 1px 3px rgba(0,0,0,0.4); pointer-events: none;
  }
  .vatsim-lbl-inner span { display: block; }
  .vatsim-lbl-1 { font-weight: 700; color: #fbbf24; }
  .vatsim-lbl-2, .vatsim-lbl-3, .vatsim-lbl-4 { color: #cbd5e1; }
  .airport-pin:hover .airport-pin-inner { transform: scale(1.15); transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1); }
`

const EXTRA_CSS = `
  .f24-hover-tooltip {
    background: white !important; color: black !important;
    border: 1px solid #ccc !important; border-radius: 4px !important;
    padding: 2px 6px !important; font-weight: 700 !important;
    font-size: 11px !important; box-shadow: 0 1px 4px rgba(0,0,0,0.3) !important;
    opacity: 1 !important;
  }
  .f24-hover-tooltip::before { display: none !important; }
`

const DEFAULT_SETTINGS: MapSettings = {
  activeStyle: 'greyscale',
  brightness: 100,
  airportPinsEnabled: true,
  airportLabelsEnabled: false,
}

const DEFAULT_FLIGHT_SETTINGS = {
  vatsimOn: false,
  aircraftLabelsMode: 'off' as 'off' | 'text',
  iconSize: 30,
  showSimbriefRoute: false,
  showTrails: false,
  showOwnTrail: true,
}

// Zoom level used for every "locate" action so they all feel identical
const LOCATE_ZOOM = 13

type SelectedEntity =
  | { type: 'vatsim'; data: VatsimPilot }
  | { type: 'own'; data: SimPosition }
  | null

type FollowTarget =
  | { type: 'own' }
  | { type: 'vatsim'; cid: number }
  | null

function cleanAircraftName(title?: string | null): string {
  if (!title) return 'AIRCRAFT'
  const parenMatch = title.match(/\(([^)]+)\)/)
  if (parenMatch) {
    const inner = parenMatch[1].trim()
    if (inner.length <= 8) return inner.toUpperCase()
    return title.split('(')[0].trim().toUpperCase()
  }
  if (title.includes('_') || title.length > 12) {
    const parts = title.split(/[_ ]+/)
    const icao = parts.find(p => /^[A-Z][0-9A-Z]{2,4}$/i.test(p))
    if (icao) return icao.toUpperCase()
  }
  return title.split('(')[0].trim().toUpperCase()
}

function MapViewPersistence({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap()
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    onReady(map)

    const save = () => {
      if (!isMounted.current || !map.getContainer() || !map.getPane('mapPane')) return

      try {
        const c = map.getCenter()
        const z = map.getZoom()
        const payload = JSON.stringify({ center: [c.lat, c.lng], zoom: z })
        sessionStorage.setItem('map:view', payload)
      } catch (e) {
        // Ignore if the map is already dead
      }
    }

    map.on('moveend', save)
    map.on('zoomend', save)

    return () => {
      isMounted.current = false
      save()
      map.off('moveend', save)
      map.off('zoomend', save)
    }
  }, [map, onReady])

  return null
}

export function LiveMap() {
  const { t } = useLocale()
  const { position, aircraftFromFile, lastFlightStarted, connected } = useSimConnect()
  const { theme } = useTheme()
  const { ofp } = useSimbrief()
  const { pilot: profile } = usePilot()

  const [activeTab, setActiveTab] = useState<SidebarTab>(null)
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followTarget, setFollowTarget] = useState<FollowTarget>(null)

  const [settings, setSettings] = useState<MapSettings>(DEFAULT_SETTINGS)
  const [flightSettings, setFlightSettings] = useState(DEFAULT_FLIGHT_SETTINGS)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  const [showWeather, setShowWeather] = useState(false)
  const [showWind, setShowWind] = useState(false)
  const [metar, setMetar] = useState<MetarData | null>(null)
  const [metarLoading, setMetarLoading] = useState(false)
  const [showMetarDetails, setShowMetarDetails] = useState(false)
  const [showStats, setShowStats] = useState(false)

  const { pilots } = useVatsimTraffic(flightSettings.vatsimOn)

  const [initialView] = useState<{ center: [number, number], zoom: number } | null>(() => {
    const session = sessionStorage.getItem('map:view')
    return session ? JSON.parse(session) : null
  })

  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapReadyRef = useRef(false)

  const lastAppliedThemeRef = useRef<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleLeave = () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      const evt = new MouseEvent('mousemove', { bubbles: true, clientX: -1000, clientY: -1000 })
      container.dispatchEvent(evt)
    }

    container.addEventListener('pointerleave', handleLeave)
    return () => container.removeEventListener('pointerleave', handleLeave)
  }, [])

  const prevConnected = useRef(connected)
  useEffect(() => {
    if (prevConnected.current !== connected) {
      if (connected) toast.success(t('map.connected'))
      else toast.info(t('map.disconnected'))
      prevConnected.current = connected
    }
  }, [connected, t])

  useEffect(() => {
    Promise.all([
      loadJson<Partial<MapSettings>>('settings/map.json'),
      loadJson<Partial<typeof DEFAULT_FLIGHT_SETTINGS>>('settings/flights.json')
    ]).then(([savedMap, savedFlights]) => {
      if (savedMap) setSettings(prev => ({ ...prev, ...savedMap }))
      if (savedFlights) setFlightSettings(prev => ({ ...prev, ...savedFlights }))
      setSettingsLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (settingsLoaded) saveJson('settings/map.json', settings)
  }, [settingsLoaded, settings])

  useEffect(() => {
    if (settingsLoaded) saveJson('settings/flights.json', flightSettings)
  }, [settingsLoaded, flightSettings])

  useEffect(() => {
    if (!settingsLoaded) return
    const currentTheme = theme ?? 'dark'

    if (lastAppliedThemeRef.current === null) {
      lastAppliedThemeRef.current = currentTheme
      return
    }

    if (lastAppliedThemeRef.current === currentTheme) {
      return
    }

    lastAppliedThemeRef.current = currentTheme
    const themeStyle = currentTheme === 'dark' ? 'dark' : 'roadmap'
    setSettings((prev) =>
      prev.activeStyle === themeStyle ? prev : { ...prev, activeStyle: themeStyle }
    )
  }, [theme, settingsLoaded])

  useEffect(() => {
    if (selectedEntity?.type === 'vatsim' && pilots.length > 0) {
      const latest = pilots.find(p => p.cid === selectedEntity.data.cid)
      if (latest && latest !== selectedEntity.data) setSelectedEntity({ type: 'vatsim', data: latest })
    }
  }, [pilots, selectedEntity])

  useEffect(() => {
    if (selectedEntity?.type === 'own' && position) {
      if (position !== selectedEntity.data) setSelectedEntity({ type: 'own', data: position })
    }
  }, [position, selectedEntity])

  useEffect(() => {
    if (!selectedAirport) {
      setMetar(null); setShowMetarDetails(false); return
    }
    let cancelled = false
    setMetarLoading(true); setMetar(null)
    fetchMetar(selectedAirport.icao).then((data) => {
      if (!cancelled) { setMetar(data); setMetarLoading(false) }
    })
    return () => { cancelled = true }
  }, [selectedAirport])

  // Handle a "locate airport on map" request coming from the Profile page
  // (or anywhere else). Waits for the map to be fully ready, then flies to
  // the airport at the same zoom level used by the aircraft locate action.
  useEffect(() => {
    const icao = sessionStorage.getItem('aervox:locate')
    if (!icao) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0

    const attemptLocate = () => {
      if (cancelled) return

      const map = mapRef.current
      const airport = getAirport(icao) as
        | (Airport & { latitude?: number; longitude?: number; lat?: number; lon?: number; lng?: number })
        | null
        | undefined

      // Wait until the map ref exists, the map is marked ready, and the
      // airport lookup succeeded. Retry for ~4s then give up silently.
      if ((!map || !mapReadyRef.current || !airport) && attempts < 40) {
        attempts += 1
        timer = setTimeout(attemptLocate, 100)
        return
      }

      if (!map || !airport) return

      // The Airport type uses different field names in different projects.
      // Normalise so we never call flyTo with undefined values.
      const aptLat =
        typeof airport.latitude === 'number' ? airport.latitude :
        typeof airport.lat === 'number' ? airport.lat :
        undefined

      const aptLon =
        typeof airport.longitude === 'number' ? airport.longitude :
        typeof airport.lon === 'number' ? airport.lon :
        typeof airport.lng === 'number' ? airport.lng :
        undefined

      // If coordinates are genuinely missing, don't crash the map — just
      // clean up the request and still open the airport panel.
      if (aptLat == null || aptLon == null) {
        sessionStorage.removeItem('aervox:locate')
        setSelectedAirport(airport)
        setSelectedEntity(null)
        setActiveTab('airport')
        setFollowTarget(null)
        setIsFollowing(false)
        return
      }

      // Consume the request so it only fires once.
      sessionStorage.removeItem('aervox:locate')

      // Same zoom behaviour as handleShowOnMap / handleCenterOnMe:
      // never zoom out, but bump up to the shared locate zoom if we're
      // currently further out.
      const targetZoom = Math.max(map.getZoom(), LOCATE_ZOOM)

      map.flyTo([aptLat, aptLon], targetZoom, { duration: 1.2 })

      setSelectedAirport(airport)
      setSelectedEntity(null)
      setActiveTab('airport')
      setFollowTarget(null)
      setIsFollowing(false)
    }

    // Small delay so the initial view (restored center/zoom) has settled
    // before we start flying. This mirrors the feel of clicking a marker.
    timer = setTimeout(attemptLocate, 150)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  const lat = position?.latitude ?? null
  const lon = position?.longitude ?? null
  const center: [number, number] = lat != null && lon != null ? [lat, lon] : [51.5048, 0.0495]

  const tileUrl = useMemo(
    () => MAP_STYLES.find((s) => s.id === settings.activeStyle)?.url ?? MAP_STYLES[1].url,
    [settings.activeStyle],
  )

  const activeCid = selectedEntity?.type === 'vatsim' ? selectedEntity.data.cid : null

  const updateMapSetting = useCallback(
    <K extends keyof MapSettings>(key: K, value: MapSettings[K]) =>
      setSettings((prev) => ({ ...prev, [key]: value })),
    [],
  )

  const onSelectVatsim = useCallback((p: VatsimPilot) => {
    setSelectedEntity({ type: 'vatsim', data: p }); setSelectedAirport(null); setActiveTab('vatsim')
    setFollowTarget((prev) =>
      prev?.type === 'vatsim' && prev.cid === p.cid ? prev : null
    )
  }, [])

  const onSelectOwn = useCallback((p: SimPosition) => {
    setSelectedEntity({ type: 'own', data: p }); setSelectedAirport(null); setActiveTab('own')
  }, [])

  const closePanel = useCallback(() => {
    setActiveTab(null); setSelectedAirport(null); setSelectedEntity(null)
    setIsFollowing(false)
    setFollowTarget(null)
  }, [])

  const selfCallsign = useMemo(() => {
    const fromProfile = (profile.callsign || '').trim()
    if (fromProfile) return fromProfile
    const fromSim = (position?.callsign || '').trim()
    if (fromSim) return fromSim
    const icao = cleanAircraftName(position?.title)
    return icao && icao !== 'AIRCRAFT' ? `${icao}-AERVOX` : 'AERVOX'
  }, [profile.callsign, position?.title, position?.callsign])

  const followLat = useMemo(() => {
    if (!followTarget) return null
    if (followTarget.type === 'own') return position?.latitude ?? null
    const p = pilots.find(p => p.cid === followTarget.cid)
    return p?.lat ?? null
  }, [followTarget, position, pilots])

  const followLon = useMemo(() => {
    if (!followTarget) return null
    if (followTarget.type === 'own') return position?.longitude ?? null
    const p = pilots.find(p => p.cid === followTarget.cid)
    return p?.lon ?? null
  }, [followTarget, position, pilots])

  const handleFollowOwn = useCallback(() => {
    setFollowTarget((prev) => prev?.type === 'own' ? null : { type: 'own' })
  }, [])

  const handleFollowVatsim = useCallback((cid: number) => {
    setFollowTarget((prev) =>
      prev?.type === 'vatsim' && prev.cid === cid ? null : { type: 'vatsim', cid }
    )
  }, [])

  const handleCenterOnMe = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    if (lat == null || lon == null) {
      toast.info(t('map.waitingPos'))
      return
    }
    map.flyTo([lat, lon], Math.max(map.getZoom(), LOCATE_ZOOM), { duration: 1.2 })
  }, [lat, lon, t])

  const handleShowOnMap = useCallback((target: RowPilot) => {
    const map = mapRef.current
    if (!map) return

    map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), LOCATE_ZOOM), { duration: 1.2 })

    if (target.isSelf) {
      if (position) {
        setSelectedEntity({ type: 'own', data: position })
        setActiveTab('own')
      }
    } else if (target.cid) {
      const vatsimPilot = pilots.find(p => p.cid === target.cid)
      if (vatsimPilot) {
        setSelectedEntity({ type: 'vatsim', data: vatsimPilot })
        setActiveTab('vatsim')
      }
    }

    setSelectedAirport(null)
  }, [position, pilots])

  const isFollowingOwn = followTarget?.type === 'own'
  const isFollowingVatsimCid = followTarget?.type === 'vatsim' ? followTarget.cid : null

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0d0d12]" ref={containerRef}>
      <style>{VATSIM_CSS}{EXTRA_CSS}</style>

      <div className="absolute inset-0 z-0">
        <MapContainer
          center={initialView?.center ?? center}
          zoom={initialView?.zoom ?? 6}
          minZoom={2}
          maxBounds={WORLD_BOUNDS}
          maxBoundsViscosity={1.0}
          scrollWheelZoom
          preferCanvas
          className="h-full w-full"
          zoomControl={false}
        >
          <MapViewPersistence
            onReady={(m) => {
              mapRef.current = m
              // Mark ready on the next frame so the initial view / tiles
              // have a tick to settle before any locate fly-to runs.
              requestAnimationFrame(() => {
                mapReadyRef.current = true
              })
            }}
          />

          <TileBrightness brightness={settings.brightness} />

          <TileLayer
            url={tileUrl}
            noWrap={false}
            keepBuffer={4}
            updateWhenIdle
            updateWhenZooming={false}
            className="map-tiles"
          />

          <RainRadarLayer show={showWeather} />
          <WindLayer show={showWind} />

          {flightSettings.showSimbriefRoute && ofp && <RouteLayer ofp={ofp} />}

          <FollowAircraft
            lat={followLat}
            lon={followLon}
            shouldFollow={followTarget !== null}
          />

          <VisibleAirports
            pinsEnabled={settings.airportPinsEnabled}
            labelsEnabled={settings.airportLabelsEnabled}
            selectedAirport={selectedAirport}
            onSelect={(apt) => {
              setSelectedAirport(apt)
              setSelectedEntity(null)
              setActiveTab('airport')
              setFollowTarget(null)
            }}
          />

          {flightSettings.vatsimOn && (
            <VatsimLayer
              pilots={pilots}
              labelMode={flightSettings.aircraftLabelsMode}
              iconSize={flightSettings.iconSize}
              showTrails={flightSettings.showTrails}
              onVisibleCountChange={() => {}}
              onSelectPilot={onSelectVatsim}
              selectedCid={activeCid}
            />
          )}

          <OwnAircraftMarker
            labelsMode={flightSettings.aircraftLabelsMode}
            iconSize={flightSettings.iconSize}
            showTrails={flightSettings.showOwnTrail}
            onSelectPilot={onSelectOwn}
            isSelected={selectedEntity?.type === 'own' && !isFollowing}
            flightKey={lastFlightStarted?.timestamp ?? null}
            labelText={profile.flightNumber || undefined}
          />
        </MapContainer>
      </div>

      <SidePanel activeTab={activeTab} onClose={closePanel}>
        {activeTab === 'settings' && (
          <SettingsPanel
            settings={settings}
            onChange={updateMapSetting}
          />
        )}
        {activeTab === 'weather' && (
          <WeatherPanel
            showWeather={showWeather}
            onToggleWeather={setShowWeather}
            showWind={showWind}
            onToggleWind={setShowWind}
          />
        )}
        {activeTab === 'flights' && (
          <FlightsPanel
            settings={flightSettings}
            onChange={(key, val) => setFlightSettings(prev => ({ ...prev, [key]: val }))}
          />
        )}
        {activeTab === 'airport' && selectedAirport && (
          <AirportPanel
            airport={selectedAirport}
            metar={metar}
            metarLoading={metarLoading}
            showMetarDetails={showMetarDetails}
            showStats={showStats}
            onToggleMetar={() => setShowMetarDetails((v) => !v)}
            onToggleStats={() => setShowStats((v) => !v)}
            pilots={pilots}
            vatsimOn={flightSettings.vatsimOn}
            selfPilot={position}
            selfAircraft={aircraftFromFile}
            selfCallsign={selfCallsign}
            selfFlightNumber={profile.flightNumber}
            ofp={ofp}
            onShowOnMap={handleShowOnMap}
          />
        )}
        {activeTab === 'vatsim' && selectedEntity?.type === 'vatsim' && (
          <VatsimPanel
            pilot={selectedEntity.data}
            onFollow={() => handleFollowVatsim(selectedEntity.data.cid)}
            isFollowing={isFollowingVatsimCid === selectedEntity.data.cid}
          />
        )}

        {activeTab === 'own' && (selectedEntity?.type === 'own' || isFollowing) && (
          <OwnAircraftPanel
            pos={selectedEntity?.type === 'own' ? selectedEntity.data : position!}
            ofp={ofp}
            onFollow={handleFollowOwn}
            isFollowing={isFollowingOwn}
          />
        )}
      </SidePanel>

      <BottomBar
        activeTab={activeTab}
        onSelect={(tab) => {
          if (tab !== 'airport') setSelectedAirport(null)
          if (tab !== 'vatsim' && tab !== 'own') { setSelectedEntity(null); setIsFollowing(false); setFollowTarget(null); }
          setActiveTab(tab)
        }}
        onCenterOnMe={handleCenterOnMe}
      />
    </div>
  )
}