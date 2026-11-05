import { useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Tooltip as LeafletTooltip, useMap } from 'react-leaflet'
import { AIRPORTS, type Airport } from '@/lib/airports'
import { getAirportIcon, createAirportTooltip, createPinLabelTooltip } from './map-constants'

// ── Zoom thresholds ────────────────────────────────────────────────────────
const PIN_MIN_ZOOM = 4
const LABEL_MIN_ZOOM = 7

// ── Importance tiers (higher = more important = shows at lower zoom) ──────
//
// A score is computed per airport from real-world data (IATA presence, size,
// region). Then each zoom level sets a *minimum score* — only airports at or
// above that threshold render. This is what makes majors dominate zoomed-out
// views and pushes local airstrips into high-zoom-only visibility.
//
function importance(a: Airport): number {
  let score = 0
  // Commercial airports (IATA code) are automatically significant
  if (a.iata && a.iata.length === 3) score += 1000
  // Known major-hub regions (Europe / US / Asia hubs)
  if (a.icao.startsWith('EG') || a.icao.startsWith('K') ||
      a.icao.startsWith('L')  || a.icao.startsWith('ED') ||
      a.icao.startsWith('EP') || a.icao.startsWith('EH') ||
      a.icao.startsWith('EF') || a.icao.startsWith('EK') ||
      a.icao.startsWith('Y')  || a.icao.startsWith('Z')  ||
      a.icao.startsWith('RJ') || a.icao.startsWith('RO') ||
      a.icao.startsWith('SB') || a.icao.startsWith('SA')) {
    score += 500
  }
  // Elevation is a rough proxy for runway size / commercial service
  if (a.alt && a.alt > 0) score += 50
  return score
}

// Minimum score required to render at each zoom tier.
// Higher zoom → lower threshold → more airports visible.
function minImportanceForZoom(z: number): number {
  if (z < PIN_MIN_ZOOM) return Infinity        // none
  if (z < 5) return 1500                       // z4       → only mega-hubs
  if (z < 6) return 1200                       // z5       → top internationals
  if (z < 7) return 1000                       // z6       → all commercial (IATA)
  if (z < 8) return 500                        // z7       → regional + commuters
  if (z < 9) return 50                         // z8       → all paved, most airports
  return 0                                     // z9+      → everything incl. airstrips
}

// Hard safety cap to protect rendering perf even at z9+.
function capForZoom(z: number): number {
  if (z < PIN_MIN_ZOOM) return 0
  if (z < 6) return 100
  if (z < 8) return 250
  if (z < 10) return 500
  return 800
}

export function VisibleAirports({
  pinsEnabled, labelsEnabled, selectedAirport, onSelect,
}: {
  pinsEnabled: boolean
  labelsEnabled: boolean
  selectedAirport: Airport | null
  onSelect: (apt: Airport) => void
}) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  const [version, setVersion] = useState(0)
  const [hoveredAirport, setHoveredAirport] = useState<string | null>(null)

  // Pre-sort by importance once — the visibility loop is then a single pass
  // that stops as soon as it has enough, so we never scan the full dataset
  // when a handful of majors would do.
  const sortedRef = useRef<Airport[] | null>(null)
  if (!sortedRef.current) {
    sortedRef.current = [...AIRPORTS].sort((a, b) => importance(b) - importance(a))
  }

  useEffect(() => {
    const updateVisible = () => {
      setZoom(map.getZoom())
      setVersion((v) => v + 1)
      setHoveredAirport(null)
    }
    map.on('moveend', updateVisible)
    map.on('zoomend', updateVisible)

    const clearHover = () => setHoveredAirport(null)
    map.on('mouseout', clearHover)
    map.on('mouseleave', clearHover as any)
    map.on('dragstart', clearHover)

    return () => {
      map.off('moveend', updateVisible)
      map.off('zoomend', updateVisible)
      map.off('mouseout', clearHover)
      map.off('mouseleave', clearHover as any)
      map.off('dragstart', clearHover)
    }
  }, [map])

  const showPins = pinsEnabled && zoom >= PIN_MIN_ZOOM
  const showLabels = labelsEnabled && zoom >= LABEL_MIN_ZOOM

  const visibleAirports = useMemo(() => {
    if (!showPins) return []
    const cap = capForZoom(zoom)
    if (cap === 0) return []

    const minScore = minImportanceForZoom(zoom)
    const bounds = map.getBounds()
    const out: Airport[] = []
    const sorted = sortedRef.current!

    for (let i = 0; i < sorted.length && out.length < cap; i++) {
      const a = sorted[i]
      // Sorted descending by importance → once we drop below the threshold,
      // everything left is less important. Stop early.
      if (importance(a) < minScore) break
      if (bounds.contains([a.lat, a.lon])) out.push(a)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPins, zoom, version, map])

  if (!showPins || visibleAirports.length === 0) return null

  return (
    <>
      {visibleAirports.map((apt) => {
        const isActive = selectedAirport?.icao === apt.icao
        const isHovered = hoveredAirport === apt.icao
        const showFullTooltip = isActive || isHovered
        const showCodeLabel = showLabels && !showFullTooltip

        return (
          <Marker
            key={apt.icao}
            position={[apt.lat, apt.lon]}
            icon={getAirportIcon(isActive || isHovered)}
			eventHandlers={{
			  click: () => onSelect(apt),
			  mouseover: () => setHoveredAirport(apt.icao),
			  mouseout: () => setHoveredAirport((cur) => cur === apt.icao ? null : cur),
			}}
          >
            {showCodeLabel && (
              <LeafletTooltip permanent direction="right" offset={[16, 0]} opacity={1} className="!bg-transparent !border-none !shadow-none !p-0">
                <div dangerouslySetInnerHTML={{ __html: createPinLabelTooltip(apt.iata, apt.icao) }} />
              </LeafletTooltip>
            )}
            {showFullTooltip && (
              <LeafletTooltip permanent direction="right" offset={[16, 0]} opacity={1} className="!bg-transparent !border-none !shadow-none !p-0">
                <div dangerouslySetInnerHTML={{ __html: createAirportTooltip(apt.name, apt.countryCode || 'un', apt.iata, apt.icao) }} />
              </LeafletTooltip>
            )}
          </Marker>
        )
      })}
    </>
  )
}