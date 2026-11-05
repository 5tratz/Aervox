import { Layers, CloudRain, Plane, Crosshair } from 'lucide-react'

export type SidebarTab =
  | 'settings'
  | 'weather'
  | 'flights'
  | 'airport'
  | 'vatsim'
  | 'own'
  | null

const TABS: Array<{
  id: Exclude<SidebarTab, 'airport' | 'vatsim' | 'own' | null>
  label: string
  icon: typeof Layers
}> = [
  { id: 'settings', label: 'Overlay',  icon: Layers },
  { id: 'weather',  label: 'Weather',  icon: CloudRain },
  { id: 'flights',  label: 'Flights',  icon: Plane },
]

export function BottomBar({
  activeTab, onSelect, onCenterOnMe,
}: {
  activeTab: SidebarTab
  onSelect: (tab: SidebarTab) => void
  onCenterOnMe?: () => void
}) {
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
        title="Center map on my aircraft"
      >
        <Crosshair className="h-5 w-5" />
        <span className="text-[11px] font-medium leading-none">Center</span>
      </button>
    </div>
  )
}