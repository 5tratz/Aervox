import { useState } from 'react'
import { AlertTriangle, Check, Copy, Infinity as InfinityIcon, KeyRound, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useLicense } from '@/lib/license-context'
import { useLocale } from '@/lib/locale-context'
import { formatLicenseDate, tierLabelKey, type LicenseStatus } from '@/lib/license'

function StatusBadge({ status }: { status: LicenseStatus | null }) {
  const { t } = useLocale()
  const state = status?.state ?? 'none'

  if (state === 'valid') {
    return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">{t('license.active')}</Badge>
  }
  if (state === 'expired') {
    return <Badge variant="destructive">{t('license.expired')}</Badge>
  }
  if (state === 'tampered') {
    return <Badge variant="destructive">{t('license.tamperedTitle')}</Badge>
  }
  if (state === 'invalid') {
    return <Badge variant="destructive">{t('license.invalid')}</Badge>
  }
  return <Badge variant="outline">{t('license.notActivated')}</Badge>
}

/**
 * License card for the Settings page: subscription, status, dates and the
 * machine ID, plus a hidden-by-default "change key" form.
 */
export function LicenseCard() {
  const { t, language } = useLocale()
  const { status, activate, activating } = useLicense()

  const [changing, setChanging] = useState(false)
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const state = status?.state ?? 'none'
  const isActive = state === 'valid'
  const daysLeft = status?.days_remaining ?? null
  const expiringSoon = isActive && daysLeft !== null && daysLeft <= 14

  const copyMachineId = async () => {
    try {
      await navigator.clipboard.writeText(status?.machine_code ?? '')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('license.copyFailed'))
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = token.trim()
    if (!value || activating) return

    setError(null)

    try {
      const next = await activate(value)
      if (next.state === 'valid') {
        toast.success(t('license.activatedToast'))
        setToken('')
        setChanging(false)
      } else if (next.state === 'expired') {
        setError(t('license.expiredUnknown'))
      } else {
        setError(next.reason ?? t('license.invalidBody'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          {t('license.settingsTitle')}
        </CardTitle>
        <CardDescription>{t('license.settingsDesc')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('license.subscription')}</p>
            <p className="text-sm font-semibold">{t(tierLabelKey(status?.tier))}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('license.status')}</p>
            <div className="flex items-center gap-2">
              <StatusBadge status={status} />
              {expiringSoon && (
                <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                  {t('license.expiringSoon')}
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('license.activated')}</p>
            <p className="text-sm font-medium">
              {formatLicenseDate(status?.activated_at, language)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('license.expires')}</p>
            <p className="text-sm font-medium">
              {status?.expires_at
                ? formatLicenseDate(status.expires_at, language)
                : t('license.never')}
            </p>
          </div>

          {isActive && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('license.daysLeft')}</p>
              <p className="flex items-center gap-1 text-sm font-medium">
                {daysLeft === null ? (
                  <>
                    <InfinityIcon className="h-4 w-4" />
                    {t('license.never')}
                  </>
                ) : (
                  daysLeft
                )}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-muted-foreground">{t('license.machineId')}</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 select-all overflow-x-auto rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs tracking-wider">
              {status?.machine_code ?? '—'}
            </div>
            <Button type="button" variant="outline" size="icon" onClick={() => void copyMachineId()}>
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {(state === 'expired' || state === 'tampered' || state === 'invalid') && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {state === 'tampered'
                ? t('license.tamperedBody')
                : state === 'expired'
                  ? t('license.expiredUnknown')
                  : (status?.reason ?? t('license.invalidBody'))}
            </span>
          </div>
        )}

        {changing ? (
          <form onSubmit={submit} className="space-y-2 rounded-lg border p-3">
            <Label htmlFor="license-change" className="text-muted-foreground">
              {t('license.newKey')}
            </Label>
            <Input
              id="license-change"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={t('license.keyPlaceholder')}
              spellCheck={false}
              autoComplete="off"
              className="font-mono text-xs"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={activating || !token.trim()}>
                {activating ? (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    {t('license.activating')}
                  </>
                ) : (
                  t('license.activate')
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setChanging(false)
                  setToken('')
                  setError(null)
                }}
              >
                {t('license.cancelChange')}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setChanging(true)
              setError(null)
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {t('license.changeKey')}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
