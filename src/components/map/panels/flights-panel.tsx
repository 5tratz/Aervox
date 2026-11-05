import { Plane, Radio, Route, Navigation } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { useLocale } from '@/lib/locale-context'

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
  const { t } = useLocale()

  return (
    <div className="p-4 space-y-6 text-sm text-foreground">

      {/* 1. Live Traffic */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase text-xs tracking-wider flex items-center gap-2">
          <Radio className="h-4 w-4" /> {t('map.flightsLiveTraffic')}
        </h3>
        <p className="text-xs text-muted-foreground">{t('map.flightsLiveTrafficDesc')}</p>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button onClick={() => onChange('vatsimOn', true)} className={`flex-1 py-1.5 text-xs font-semibold ${settings.vatsimOn ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{t('common.on')}</button>
          <button onClick={() => onChange('vatsimOn', false)} className={`flex-1 py-1.5 text-xs font-semibold border-l border-border ${!settings.vatsimOn ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{t('common.off')}</button>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* 2. Aircraft Labels */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase text-xs tracking-wider flex items-center gap-2">
          <Plane className="h-4 w-4" /> {t('map.flightsLabels')}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t('map.flightsLabelsDesc')}
        </p>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button onClick={() => onChange('aircraftLabelsMode', 'off')} className={`flex-1 py-1.5 text-xs font-semibold ${settings.aircraftLabelsMode === 'off' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{t('map.labelsOff')}</button>
          <button onClick={() => onChange('aircraftLabelsMode', 'text')} className={`flex-1 py-1.5 text-xs font-semibold border-l border-border ${settings.aircraftLabelsMode === 'text' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{t('map.labelsText')}</button>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* 3. Aircraft Icon Size */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase text-xs tracking-wider">{t('map.flightsIconSize')}</h3>
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
          <Route className="h-4 w-4" /> {t('map.flightsRoute')}
        </h3>
        <p className="text-xs text-muted-foreground">{t('map.flightsRouteDesc')}</p>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button onClick={() => onChange('showSimbriefRoute', true)} className={`flex-1 py-1.5 text-xs font-semibold ${settings.showSimbriefRoute ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{t('common.on')}</button>
          <button onClick={() => onChange('showSimbriefRoute', false)} className={`flex-1 py-1.5 text-xs font-semibold border-l border-border ${!settings.showSimbriefRoute ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{t('common.off')}</button>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* 5. Flight Trails (VATSIM) */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase text-xs tracking-wider flex items-center gap-2">
          <Route className="h-4 w-4" /> {t('map.flightsTrails')}
        </h3>
        <p className="text-xs text-muted-foreground">{t('map.flightsTrailsDesc')}</p>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button onClick={() => onChange('showTrails', true)} className={`flex-1 py-1.5 text-xs font-semibold ${settings.showTrails ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{t('common.on')}</button>
          <button onClick={() => onChange('showTrails', false)} className={`flex-1 py-1.5 text-xs font-semibold border-l border-border ${!settings.showTrails ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{t('common.off')}</button>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* 6. Own Aircraft Trail */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase text-xs tracking-wider flex items-center gap-2">
          <Navigation className="h-4 w-4" /> {t('map.flightsOwnTrail')}
        </h3>
        <p className="text-xs text-muted-foreground">{t('map.flightsOwnTrailDesc')}</p>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button onClick={() => onChange('showOwnTrail', true)} className={`flex-1 py-1.5 text-xs font-semibold ${settings.showOwnTrail ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{t('common.on')}</button>
          <button onClick={() => onChange('showOwnTrail', false)} className={`flex-1 py-1.5 text-xs font-semibold border-l border-border ${!settings.showOwnTrail ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{t('common.off')}</button>
        </div>
      </div>

    </div>
  )
}