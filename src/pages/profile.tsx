import { useEffect, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { writeFile, BaseDirectory, mkdir, exists } from '@tauri-apps/plugin-fs'
import {
  User, Upload, Trash2, Save, Plane, MapPin,
  Award, AlertCircle, CheckCircle2, Clock, ExternalLink,
  Calendar, CalendarDays, Star, Crosshair
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { usePilot } from '@/lib/pilot-context'
import { useSimbrief } from '@/lib/simbrief-context'
import { useFlightLog } from '@/lib/flight-log-context'
import { readAvatarAsDataUrl } from '@/lib/storage'
import { useLocale } from '@/lib/locale-context'
import { getAirport } from '@/lib/airports'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatDate(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { t } = useLocale()
  const { pilot, ready, update } = usePilot()
  const { ofp, refresh: refreshSimbrief } = useSimbrief()
  const { flights } = useFlightLog()

  const [displayName, setDisplayName] = useState('')
  const [callsign, setCallsign] = useState('')
  const [flightNumber, setFlightNumber] = useState('')
  const [email, setEmail] = useState('')
  const [simbriefId, setSimbriefId] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)

  useEffect(() => {
    if (!ready) return
    setDisplayName(pilot.displayName)
    setCallsign(pilot.callsign)
    setFlightNumber(pilot.flightNumber)
    setEmail(pilot.email)
    setSimbriefId(pilot.simbriefId)
    if (pilot.avatarFilename) {
      readAvatarAsDataUrl(pilot.avatarFilename).then(setAvatarUrl)
    }
  }, [ready, pilot])

  const isDirty =
    displayName !== pilot.displayName ||
    callsign !== pilot.callsign ||
    flightNumber !== pilot.flightNumber ||
    email !== pilot.email ||
    simbriefId !== pilot.simbriefId

  const handleSave = async () => {
    setSaving(true)
    
    const previousSimbriefId = pilot.simbriefId
    const newSimbriefId = simbriefId.trim()

    try {
      await update({
        displayName: displayName.trim(),
        callsign: callsign.trim().toUpperCase(),
        flightNumber: flightNumber.trim().toUpperCase(),
        email: email.trim(),
        simbriefId: newSimbriefId,
        lastLoginAt: Date.now(),
      })

      setSaved(true)
      toast.success(t('profile.profileSaved'))
      setTimeout(() => setSaved(false), 2000)

      if (newSimbriefId !== previousSimbriefId) {
        refreshSimbrief().catch(err => {
          console.error('Background SimBrief refresh failed:', err)
        })
      }
    } catch (err) {
      console.error('Disk save failed:', err)
      toast.error(t('profile.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarPick = async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      })
      if (!file || typeof file !== 'string') return

      setAvatarBusy(true)
      const bytes = await readFile(file)
      const ext = file.split('.').pop()?.toLowerCase() ?? 'png'

      try {
        if (!(await exists('avatars', { baseDir: BaseDirectory.AppData }))) {
          await mkdir('avatars', { baseDir: BaseDirectory.AppData, recursive: true })
        }
      } catch { /* exists */ }

      const filename = `avatar.${ext}`
      await writeFile(`avatars/${filename}`, bytes, { baseDir: BaseDirectory.AppData })
      await update({ avatarFilename: filename })

      const url = await readAvatarAsDataUrl(filename)
      setAvatarUrl(url)
      toast.success(t('profile.avatarUpdated'))
    } catch (err) {
      console.error('Avatar upload failed:', err)
      toast.error(t('profile.uploadFailed'))
    } finally {
      setAvatarBusy(false)
    }
  }

  const handleAvatarClear = async () => {
    try {
      setAvatarBusy(true)
      await update({ avatarFilename: null })
      setAvatarUrl(null)
      toast.success(t('profile.avatarRemoved'))
    } catch (err) {
      toast.error(t('profile.removeFailed'))
    } finally {
      setAvatarBusy(false)
    }
  }

  const removeFavorite = async (icao: string) => {
    const currentFavorites = pilot.favoriteAirports || []
    const newFavorites = currentFavorites.filter(f => f !== icao)
    await update({ favoriteAirports: newFavorites })
  }

  const locateOnMap = (icao: string) => {
    // Save the airport to session storage so the live map can read it
    sessionStorage.setItem('aervox:locate', icao)
    // Clear any stale persisted map view so the map doesn't briefly
    // restore an old position before flying to the requested airport.
    sessionStorage.removeItem('map:view')
    // Navigate to the dashboard
    navigate('/')
  }

  const completedFlights = flights.filter(f => f.status === 'completed')
  const uniqueAirports = new Set<string>()
  completedFlights.forEach(f => {
    if (f.departure) uniqueAirports.add(f.departure)
    if (f.arrival) uniqueAirports.add(f.arrival)
  })
  const totalMins = completedFlights.reduce((s, f) => s + f.blockMinutes, 0)
  const totalDistance = completedFlights.reduce((s, f) => s + f.totalDistanceNm, 0)

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full space-y-6 pb-10">
      
      {/* Page Title Header */}
      <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            {t('profile.pilotInfo')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your pilot identity and view your flight stats.</p>
        </div>
      </div>

      {/* Header Card - Responsive */}
      <Card className="overflow-hidden shrink-0 w-full border-border/60 shadow-sm relative">
        {/* Subtle background pattern for the header */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent pointer-events-none" />
        
        <CardContent className="p-6 relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Left: Avatar & Info */}
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left">
              <div className="relative shrink-0">
                <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl border-4 border-background bg-muted shadow-md overflow-hidden flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-muted-foreground">
                      {getInitials(displayName || pilot.callsign)}
                    </span>
                  )}
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 flex gap-1">
                  <Button
                    size="icon"
                    variant="default"
                    className="h-7 w-7 rounded-full shadow-md"
                    onClick={handleAvatarPick}
                    disabled={avatarBusy}
                  >
                    <Upload className="h-3 w-3" />
                  </Button>
                  {pilot.avatarFilename && (
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7 rounded-full shadow-md"
                      onClick={handleAvatarClear}
                      disabled={avatarBusy}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
                  {displayName || t('profile.unnamedPilot')}
                </h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap justify-center sm:justify-start">
                  {callsign && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-mono font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-md border border-primary/20">
                      <Plane className="h-3.5 w-3.5" /> {callsign}
                    </span>
                  )}
                  {flightNumber && (
                    <span className="text-sm font-mono font-medium bg-muted px-2.5 py-1 rounded-md border border-border/50">
                      {flightNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Dates with Icons */}
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 md:gap-2 shrink-0 md:border-l md:pl-6 border-border/50 items-center sm:items-start md:items-start">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-primary/70" />
                <span>{t('profile.joined')} <strong className="text-foreground font-medium">{formatDate(pilot.createdAt)}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 text-primary/70" />
                <span>{t('profile.lastActive')} <strong className="text-foreground font-medium">{formatDate(pilot.lastLoginAt)}</strong></span>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Main Grid - Expanded to fill screen */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full items-stretch flex-1">
        
        {/* Left Column */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          
          {/* Pilot Information */}
          <Card className="flex-1 flex flex-col border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" /> {t('profile.pilotInfo')}
              </CardTitle>
              <CardDescription>
                {t('profile.pilotInfoDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t('profile.displayName')}</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t('profile.displayNamePlaceholder')}
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t('profile.email')}</Label>
                  <Input
                    value={email}
                    placeholder={t('profile.emailPlaceholder')}
                    type="email"
                    disabled 
                    className="bg-muted/30 opacity-70 cursor-not-allowed" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t('profile.callsign')}</Label>
                  <Input
                    value={callsign}
                    onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                    placeholder={t('profile.callsignPlaceholder')}
                    className="font-mono uppercase bg-muted/30"
                    maxLength={12}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t('profile.flightNumber')}</Label>
                  <Input
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
                    placeholder={t('profile.flightNumberPlaceholder')}
                    className="font-mono uppercase bg-muted/30"
                    maxLength={12}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Favorite Airports (Compact) */}
          <Card className="flex flex-col border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="h-5 w-5 text-primary" /> {t('profile.favoriteAirports')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pilot.favoriteAirports && pilot.favoriteAirports.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {pilot.favoriteAirports.map(icao => {
                    const airport = getAirport(icao)
                    return (
                      <div key={icao} className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/50">
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono font-bold text-sm">{icao}</span>
                          {airport && <span className="text-[10px] text-muted-foreground truncate">{airport.name}</span>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={() => locateOnMap(icao)}
                            title="Locate on Map"
                          >
                            <Crosshair className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-yellow-400 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeFavorite(icao)}
                            title="Remove from favorites"
                          >
                            <Star className="h-4 w-4 fill-current" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  {t('profile.noFavoriteAirports')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* SimBrief Integration */}
          <Card className="flex flex-col border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plane className="h-5 w-5 text-primary" /> {t('profile.simbrief')}
              </CardTitle>
              <CardDescription>
                {t('profile.simbriefDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 pb-6">
              
              <div className="max-w-[300px] w-full space-y-2">
                <Label className="text-muted-foreground">{t('profile.simbriefId')}</Label>
                <Input
                  value={simbriefId}
                  onChange={(e) => setSimbriefId(e.target.value)}
                  placeholder={t('profile.simbriefIdPlaceholder')}
                  className="bg-muted/30 font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {t('profile.simbriefIdHint')}
                </p>
              </div>

              <Separator className="bg-border/60" />

              {/* SimBrief OFP Box */}
              <div className="w-full">
                {ofp ? (
                  <div className="space-y-2">
					<Label className="text-muted-foreground ml-1">
					  {t('profile.currentFlightPlan')}
					</Label>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-muted/20 border border-border/50">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-6 w-full">
                        {/* Route */}
                        <div className="flex items-center gap-3">
                          <span className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-foreground">{ofp.origin?.icao_code || '???'}</span>
                          <span className="text-muted-foreground text-2xl font-light">→</span>
                          <span className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-foreground">{ofp.destination?.icao_code || '???'}</span>
                        </div>
                        
                        {/* Divider (Desktop only) */}
                        <div className="hidden sm:block h-10 w-px bg-border/60" />

                        {/* Aircraft */}
                        <div className="flex flex-col text-sm">
                          <span className="font-semibold text-foreground">{ofp.aircraft?.name || t('common.unknown')}</span>
                          {ofp.aircraft?.reg && (
                            <span className="font-mono text-xs text-muted-foreground mt-0.5">{ofp.aircraft.reg}</span>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        onClick={() => navigate('/flight-plan')}
                        className="w-full sm:w-auto shrink-0 shadow-sm mt-2 sm:mt-0"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" /> {t('profile.viewFullPlan')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-5 rounded-xl bg-muted/20 border border-border/50 text-sm text-muted-foreground">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground/70" />
                    <div className="flex-1 leading-relaxed">
                      {t('profile.noOfp')}{' '}
                      <button
                        onClick={() => navigate('/flight-plan')}
                        className="font-semibold text-primary hover:underline underline-offset-2"
                      >
                        {t('profile.noOfpLink')}
                      </button>{' '}
                      {t('profile.noOfpEnd')}
                    </div>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Right Column - Flight Stats */}
        <Card className="xl:col-span-1 flex flex-col border-border/60 shadow-sm h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="h-5 w-5 text-primary" /> {t('profile.flightStats')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            <div className="space-y-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 text-muted-foreground font-medium">
                  <Plane className="h-4 w-4" /> {t('profile.totalFlights')}
                </span>
                <span className="font-mono font-semibold text-base">{completedFlights.length}</span>
              </div>
              <Separator className="bg-border/60" />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 text-muted-foreground font-medium">
                  <MapPin className="h-4 w-4" /> {t('profile.airportsVisited')}
                </span>
                <span className="font-mono font-semibold text-base">{uniqueAirports.size}</span>
              </div>
              <Separator className="bg-border/60" />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 text-muted-foreground font-medium">
                  <Clock className="h-4 w-4" /> {t('profile.totalHours')}
                </span>
                <span className="font-mono font-semibold text-base">
                  {Math.floor(totalMins / 60)}h {totalMins % 60}m
                </span>
              </div>
              <Separator className="bg-border/60" />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 text-muted-foreground font-medium">
                  <Award className="h-4 w-4" /> {t('profile.totalDistance')}
                </span>
                <span className="font-mono font-semibold text-base">{totalDistance.toLocaleString()} nm</span>
              </div>
            </div>
            
            <div className="pt-6 mt-auto text-xs text-muted-foreground border-t border-border/60 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              {completedFlights.length === 0
                ? t('profile.completeFlightPrompt')
                : `${t('profile.lastFlight')} ${completedFlights[0].departure || '???'} → ${completedFlights[0].arrival || '???'}`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-end gap-4 pt-2 pb-4 shrink-0">
        {isDirty && !saving && (
          <span className="text-sm text-amber-500 font-medium animate-pulse bg-amber-500/10 px-3 py-1.5 rounded-md">
            {t('profile.unsavedChanges')}
          </span>
        )}
        <Button 
          onClick={handleSave} 
          disabled={saving || !isDirty}
          size="lg"
          className="shadow-md min-w-[180px]"
        >
          {saved ? (
            <><CheckCircle2 className="h-4 w-4 mr-2" /> {t('common.saved')}</>
          ) : saving ? (
            <><Save className="h-4 w-4 mr-2 animate-pulse" /> {t('common.saving')}</>
          ) : (
            <><Save className="h-4 w-4 mr-2" /> {t('profile.saveProfile')}</>
          )}
        </Button>
      </div>
    </div>
  )
}