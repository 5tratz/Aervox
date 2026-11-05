import { PlaneTakeoff, PlaneLanding, ExternalLink, CheckCircle2, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AirlineLogo } from '@/components/map/panels/airport-logo'
import { getAirport } from '@/lib/airports'
import type { LiveFlight } from '@/lib/live-schedule'
import { buildSimbriefUrl } from './simbrief-link'
import { useAcceptedFlight } from '@/lib/accepted-flight-context'
import { useLocale } from '@/lib/locale-context'
import { toast } from 'sonner'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useNavigate } from 'react-router-dom'

function airportLabel(icao: string) {
  const apt = getAirport(icao)
  return apt ? `${apt.name} (${apt.iata || icao})` : icao
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function ScheduledFlightModal({
  route,
  onClose,
}: {
  route: LiveFlight
  onClose: () => void
}) {
  const { t } = useLocale()
  const { accept, accepted } = useAcceptedFlight()
  const navigate = useNavigate()
  const isAlreadyAccepted = accepted?.id === route.id
  
  // Check if the flight has already left
  const isDeparted = route.status === 'departed'

  const handleSimbrief = async () => {
    if (isDeparted) return
    try {
      await openUrl(buildSimbriefUrl(route))
      toast.success(t('scheduled.simbriefOpened'))
    } catch (e) {
      toast.error(`${t('scheduled.browserError')} ${e}`)
    }
  }

  const handleAccept = async () => {
    if (isDeparted) return
    await accept(route)
    toast.success(`${t('scheduled.acceptedToast')} ${route.flightNumber} — ${route.departure} → ${route.arrival}`)
    onClose()
    navigate('/flight-plan')
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#2d2d2d] p-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <AirlineLogo code={route.airlineCode} name={route.airline} />
            <div className="min-w-0">
              <div className="text-lg font-bold text-[#fbbf24] font-mono">{route.flightNumber}</div>
              <div className="text-xs text-gray-300 truncate">{route.airline}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 text-center">
              <div className="text-3xl font-bold font-mono">{route.departure}</div>
              <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{airportLabel(route.departure)}</div>
            </div>
            <div className="flex flex-col items-center px-2">
              <PlaneTakeoff className="h-3 w-3 text-emerald-500" />
              <div className="w-16 h-px bg-border my-1" />
              <PlaneLanding className="h-3 w-3 text-red-500" />
            </div>
            <div className="flex-1 text-center">
              <div className="text-3xl font-bold font-mono">{route.arrival}</div>
              <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{airportLabel(route.arrival)}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-muted/50 border border-border rounded-md p-2 text-center">
              <div className="text-[9px] uppercase text-muted-foreground tracking-wider">{t('scheduled.modalAircraft')}</div>
              <div className="font-mono font-semibold mt-0.5">{route.aircraft}</div>
            </div>
            <div className="bg-muted/50 border border-border rounded-md p-2 text-center">
              <div className="text-[9px] uppercase text-muted-foreground tracking-wider">{t('scheduled.modalDeparts')}</div>
              <div className="font-mono font-semibold mt-0.5">{route.departureTime}</div>
            </div>
            <div className="bg-muted/50 border border-border rounded-md p-2 text-center">
              <div className="text-[9px] uppercase text-muted-foreground tracking-wider">{t('scheduled.modalDuration')}</div>
              <div className="font-mono font-semibold mt-0.5">{formatDuration(route.durationMin)}</div>
            </div>
          </div>

          {isDeparted && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-md p-3 flex items-start gap-3 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>{t('scheduled.modalDepartedWarning')}</p>
            </div>
          )}

          <div className="space-y-2">
            <Button 
              onClick={handleSimbrief} 
              className="w-full gap-2" 
              size="lg"
              disabled={isDeparted}
            >
              <ExternalLink className="h-4 w-4" />
              {t('scheduled.fetchSimbrief')}
            </Button>
            <Button
              onClick={handleAccept}
              variant={isAlreadyAccepted ? 'secondary' : 'outline'}
              className="w-full gap-2"
              disabled={isAlreadyAccepted || isDeparted}
            >
              <CheckCircle2 className="h-4 w-4" />
              {isAlreadyAccepted ? t('scheduled.alreadyAccepted') : t('scheduled.acceptFlight')}
            </Button>
            {!isDeparted && (
              <p className="text-[10px] text-muted-foreground text-center pt-1 leading-relaxed">
                {t('scheduled.acceptHint')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}