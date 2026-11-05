import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { AppSidebar } from '@/components/app-sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { LocaleToggle } from '@/components/locale-toggle'
import { AppLoadingScreen } from '@/components/app-loading-screen'
import { DashboardPage } from '@/pages/dashboard'
import { SettingsPage } from '@/pages/settings'
import { FlightPlanPage } from '@/pages/flight-plan'
import { ProfilePage } from '@/pages/profile'
import { LogbookPage } from '@/pages/logbook'
import { FlightDebriefPage } from '@/pages/flight-debrief'
import { ScheduledPage } from '@/pages/scheduled'
import { useLocale } from '@/lib/locale-context'
import { useBackground } from '@/lib/background-context'
import { useSimConnect } from '@/lib/simconnect-context'
import { AcceptedFlightProvider } from '@/lib/accepted-flight-context'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function ConnectionHeartbeat() {
  const { connected } = useSimConnect()

  const detail = connected
    ? 'Connected to Microsoft Flight Simulator'
    : 'Not connected to Microsoft Flight Simulator'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="relative flex h-2.5 w-2.5 cursor-help items-center justify-center">
            {connected && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                connected ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'
              }`}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{detail}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function Shell() {
  const { t } = useLocale()
  const { bgUrl } = useBackground()
  const location = useLocation()
  const isDashboard = location.pathname === '/'

  const [updateInfo, setUpdateInfo] = useState<Update | null>(null)
  const [installing, setInstalling] = useState(false)

  const runUpdateCheck = useCallback(async (silent: boolean) => {
    if (!isTauriRuntime()) {
      if (!silent) toast.error('Updates are only available in the desktop app.')
      return
    }
    try {
      const update = await check()
      if (update) {
        setUpdateInfo(update)
      } else if (!silent) {
        toast.success("You're on the latest version.")
      }
    } catch (err) {
      console.error('Update check failed:', err)
      if (!silent) toast.error('Could not check for updates.')
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runUpdateCheck(true)
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [runUpdateCheck])

  const installUpdate = useCallback(async () => {
    if (!updateInfo) return
    setInstalling(true)
    try {
      await updateInfo.downloadAndInstall()
      // Windows installer takes over and exits; macOS/Linux need a relaunch.
      await relaunch()
    } catch (err) {
      console.error('Update install failed:', err)
      toast.error('Update failed to install. Please try again.')
      setInstalling(false)
    }
  }, [updateInfo])

  const dismissUpdate = useCallback(() => {
    updateInfo?.close()
    setUpdateInfo(null)
  }, [updateInfo])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        
        <header className="relative z-50 flex h-16 shrink-0 items-center justify-end border-b px-6 bg-background">
          <div className="flex items-center gap-2">
            <ConnectionHeartbeat />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => void runUpdateCheck(false)}
                    className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary cursor-pointer border border-primary/20 hover:bg-primary/15 transition-colors"
                  >
                    v{__APP_VERSION__}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-center">
                  <p className="font-semibold">{t('common.version')} {__APP_VERSION__}</p>
                  <p className="text-xs text-muted-foreground">{t('common.stable')}</p>
                  <p className="text-xs text-muted-foreground mt-1">Click to check for updates</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="h-4 w-px bg-border mx-1" />
            <ThemeToggle />
            <LocaleToggle />
          </div>
        </header>

        <main
          className={
            isDashboard
              ? 'relative z-0 flex-1 min-h-0 overflow-hidden'
              : 'relative z-0 flex-1 overflow-y-auto p-6'
          }
          style={
            !isDashboard && bgUrl
              ? {
                  backgroundImage: `url(${bgUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundAttachment: 'fixed',
                  backgroundRepeat: 'no-repeat',
                }
              : undefined
          }
        >
          {!isDashboard && bgUrl && (
            <div
              className="pointer-events-none absolute inset-0 bg-background/70 dark:bg-background/80"
              aria-hidden="true"
            />
          )}
          <div className={isDashboard ? 'h-full' : 'relative z-10'}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/scheduled" element={<ScheduledPage />} />
              <Route path="/flight-plan" element={<FlightPlanPage />} />
              <Route path="/logbook" element={<LogbookPage />} />
              <Route path="/logbook/:id" element={<FlightDebriefPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>

      <Dialog
        open={updateInfo !== null}
        onOpenChange={(open) => {
          if (!open && !installing) dismissUpdate()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.updateAvailable')}</DialogTitle>
            <DialogDescription>
              Aervox {updateInfo?.version} {t('common.readyToInstall')}
              {updateInfo?.body ? (
                <>
                  <br />
                  <span className="block mt-2 text-xs whitespace-pre-line">
                    {updateInfo.body}
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={dismissUpdate} disabled={installing}>
              {t('common.later')}
            </Button>
            <Button onClick={() => void installUpdate()} disabled={installing}>
              {installing ? t('common.installing') : t('common.installNow')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster
        position="bottom-right"
        richColors
        expand
        visibleToasts={4}
        gap={10}
        offset={16}
        duration={5000}
      />
    </div>
  )
}

export default function App() {
  const { ready } = useLocale()

  if (!ready) {
    return <AppLoadingScreen />
  }

  return (
    <BrowserRouter>
      <AcceptedFlightProvider>
        <Shell />
      </AcceptedFlightProvider>
    </BrowserRouter>
  )
}