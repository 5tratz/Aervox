import { useEffect, useMemo, useRef, useState } from 'react'
import { useMap, Polyline } from 'react-leaflet'
import L from 'leaflet'
import type { VatsimPilot } from './use-vatsim-traffic'

interface Props {
  pilots: VatsimPilot[]
  labelMode: 'off' | 'text'
  iconSize: number
  showTrails: boolean
  onVisibleCountChange: (count: number) => void
  onSelectPilot: (p: VatsimPilot) => void
  selectedCid?: number | null
}

const HEADING_BUCKET = 10
const ICON_CACHE_MAX = 64
const LABEL_DENSITY_LIMIT = 250

function makeIcon(heading: number, size: number, isActive: boolean) {
  const color = isActive ? '#ef4444' : '#eab308'
  return L.divIcon({
    className: 'vatsim-plane',
    html: `<div style="transform:rotate(${heading}deg);width:${size}px;height:${size}px;color:${color};">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="${size}" height="${size}">
        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export function VatsimLayer({
  pilots, labelMode, iconSize, showTrails, onVisibleCountChange, onSelectPilot, selectedCid
}: Props) {
  const map = useMap()
  const markersRef = useRef<Map<number, L.Marker>>(new Map())
  const iconsRef = useRef<Map<string, L.DivIcon>>(new Map())
  const [hoveredCid, setHoveredCid] = useState<number | null>(null)
  const [viewport, setViewport] = useState({ bounds: map.getBounds(), zoom: map.getZoom() })

  useEffect(() => {
    const onChange = () => {
      setViewport({ bounds: map.getBounds(), zoom: map.getZoom() })
    }
    map.on('zoomend', onChange)
    map.on('moveend', onChange)

    const clearHover = () => setHoveredCid(null)
    map.on('mouseout', clearHover)
    map.on('mouseleave', clearHover as any)
    map.on('dragstart', clearHover)

    return () => {
      map.off('zoomend', onChange)
      map.off('moveend', onChange)
      map.off('mouseout', clearHover)
      map.off('mouseleave', clearHover as any)
      map.off('dragstart', clearHover)
    }
  }, [map])

  const visible = useMemo(() => {
    // No zoom cap. Just get everything inside the current viewport bounds.
    const inView: VatsimPilot[] = []
    for (const p of pilots) {
      if (viewport.bounds.contains([p.lat, p.lon])) {
        inView.push(p)
      }
    }
    return inView
  }, [pilots, viewport])

  useEffect(() => {
    onVisibleCountChange(visible.length)
  }, [visible.length, onVisibleCountChange])

  const showLabels = labelMode === 'text' && visible.length <= LABEL_DENSITY_LIMIT

  useEffect(() => {
    const group = L.layerGroup().addTo(map)
    markersRef.current.forEach(m => m.remove())
    markersRef.current.clear()

    for (const p of visible) {
      const isActive = hoveredCid === p.cid || selectedCid === p.cid
      const bucket = Math.round(p.heading / HEADING_BUCKET) * HEADING_BUCKET
      const key = `${bucket}-${iconSize}-${isActive}`

      let icon = iconsRef.current.get(key)
      if (!icon) {
        icon = makeIcon(bucket, iconSize, isActive)
        if (iconsRef.current.size >= ICON_CACHE_MAX) iconsRef.current.clear()
        iconsRef.current.set(key, icon)
      }

      const marker = L.marker([p.lat, p.lon], { icon, zIndexOffset: isActive ? 1000 : 0 })

      marker.on('mouseover', () => setHoveredCid(p.cid))
      marker.on('mouseout', () => setHoveredCid((cur) => cur === p.cid ? null : cur))
      marker.on('pointerout', () => setHoveredCid((cur) => cur === p.cid ? null : cur))
      marker.on('click', () => onSelectPilot(p))

      if (isActive || showLabels) {
        marker.bindTooltip(p.callsign, {
          permanent: true, direction: 'right', offset: [iconSize / 2 + 2, 0], className: 'f24-hover-tooltip'
        })
      }

      marker.addTo(group)
      markersRef.current.set(p.cid, marker)
    }

    return () => { group.remove() }
  }, [visible, labelMode, iconSize, hoveredCid, selectedCid, map, onSelectPilot, showLabels])

  return (
    <>
      {showTrails && visible.map(p => {
        // Trail needs at least 2 points to draw a line
        if (!p.track || p.track.length < 2) return null

        // Ensure the current position is always the last point
        const positions: [number, number][] = [
          ...p.track,
          [p.lat, p.lon],
        ]

        const isSelected = selectedCid === p.cid
        return (
          <Polyline
            key={`trail-${p.cid}`}
            positions={positions}
            pathOptions={{
              color: isSelected ? '#a855f7' : '#22c55e',
              weight: isSelected ? 3 : 2,
              opacity: isSelected ? 1 : 0.8,
              dashArray: isSelected ? '8, 8' : '4, 6'
            }}
          />
        )
      })}
    </>
  )
}