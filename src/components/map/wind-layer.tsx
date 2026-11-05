import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-velocity'

const WIND_DATA_URL = 'https://onaci.github.io/leaflet-velocity/wind-global.json'

export function WindLayer({ show }: { show: boolean }) {
  const map = useMap()
  const layerRef = useRef<any>(null)

  useEffect(() => {
    if (!show) {
      if (layerRef.current && map) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
      return
    }

    let cancelled = false

    fetch(WIND_DATA_URL)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !map) return
        if (layerRef.current) {
          map.removeLayer(layerRef.current)
        }
        const velocityLayer = (L as any).velocityLayer({
          displayValues: true,
          displayOptions: {
            velocityType: 'Global Wind',
            position: 'bottomleft',
            emptyString: 'No wind data',
            angleConvention: 'bearingCW',
            showCardinal: false,
            speedUnit: 'kt',
            directionString: 'Direction',
            speedString: 'Speed',
          },
          data: data,
          minVelocity: 0,
          maxVelocity: 15,
          velocityScale: 0.005,
          colorScale: ['#3288bd', '#66c2a5', '#abdda4', '#e6f598', '#fee08b', '#fdae61', '#f46d43', '#d53e4f'],
          opacity: 0.85,
        })
        velocityLayer.addTo(map)
        layerRef.current = velocityLayer
      })
      .catch((e) => console.warn('Wind data fetch failed:', e))

    return () => {
      cancelled = true
      if (layerRef.current && map) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [show, map])

  return null
}