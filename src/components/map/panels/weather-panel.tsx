import { CloudRain, Wind } from 'lucide-react'

export function WeatherPanel({
  showWeather,
  onToggleWeather,
  showWind,
  onToggleWind,
}: {
  showWeather: boolean
  onToggleWeather: (v: boolean) => void
  showWind: boolean
  onToggleWind: (v: boolean) => void
}) {
  return (
    <div className="p-4 space-y-4">
      
      {/* Rain Radar */}
      <div className="bg-muted/30 rounded border border-border overflow-hidden">
        <div className="p-3">
          <h3 className="font-semibold uppercase text-xs tracking-wider mb-2 flex items-center gap-2">
            <CloudRain className="h-4 w-4" /> Rain Radar
          </h3>
          <div className="flex gap-3">
            <div className={`w-24 h-16 rounded shrink-0 flex items-center justify-center ${showWeather ? 'bg-emerald-500/20' : 'bg-muted'}`}>
              <CloudRain className={`h-6 w-6 ${showWeather ? 'text-emerald-500' : 'text-muted-foreground'}`} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Global rain radar. Overlays live precipitation on the map.
            </p>
          </div>
        </div>
        <div className="flex border-t border-border">
          <button onClick={() => onToggleWeather(true)} className={`flex-1 py-1.5 text-xs font-semibold ${showWeather ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>On</button>
          <button onClick={() => onToggleWeather(false)} className={`flex-1 py-1.5 text-xs font-semibold border-l border-border ${!showWeather ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Off</button>
        </div>
      </div>

      {/* Wind */}
      <div className="bg-muted/30 rounded border border-border overflow-hidden">
        <div className="p-3">
          <h3 className="font-semibold uppercase text-xs tracking-wider mb-2 flex items-center gap-2">
            <Wind className="h-4 w-4" /> Wind
          </h3>
          <div className="flex gap-3">
            <div className={`w-24 h-16 rounded shrink-0 flex items-center justify-center ${showWind ? 'bg-sky-500/20' : 'bg-muted'}`}>
              <Wind className={`h-6 w-6 ${showWind ? 'text-sky-500' : 'text-muted-foreground'}`} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Overlays global wind patterns and speed on the map.
            </p>
          </div>
        </div>
        <div className="flex border-t border-border">
          <button onClick={() => onToggleWind(true)} className={`flex-1 py-1.5 text-xs font-semibold ${showWind ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>On</button>
          <button onClick={() => onToggleWind(false)} className={`flex-1 py-1.5 text-xs font-semibold border-l border-border ${!showWind ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Off</button>
        </div>
      </div>

    </div>
  )
}