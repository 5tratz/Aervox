import { useEffect, useState } from 'react'
import { TileLayer } from 'react-leaflet'

export function RainRadarLayer({ show }: { show: boolean }) {
  const [frame, setFrame] = useState<{ host: string; path: string } | null>(null)
  useEffect(() => {
    if (!show) return
    let cancelled = false
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const past = data?.radar?.past
        if (!past?.length) return
        setFrame({ host: data.host, path: past[past.length - 1].path })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [show])
  if (!show || !frame) return null
  return <TileLayer url={`${frame.host}${frame.path}/512/{z}/{x}/{y}/2/1_0.png`} opacity={0.55} maxZoom={7} />
}