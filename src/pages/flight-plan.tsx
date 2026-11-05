import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Plane, RefreshCw, Download, ExternalLink, AlertTriangle, MapPin, Trash2 } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from 'next-themes'
import { getAirport } from '@/lib/airports'
import { formatOFPText, extractRouteWaypoints } from '@/lib/simbrief'
import { useSimbrief } from '@/lib/simbrief-context'
import { usePilot } from '@/lib/pilot-context'
import { useAcceptedFlight } from '@/lib/accepted-flight-context'
import { useLocale } from '@/lib/locale-context'

import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { toast } from 'sonner'
import { jsPDF } from 'jspdf'

const CARTO_KEY = 'cb1_4vpf_1_4075f48d3947d2fe37c5998e'
const TILES = {
  light: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
  dark: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
}

const PLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`

function airportDot(kind: 'origin' | 'destination' | 'alternate' | 'waypoint') {
  const color = kind === 'origin' ? '#10b981' : kind === 'destination' ? '#ef4444' : kind === 'alternate' ? '#f59e0b' : '#64748b'
  return L.divIcon({
    className: `flight-plan-${kind}-marker`,
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function planeMarker() {
  return L.divIcon({
    className: 'flight-plan-plane',
    html: `<div style="color:#0ea5e9;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));width:28px;height:28px;">${PLANE_SVG}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function coordsOf(icao?: string): [number, number] | null {
  if (!icao) return null
  const apt = getAirport(icao)
  return apt ? [apt.lat, apt.lon] : null
}

function MapBounds({ routePath, alternateCoords }: { routePath: [number, number][]; alternateCoords: [number, number] | null }) {
  const map = useMap()

  const routeString = JSON.stringify(routePath)
  const alternateString = JSON.stringify(alternateCoords)

  useMemo(() => {
    const points = [...routePath]
    if (alternateCoords) points.push(alternateCoords)

    if (points.length > 0) {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 })
    }
  }, [map, routeString, alternateString])

  return null
}

function openSimbriefDispatch() {
  const url = 'https://dispatch.simbrief.com'
  import('@tauri-apps/plugin-opener')
    .then(({ openUrl }) => openUrl(url))
    .catch(() => window.open(url, '_blank'))
}

function ErrorMessage({ message }: { message: string }) {
  const marker = 'dispatch.simbrief.com'
  const idx = message.indexOf(marker)
  if (idx === -1) {
    return <p className="text-sm">{message}</p>
  }
  const before = message.slice(0, idx)
  const after = message.slice(idx + marker.length)
  return (
    <p className="text-sm">
      {before}
      <button
        type="button"
        onClick={openSimbriefDispatch}
        className="underline underline-offset-2 hover:text-foreground font-medium"
      >
        {marker}
      </button>
      {after}
    </p>
  )
}

export function FlightPlanPage() {
  const navigate = useNavigate()
  const { t } = useLocale()
  const { theme } = useTheme()
  const { ofp, loading, error, pilotId, refresh, clear: clearOFP } = useSimbrief()
  const { pilot } = usePilot()
  const { accepted, clear: clearAccepted } = useAcceptedFlight()

  const [lastUpdated, setLastUpdated] = useState<Date | null>(ofp ? new Date() : null)

  const handleFetch = async () => {
    await refresh()
    setLastUpdated(new Date())
  }

  const handleClearAll = async () => {
    await clearAccepted()
    clearOFP()
    toast.success(t('plan.planCleared'))
  }

  const ofpText = useMemo(() => (ofp ? formatOFPText(ofp) : ''), [ofp])

  const waypoints = useMemo(() => {
    if (!ofp) return []
    return extractRouteWaypoints(ofp)
  }, [ofp])

  const routePath = useMemo<[number, number][]>(() => {
    const path: [number, number][] = []
    
    const originCoords = coordsOf(ofp?.origin?.icao_code)
    if (originCoords) path.push(originCoords)

    waypoints.forEach(wp => {
      path.push([wp.lat, wp.lon])
    })

    const destCoords = coordsOf(ofp?.destination?.icao_code)
    if (destCoords) path.push(destCoords)

    return path
  }, [ofp, waypoints])

  const handleOpenExternal = () => {
    openSimbriefDispatch()
  }

  const handleSavePdf = async () => {
    if (!ofpText) return

    try {
      const filePath = await save({
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
        defaultPath: `${pilot.callsign || 'PILOT'}-${ofp?.origin?.icao_code ?? 'OFP'}-${ofp?.destination?.icao_code ?? 'OFP'}.pdf`,
      })

      if (filePath) {
        const doc = new jsPDF()
        doc.setFont('courier', 'normal')
        doc.setFontSize(10)

        const lines = doc.splitTextToSize(ofpText, 180)
        doc.text(lines, 15, 20)

        const pdfBytes = doc.output('arraybuffer')
        await writeFile(filePath, new Uint8Array(pdfBytes))

        toast.success(t('plan.savedPdf'))
      }
    } catch (err) {
      console.error('Failed to save PDF:', err)
      toast.error(t('plan.saveFailed'))
    }
  }

  const tileUrl = theme === 'dark' ? TILES.dark : TILES.light
  const originCoords = coordsOf(ofp?.origin?.icao_code)
  const destinationCoords = coordsOf(ofp?.destination?.icao_code)
  const alternateCoords = coordsOf(ofp?.alternate?.icao_code)

  const ofpMatchesAccepted =
    accepted &&
    ofp &&
    ofp.origin?.icao_code === accepted.departure &&
    ofp.destination?.icao_code === accepted.arrival

  useEffect(() => {
    if (ofpMatchesAccepted && accepted) {
      const timer = setTimeout(() => {
        clearAccepted()
        toast.success(`${accepted.flightNumber} ${t('plan.clearedToast')}`)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [ofpMatchesAccepted, accepted, clearAccepted])

  return (
    <div className="h-full flex flex-col space-y-4 pb-4">

      <div className="flex items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Plane className="h-6 w-6 text-primary" /> {t('plan.title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('plan.desc')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground font-mono hidden sm:inline-block mr-2">
              {t('plan.updated')} {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button
            size="default"
            onClick={handleFetch}
            disabled={loading || !pilotId}
            title={!pilotId ? t('plan.missingId') : undefined}
            className="shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? t('plan.fetching') : t('plan.fetchOfp')}
          </Button>
          <Button
            variant="destructive"
            size="default"
            onClick={handleClearAll}
            disabled={!ofp}
            title={t('plan.planCleared')}
            className="shadow-sm"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('plan.clear')}
          </Button>
        </div>
      </div>

      {accepted && (
        <Card
          className={
            ofpMatchesAccepted
              ? 'border-emerald-500/40 bg-emerald-500/5 shadow-sm shrink-0'
              : 'border-primary/40 bg-primary/5 shadow-sm shrink-0'
          }
        >
          <CardContent className="flex items-center justify-between py-4 text-sm gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Plane
                className={`h-5 w-5 shrink-0 ${
                  ofpMatchesAccepted ? 'text-emerald-500' : 'text-primary'
                }`}
              />
              <div className="min-w-0">
                <div className="font-medium">
                  {ofpMatchesAccepted
                    ? `✓ ${t('plan.matchesAccepted')} ${accepted.flightNumber}`
                    : `${t('plan.accepted')} ${accepted.flightNumber} (${accepted.departure} → ${accepted.arrival})`}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {ofpMatchesAccepted
                    ? t('plan.everythingSync')
                    : t('plan.syncPrompt')}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAccepted}
              className="shrink-0"
            >
              {t('common.clear')}
            </Button>
          </CardContent>
        </Card>
      )}

      {!pilotId && (
        <Card className="border-amber-500/40 bg-amber-500/5 shadow-sm shrink-0">
          <CardContent className="flex items-center justify-between py-4 text-sm">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{t('plan.missingId')}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/profile')}>
              {t('plan.goToProfile')}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-500/40 bg-red-500/5 shadow-sm shrink-0">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold text-red-600 dark:text-red-400">{t('plan.loadError')}</p>
              <ErrorMessage message={error} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(500px,1fr)_minmax(500px,1fr)] gap-6 min-h-0 pb-4">

        <Card className="flex flex-col shadow-md border-border/60 h-full min-h-0">
          <CardHeader className="pb-4 border-b bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold uppercase tracking-wider text-muted-foreground">
                {t('plan.ofpSummary')}
              </CardTitle>
              {ofp && (
                <div className="flex items-center gap-2 text-xs font-mono bg-background border px-2 py-1 rounded-md shadow-sm">
                  <span className="font-bold text-foreground">{ofp.origin?.icao_code || '???'}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-bold text-foreground">{ofp.destination?.icao_code || '???'}</span>
                </div>
              )}
            </div>
            <CardDescription className="mt-2 flex items-center gap-2 text-sm">
              {ofp ? (
                <>
                  <span className="font-medium text-foreground">{ofp.aircraft?.name || t('common.unknown')}</span>
                  {ofp.aircraft?.reg && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{ofp.aircraft.reg}</span>
                    </>
                  )}
                </>
              ) : (
                t('plan.noPlan')
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 p-0 bg-card overflow-hidden min-h-0">
            {ofp ? (
              <pre className="h-full overflow-auto px-5 py-4 font-mono text-[12px] leading-relaxed whitespace-pre text-foreground">
                {ofpText}
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground space-y-3 min-h-[400px]">
                <Plane className="h-10 w-10 opacity-20" />
                <p>{loading ? t('plan.fetching') : pilotId ? t('plan.clickFetch') : t('plan.setIdFirst')}</p>
              </div>
            )}
          </CardContent>

          <Separator />

          <CardContent className="flex gap-3 p-4 bg-muted/10 shrink-0">
            <Button
              variant="default"
              className="flex-1 shadow-sm"
              onClick={handleFetch}
              disabled={loading || !pilotId}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('plan.fetch')}
            </Button>
            <Button
              variant="secondary"
              className="flex-1 shadow-sm"
              onClick={handleOpenExternal}
              disabled={!pilotId}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('plan.openWeb')}
            </Button>
            <Button
              variant="secondary"
              className="flex-1 shadow-sm"
              onClick={handleSavePdf}
              disabled={!ofp}
            >
              <Download className="h-4 w-4 mr-2" />
              {t('plan.savePdf')}
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden shadow-md border-border/60 flex flex-col h-full min-h-0">
          <CardHeader className="pb-4 border-b bg-muted/20 shrink-0">
            <CardTitle className="text-base font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" /> {t('plan.routeMap')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 relative min-h-0">
            <MapContainer
              center={[40, -95]}
              zoom={3}
              minZoom={2}
              maxBounds={[[-90, -180], [90, 180]]}
              maxBoundsViscosity={1.0}
              style={{ height: '100%', width: '100%', minHeight: '400px' }}
              zoomControl={false}
              scrollWheelZoom={true}
            >
              <TileLayer url={tileUrl} attribution='&copy; OpenStreetMap &copy; CARTO' />

              <MapBounds routePath={routePath} alternateCoords={alternateCoords} />

              {routePath.length > 1 && (
                <Polyline
                  positions={routePath}
                  pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.8, lineCap: 'round' }}
                />
              )}

              {waypoints.map((wp, index) => (
                <CircleMarker
                  key={`${wp.ident}-${index}`}
                  center={[wp.lat, wp.lon]}
                  radius={3}
                  pathOptions={{ fillColor: '#94a3b8', fillOpacity: 1, color: '#fff', weight: 1 }}
                >
                  <Tooltip direction="top" offset={[0, -5]} opacity={1} className="bg-background text-foreground border shadow-md font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    {wp.ident}
                  </Tooltip>
                </CircleMarker>
              ))}

              {originCoords && (
                <Marker position={originCoords} icon={airportDot('origin')}>
                  <Tooltip permanent direction="top" offset={[0, -10]} opacity={1} className="bg-background text-foreground border shadow-md font-mono text-xs font-bold px-2 py-1 rounded-md">
                    {ofp?.origin?.icao_code}
                  </Tooltip>
                </Marker>
              )}

              {destinationCoords && (
                <Marker position={destinationCoords} icon={airportDot('destination')}>
                  <Tooltip permanent direction="top" offset={[0, -10]} opacity={1} className="bg-background text-foreground border shadow-md font-mono text-xs font-bold px-2 py-1 rounded-md">
                    {ofp?.destination?.icao_code}
                  </Tooltip>
                </Marker>
              )}

              {alternateCoords && (
                <Marker position={alternateCoords} icon={airportDot('alternate')}>
                  <Tooltip direction="top" offset={[0, -8]} opacity={1} className="bg-background text-foreground border shadow-md font-mono text-xs font-semibold px-2 py-1 rounded-md">
                    {ofp?.alternate?.icao_code}
                  </Tooltip>
                </Marker>
              )}

              {ofp && (ofp as any).position?.pos_lat && (ofp as any).position?.pos_long && (
                <Marker
                  position={[
                    parseFloat((ofp as any).position.pos_lat),
                    parseFloat((ofp as any).position.pos_long),
                  ]}
                  icon={planeMarker()}
                />
              )}
            </MapContainer>

            <div className="absolute bottom-4 left-4 z-[400] bg-background/90 backdrop-blur-sm border shadow-sm rounded-md px-3 py-2 flex flex-col gap-1.5 text-xs font-medium">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white shadow-sm" />
                <span>{t('plan.origin')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white shadow-sm" />
                <span>{t('plan.destination')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white shadow-sm" />
                <span>{t('plan.alternate')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}