import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import type { SidebarTab } from './bottom-bar'

const TITLES: Record<Exclude<SidebarTab, null>, string> = {
  settings: 'Settings',
  weather: 'Weather',
  flights: 'Flights',
  airport: 'Airport Info',
  vatsim: 'Flight Info',
  own: 'My Aircraft',
}

export function SidePanel({
  activeTab,
  onClose,
  children,
}: {
  activeTab: SidebarTab
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      className={`absolute top-0 left-0 bottom-0 z-[999] w-96 bg-background border-r border-border shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${
        activeTab ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex h-14 shrink-0 items-center justify-between bg-muted/50 px-4 border-b border-border">
        <span className="text-lg font-semibold capitalize tracking-wide text-foreground">
          {activeTab ? TITLES[activeTab] : ''}
        </span>
        <button
          onClick={onClose}
          className="rounded-md p-1 hover:bg-muted text-muted-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}