import L from 'leaflet'

export const CARTO_KEY = 'cb1_4vpf_1_4075f48d3947d2fe37c5998e'

export const WORLD_BOUNDS: L.LatLngBoundsExpression = [[-85, -180], [85, 180]]

export const MAP_STYLES = [
  { id: 'terrain',   name: 'Terrain',   url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}' },
  { id: 'roadmap',   name: 'Roadmap',   url: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}` },
  { id: 'greyscale', name: 'Greyscale', url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}` },
  { id: 'satellite', name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  { id: 'voyager',   name: 'Voyager',   url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}` },
  { id: 'dark',      name: 'Dark',      url: `https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}` },
] as const

export type MapStyleId = typeof MAP_STYLES[number]['id']

export function planeIcon(heading: number, size = 32) {
  return L.divIcon({
    className: 'plane-marker',
    html: `<div style="transform: rotate(${heading}deg); width:${size}px; height:${size}px; color:#3b82f6;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="${size}" height="${size}">
        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export function getAirportIcon(isActive: boolean) {
  const bgColor = isActive ? '#fbbf24' : '#0ea5e9'
  const iconColor = isActive ? '#0f172a' : '#ffffff'
  return L.divIcon({
    className: 'airport-pin',
    html: `<div class="airport-pin-inner" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${bgColor};border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.4);transition:background-color 0.2s ease;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${iconColor}" width="20" height="20">
        <path d="M20 20h-3v-4h-2v4h-3v-4H9v4H6v-6h14v6zm-2-10H6l-2 4h16l-2-4zM11 8h2v2h-2zM11 4h2v2h-2z"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

export const getFlagSvg = (countryCode: string) =>
  `<img src="https://flagcdn.com/${countryCode.toLowerCase()}.svg" style="width:16px;height:12px;border-radius:2px;display:inline-block;vertical-align:middle;box-shadow:0 0 1px rgba(0,0,0,0.5);" />`

export const createAirportTooltip = (name: string, countryCode: string, iata: string, icao: string) => `
  <div style="background-color:#3b82f6;color:white;padding:6px 12px;border-radius:8px;font-family:sans-serif;font-size:13px;line-height:1.2;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:none;">
    <div style="font-weight:600;margin-bottom:2px;">${name}</div>
    <div style="font-size:11px;color:#dbeafe;display:flex;align-items:center;gap:4px;">
      ${getFlagSvg(countryCode || 'un')} ${iata} / ${icao}
    </div>
  </div>`

export const createPinLabelTooltip = (iata: string, icao: string) => `
  <div style="background-color:#3b82f6;color:white;padding:4px 8px;border-radius:4px;font-family:sans-serif;font-size:11px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:none;">
    ${iata} / ${icao}
  </div>`