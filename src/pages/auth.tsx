import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plane, Mail, Lock, User as UserIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { usePilot } from '@/lib/pilot-context'
import { useLocale } from '@/lib/locale-context'
import { toast } from 'sonner'

export function AuthPage() {
  const navigate = useNavigate()
  const { t } = useLocale()
  const { login, register } = usePilot()
  
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, displayName.trim() || email.split('@')[0])
      }
      navigate('/')
    } catch (err: any) {
      if (err.message.includes('Invalid email')) toast.error(t('auth.invalidCredentials'))
      else if (err.message.includes('already exists')) toast.error(t('auth.emailInUse'))
      else toast.error(err.message || 'An error occurred')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-6 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-blue-500/20 blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-md relative z-10 border-white/10 bg-background/60 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center pb-6">
          
          {/* --- LOGO START --- */}
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-inner overflow-hidden p-2">
            <img
              src="/aervox-logo.png"
              alt="Aervox"
              className="h-full w-full object-contain"
              onError={(e) => {
                // If the image fails to load, hide it and show the fallback plane icon
                const target = e.currentTarget as HTMLImageElement
                target.style.display = 'none'
                target.parentElement?.querySelector('.logo-fallback')?.classList.remove('hidden')
              }}
            />
            <Plane className="logo-fallback hidden h-10 w-10 text-primary" />
          </div>
          {/* --- LOGO END --- */}

          <CardTitle className="text-2xl font-bold tracking-tight">
            {mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
          </CardTitle>
          <CardDescription>
            {mode === 'login' ? t('auth.loginDesc') : t('auth.registerDesc')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-muted-foreground">{t('auth.displayName')}</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t('auth.displayNamePlaceholder')}
                    className="pl-9 bg-background/50"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-muted-foreground">{t('auth.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  className="pl-9 bg-background/50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-muted-foreground">{t('auth.password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 bg-background/50"
                />
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" size="lg" disabled={busy}>
              {busy ? t('auth.pleaseWait') : mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === 'login' ? t('auth.dontHaveAccount') : t('auth.alreadyHaveAccount')}{' '}
            <button
              type="button"
              className="font-semibold text-primary hover:underline underline-offset-4"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login')
                setEmail('')
                setPassword('')
                setDisplayName('')
              }}
            >
              {mode === 'login' ? t('auth.register') : t('auth.signIn')}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}