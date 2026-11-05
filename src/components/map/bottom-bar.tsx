import { Layers, CloudRain, Plane, Crosshair } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'

export type SidebarTab =
  | 'settings'
  | 'weather'
  | 'flights'
  | 'airport'
  | 'vatsim'
  | 'own'
  | null

export function BottomBar({
  activeTab, onSelect, onCenterOnMe,
}: {
  activeTab: SidebarTab
  onSelect: (tab: SidebarTab) => void
  onCenterOnMe?: () => void
}) {
  const { t } = useLocale()

  const TABS: Array<{
    id: Exclude<SidebarTab, 'airport' | 'vatsim' | 'own' | null>
    label: string
    icon: typeof Layers
  }> = [
    { id: 'settings', label: t('map.sidebarOverlay'),  icon: Layers },
    { id: 'weather',  label: t('map.sidebarWeather'),  icon: CloudRain },
    { id: 'flights',  label: t('map.sidebarFlights'),  icon: Plane },
  ]

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-1 rounded-full bg-background/90 p-1.5 shadow-lg border border-border backdrop-blur-md">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(activeTab === id ? null : id)}
          className={`flex w-20 flex-col items-center justify-center gap-1 rounded-full py-1.5 transition-colors ${
            activeTab === id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Icon className="h-5 w-5" />
          <span className="text-[11px] font-medium leading-none">{label}</span>
        </button>
      ))}

      {/* Divider */}
      <div className="h-8 w-px bg-border mx-1" />

      {/* Center on Me */}
      <button
        type="button"
        onClick={onCenterOnMe}
        className="flex w-20 flex-col items-center justify-center gap-1 rounded-full py-1.5 transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
        title={t('map.tooltipFollow')} // Using a similar key, or you can add a specific "center" tooltip key if you want
      >
        <Crosshair className="h-5 w-5" />
        <span className="text-[11px] font-medium leading-none">{t('map.sidebarCenter')}</span>
      </button>
    </div>
  )
}