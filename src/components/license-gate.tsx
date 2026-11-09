import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Copy, KeyRound, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useLicense } from '@/lib/license-context'
import { useLocale } from '@/lib/locale-context'
import { formatLicenseDate, tierLabelKey, type LicenseStatus } from '@/lib/license'

/**
 * Full screen activation wall. Shown from App.tsx whenever the license is not
 * valid, so the rest of the app never renders without one.
 */
export function LicenseGate() {
  const { t, language } = useLocale()
  const { status, activate, activating } = useLicense()

  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const state = status?.state ?? 'none'
  const machineCode = status?.machine_code ?? '—'
  const tierName = t(tierLabelKey(status?.tier))

  // The automatic 7-day trial ends without a key, so it gets its own wording.
  const trialEnded = state === 'expired' && status?.tier === 'trial'

  const heading = trialEnded
    ? t('license.trialEndedTitle')
    : state === 'expired'
      ? t('license.expiredTitle')
      : state === 'tampered'
        ? t('license.tamperedTitle')
        : t('license.title')

  const description = trialEnded
    ? t('license.trialEndedBody', {
        date: formatLicenseDate(status?.expires_at, language),
      })
    : state === 'expired'
      ? status?.expires_at
        ? t('license.expiredBody', {
            tier: tierName,
            date: formatLicenseDate(status.expires_at, language),
          })
        : t('license.expiredUnknown')
      : state === 'tampered'
        ? t('license.tamperedBody')
        : state === 'invalid'
          ? t('license.invalidBody')
          : t('license.subtitle')

  const copyMachineId = async () => {
    try {
      await navigator.clipboard.writeText(machineCode)
      setCopied(true)
      setError(null)
    } catch {
      setError(t('license.copyFailed'))
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = token.trim()
    if (!value || activating) return

    setError(null)

    try {
      const next: LicenseStatus = await activate(value)
      if (next.state === 'expired') {
        setError(t('license.expiredUnknown'))
      } else if (next.state !== 'valid') {
        setError(next.reason ?? t('license.invalidBody'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div className="pointer-events-none absolute left-1/4 top-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-blue-500/20 blur-[120px]" />

      <Card className="relative z-10 w-full max-w-lg border-white/10 bg-background/60 shadow-2xl backdrop-blur-xl">
        <CardHeader className="pb-4 text-center">
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-inner ${
              state === 'expired' || state === 'tampered' || state === 'invalid'
                ? 'border-amber-500/30 bg-amber-500/10'
                : 'border-primary/20 bg-primary/10'
            }`}
          >
            {state === 'expired' || state === 'tampered' || state === 'invalid' ? (
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            ) : (
              <KeyRound className="h-8 w-8 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">{heading}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">{t('license.machineId')}</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 select-all overflow-x-auto rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm tracking-wider">
                {machineCode}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void copyMachineId()}
                title={t('license.machineId')}
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('license.machineHint')}</p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="license-key" className="text-muted-foreground">
                {t('license.keyLabel')}
              </Label>
              <textarea
                id="license-key"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder={t('license.keyPlaceholder')}
                spellCheck={false}
                autoComplete="off"
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background/50 px-3 py-2 font-mono text-xs break-all outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            {error && (
              <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={activating || !token.trim()}>
              {activating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  {t('license.activating')}
                </>
              ) : (
                t('license.activate')
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">{t('license.footer')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
