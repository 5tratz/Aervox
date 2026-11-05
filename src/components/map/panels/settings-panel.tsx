import { Map as MapIcon, Sun } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { MAP_STYLES } from '../map-constants'

export interface MapSettings {
  activeStyle: string
  brightness: number
  airportPinsEnabled: boolean
  airportLabelsEnabled: boolean
}

export function SettingsPanel({
  settings, onChange,
}: {
  settings: MapSettings
  onChange: <K extends keyof MapSettings>(key: K, value: MapSettings[K]) => void
}) {
  return (
    <div className="p-4 space-y-6 text-sm text-foreground">

      {/* Map Style */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase text-xs tracking-wider">Map Style</h3>
        <div className="grid grid-cols-3 gap-2">
          {MAP_STYLES.map((style) => {
            const isActive = settings.activeStyle === style.id
            return (
              <button
                key={style.id}
                onClick={() => onChange('activeStyle', style.id)}
                className="flex flex-col items-center gap-1 group"
              >
                <div
                  className={`relative w-full aspect-square rounded-md overflow-hidden border-2 transition-all ${
                    isActive
                      ? 'border-primary ring-2 ring-primary/30 shadow-md'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {/* Preview image */}
                  <img
                    src={`/map-previews/${style.id}.png`}
                    alt={style.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                    onError={(e) => {
                      const target = e.currentTarget
                      target.style.display = 'none'
                      const fallback = target.nextElementSibling as HTMLElement | null
                      if (fallback) fallback.style.display = 'flex'
                    }}
                  />
                  {/* Fallback icon (hidden until image fails) */}
                  <div
                    className="absolute inset-0 bg-muted/30 items-center justify-center hidden"
                    style={{ display: 'none' }}
                  >
                    <MapIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  {/* Active checkmark */}
                  {isActive && (
                    <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center shadow-sm">
                      <svg viewBox="0 0 24 24" className="h-3 w-3 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
                <span className={`text-[10px] text-center ${isActive ? 'font-semibold text-primary' : ''}`}>
                  {style.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Brightness */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase text-xs tracking-wider">Brightness</h3>
        <div className="flex items-center gap-3">
          <Sun className="h-4 w-4" />
          <Slider value={[settings.brightness]} onValueChange={(v) => onChange('brightness', v[0])} min={20} max={150} step={1} className="flex-1" />
          <Sun className="h-5 w-5" />
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Airport Pins */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase text-xs tracking-wider">Airport Pins</h3>
        <p className="text-xs text-muted-foreground">View the location of airports on the map. Pins appear when zoomed in.</p>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button
            onClick={() => onChange('airportPinsEnabled', true)}
            className={`flex-1 py-1.5 text-xs font-semibold ${settings.airportPinsEnabled ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >On</button>
          <button
            onClick={() => onChange('airportPinsEnabled', false)}
            className={`flex-1 py-1.5 text-xs font-semibold border-l border-border ${!settings.airportPinsEnabled ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >Off</button>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Airport Labels */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase text-xs tracking-wider">Airport Labels</h3>
        <p className="text-xs text-muted-foreground">IATA and ICAO code labels appear next to pins when zoomed in further.</p>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button
            onClick={() => onChange('airportLabelsEnabled', true)}
            className={`flex-1 py-1.5 text-xs font-semibold ${settings.airportLabelsEnabled ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >On</button>
          <button
            onClick={() => onChange('airportLabelsEnabled', false)}
            className={`flex-1 py-1.5 text-xs font-semibold border-l border-border ${!settings.airportLabelsEnabled ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >Off</button>
        </div>
      </div>

    </div>
  )
}