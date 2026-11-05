import { Plane, Radio, Route, Navigation } from 'lucide-react'
import { Slider } from '@/components/ui/slider'

export interface FlightSettings {
  vatsimOn: boolean
  aircraftLabelsMode: 'off' | 'text'
  iconSize: number
  showSimbriefRoute: boolean
  showTrails: boolean
  showOwnTrail: boolean
}

export function FlightsPanel({
  settings, onChange,
}: {
  settings: FlightSettings
  onChange: <K extends keyof FlightSettings>(key: K, value: FlightSettings[K]) => void
}) {
  return (
    <div className="p-4 space-y-6 text-sm text-foreground">

      {/* 1. Live Traffic */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase text-xs tracking-wider flex items-center gap-2">
          <Radio className="h-4 w-4" /> Live Traffic
        </h3>
        <p className="text-xs text-muted-foreground">Show live pilots from the VATSIM network on the map.</p>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button onClick={() => onChange('vatsimOn', true)} className={`flex-1 py-1.5 text-xs font-semibold ${settings.vatsimOn ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>On</button>
          <button onClick={() => onChange('vatsimOn', false)} className={`flex-1 py-1.5 text-xs font-semibold border-l border-border ${!settings.vatsimOn ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Off</button>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* 2. Aircraft Labels */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase text-xs tracking-wider flex items-center gap-2">
          <Plane className="h-4 w-4" /> Aircraft Labels
        </h3>
        <p className="text-xs text-muted-foreground">
          Aircraft labels are shown when fewer than 250 aircraft are visible. Zoom in further if you don't see them.
        </p>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button onClick={() => onChange('aircraftLabelsMode', 'off')} className={`flex-1 py-1.5 text-xs font-semibold ${settings.aircraftLabelsMode === 'off' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Off</button>
          <button onClick={() => onChange('aircraftLabelsMode', 'text')} className={`flex-1 py-1.5 text-xs font-semibold border-l border-border ${settings.aircraftLabelsMode === 'text' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Text</button>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* 3. Aircraft Icon Size */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase text-xs tracking-wider">Aircraft Icon Size</h3>
        <div className="flex items-center gap-3">
          <Plane className="h-3 w-3 text-muted-foreground" />
          <Slider value={[settings.iconSize]} onValueChange={(v) => onChange('iconSize', v[0])} min={20} max={50} step={1} className="flex-1" />
          <Plane className="h-5 w-5 text-foreground" />
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* 4. SimBrief Route Line */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase text-xs tracking-wider flex items-center gap-2">
          <Route className="h-4 w-4" /> SimBrief Route Line
        </h3>
        <p className="text-xs text-muted-foreground">Show a dashed route line from departure to arrival on the map.</p>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button onClick={() => onChange('showSimbriefRoute', true)} className={`flex-1 py-1.5 text-xs font-semibold ${settings.showSimbriefRoute ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>On</button>
          <button onClick={() => onChange('showSimbriefRoute', false)} className={`flex-1 py-1.5 text-xs font-semibold border-l border-border ${!settings.showSimbriefRoute ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Off</button>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* 5. Flight Trails (VATSIM) */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase text-xs tracking-wider flex items-center gap-2">
          <Route className="h-4 w-4" /> Flight Trails
        </h3>
        <p className="text-xs text-muted-foreground">Show a colored trail behind VATSIM aircraft indicating their recent path.</p>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button onClick={() => onChange('showTrails', true)} className={`flex-1 py-1.5 text-xs font-semibold ${settings.showTrails ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>On</button>
          <button onClick={() => onChange('showTrails', false)} className={`flex-1 py-1.5 text-xs font-semibold border-l border-border ${!settings.showTrails ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Off</button>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* 6. Own Aircraft Trail */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase text-xs tracking-wider flex items-center gap-2">
          <Navigation className="h-4 w-4" /> Own Aircraft Trail
        </h3>
        <p className="text-xs text-muted-foreground">Show the altitude-colored trail behind your aircraft.</p>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button onClick={() => onChange('showOwnTrail', true)} className={`flex-1 py-1.5 text-xs font-semibold ${settings.showOwnTrail ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>On</button>
          <button onClick={() => onChange('showOwnTrail', false)} className={`flex-1 py-1.5 text-xs font-semibold border-l border-border ${!settings.showOwnTrail ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Off</button>
        </div>
      </div>

    </div>
  )
}