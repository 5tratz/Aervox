import { useEffect, useState } from 'react'
import {
  Plane,
  LayoutDashboard,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Map,
  User,
  BookOpen,
  SlidersHorizontal,
  Calendar,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useLocale } from '@/lib/locale-context'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const STORAGE_KEY = 'sidebar:collapsed'

export function AppSidebar() {
  const { t } = useLocale()
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY) === '1'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  // Nav structure: items can be links (with `to`) or category headers (without `to`)
  const nav = [
    { label: t('nav.dashboard'), to: '/', icon: LayoutDashboard },
    { label: 'Flights', icon: Map, isHeader: true },
    { label: 'Schedules', to: '/scheduled', icon: Calendar, isChild: true },
    { label: 'Flight Plan', to: '/flight-plan', icon: Map, isChild: true },
    { label: 'Logbook', to: '/logbook', icon: BookOpen, isChild: true },
    { label: 'Profile', icon: User, isHeader: true },
    { label: 'Options', to: '/profile', icon: SlidersHorizontal, isChild: true },
  ]

  const bottom = [
    { label: t('nav.settings'), to: '/settings', icon: Settings },
  ]

  const NavItem = ({
    to,
    end,
    icon: Icon,
    label,
    isHeader,
    isChild,
  }: {
    to?: string
    end?: boolean
    icon: React.ComponentType<{ className?: string }>
    label: string
    isHeader?: boolean
    isChild?: boolean
  }) => {
    // If it's a header, render a non-clickable section title
    if (isHeader) {
      if (collapsed) return null // Hide headers when collapsed
      return (
        <div className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 select-none">
          {label}
        </div>
      )
    }

    const content = ({ isActive }: { isActive: boolean }) => (
      <div
        className={cn(
          'group relative flex items-center rounded-lg h-9 transition-all duration-150',
          collapsed ? 'w-9 justify-center mx-auto' : 'w-full px-3 gap-3',
          isChild && !collapsed && 'pl-9', // Indent child items
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
      >
        {isActive && collapsed && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-primary" />
        )}
        <Icon className={cn("shrink-0", isChild ? "h-4 w-4" : "h-[18px] w-[18px]")} />
        {!collapsed && (
          <span className={cn("truncate text-[13px]", isChild ? "font-normal" : "font-medium")}>
            {label}
          </span>
        )}
      </div>
    )

    const link = (
      <NavLink to={to!} end={end}>
        {({ isActive }) => content({ isActive })}
      </NavLink>
    )

    if (!collapsed) return link

    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>
            <span className="font-medium">{label}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <aside
      className={cn(
        'hidden md:flex md:flex-col shrink-0 bg-background transition-all duration-200 ease-in-out border-r border-border',
        collapsed ? 'w-[60px]' : 'w-56',
      )}
    >
      <div
        className={cn(
          'relative flex h-16 items-center shrink-0',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src="/aervox-logo.png"
                  alt="Aervox"
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement
                    target.style.display = 'none'
                    target.parentElement?.querySelector('.logo-fallback')?.classList.remove('hidden')
                  }}
                />
                <Plane className="logo-fallback hidden h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex flex-col min-w-0 flex-1 text-left justify-center">
                <span className="text-lg font-bold tracking-tight leading-tight truncate">
                  Aervox
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(true)}
              className="shrink-0 h-8 w-8 text-muted-foreground/70 hover:text-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(false)}
            className="h-10 w-10 text-muted-foreground/70 hover:text-foreground"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </Button>
        )}
        
        <div className="absolute bottom-0 left-0 right-0 h-px bg-border/60 -mr-px" />
      </div>

      <nav className={cn(
        'flex-1 flex flex-col gap-1 overflow-y-auto',
        collapsed ? 'py-3 px-1.5' : 'py-3 px-2',
      )}>
        {nav.map((item, index) => (
          <NavItem
            key={item.to || `header-${index}`}
            to={item.to}
            end={item.to === '/'}
            icon={item.icon}
            label={item.label}
            isHeader={item.isHeader}
            isChild={item.isChild}
          />
        ))}
      </nav>

      <div className={cn(
        'relative flex flex-col gap-1 shrink-0',
        collapsed ? 'py-3 px-1.5' : 'p-2',
      )}>
        <div className="absolute top-0 left-0 right-0 h-px bg-border/60 -mr-px" />

        {bottom.map((item) => (
          <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} />
        ))}

        {collapsed ? (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {}}
                  className="group flex h-9 w-9 mx-auto items-center justify-center rounded-lg text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12}>
                <span className="font-medium">{t('nav.signout')}</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <button
            onClick={() => {}}
            className="flex w-full h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          >
            <LogOut className="h-[18px] w-[18px]" />
            {t('nav.signout')}
          </button>
        )}
      </div>
    </aside>
  )
}