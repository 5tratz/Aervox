import { useEffect, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { writeFile, BaseDirectory, mkdir, exists } from '@tauri-apps/plugin-fs'
import {
  User, Upload, Trash2, Save, Plane, MapPin,
  Award, AlertCircle, CheckCircle2, Clock, ExternalLink,
  Calendar, CalendarDays
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
      toast.success('Profile saved')
      setTimeout(() => setSaved(false), 2000)

      if (newSimbriefId !== previousSimbriefId) {
        refreshSimbrief().catch(err => {
          console.error('Background SimBrief refresh failed:', err)
        })
      }
    } catch (err) {
      console.error('Disk save failed:', err)
      toast.error('Failed to save profile to disk')
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
      toast.success('Avatar updated')
    } catch (err) {
      console.error('Avatar upload failed:', err)
      toast.error('Failed to upload avatar')
    } finally {
      setAvatarBusy(false)
    }
  }

  const handleAvatarClear = async () => {
    try {
      setAvatarBusy(true)
      await update({ avatarFilename: null })
      setAvatarUrl(null)
      toast.success('Avatar removed')
    } catch (err) {
      toast.error('Failed to remove avatar')
    } finally {
      setAvatarBusy(false)
    }
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
        Loading profile…
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-6 pb-6 w-full max-w-7xl mx-auto">

      {/* Header Card */}
      <Card className="overflow-hidden shrink-0 w-full border-border/60 shadow-sm relative">
        {/* Subtle background pattern for the header */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <CardContent className="p-6 relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Left: Avatar & Info */}
            <div className="flex items-center gap-6">
              <div className="relative shrink-0">
                <div className="h-28 w-28 rounded-2xl border-4 border-background bg-muted shadow-md overflow-hidden flex items-center justify-center">
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
                    className="h-6 w-6 rounded-full shadow-md"
                    onClick={handleAvatarPick}
                    disabled={avatarBusy}
                  >
                    <Upload className="h-2.5 w-2.5" />
                  </Button>
                  {pilot.avatarFilename && (
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-6 w-6 rounded-full shadow-md"
                      onClick={handleAvatarClear}
                      disabled={avatarBusy}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold tracking-tight truncate">
                  {displayName || 'Unnamed Pilot'}
                </h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
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
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 md:gap-2 shrink-0 md:border-l md:pl-6 border-border/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-primary/70" />
                <span>Joined <strong className="text-foreground font-medium">{formatDate(pilot.createdAt)}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 text-primary/70" />
                <span>Last active <strong className="text-foreground font-medium">{formatDate(pilot.lastLoginAt)}</strong></span>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full items-stretch">
        
        {/* Left Column */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          
          {/* Pilot Information */}
          <Card className="flex-1 flex flex-col border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" /> Pilot Information
              </CardTitle>
              <CardDescription>
                Your callsign and flight number are used across the app.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Display Name</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alex Pilot"
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Email</Label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    type="email"
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Callsign</Label>
                  <Input
                    value={callsign}
                    onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                    placeholder="e.g. BAW892"
                    className="font-mono uppercase bg-muted/30"
                    maxLength={12}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Flight Number</Label>
                  <Input
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. BA123"
                    className="font-mono uppercase bg-muted/30"
                    maxLength={12}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SimBrief Integration */}
          <Card className="flex flex-col border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plane className="h-5 w-5 text-primary" /> SimBrief Integration
              </CardTitle>
              <CardDescription>
                Connect your SimBrief account to automatically pull in your latest flight plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 pb-6">
              
              <div className="max-w-[250px] w-full space-y-2">
                <Label className="text-muted-foreground">SimBrief Pilot ID</Label>
                <Input
                  value={simbriefId}
                  onChange={(e) => setSimbriefId(e.target.value)}
                  placeholder="e.g. 123456"
                  className="bg-muted/30 font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Find this in your SimBrief Account Settings or on the New Flight page.
                </p>
              </div>

              <Separator className="bg-border/60" />

              {/* REDESIGNED SIMBRIEF BOX (Full Width) */}
              <div className="w-full">
                {ofp ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-xl bg-muted/20 border border-border/50">
                    <div className="flex items-center gap-6 w-full sm:w-auto">
                      {/* Route */}
                      <div className="flex items-center gap-3">
                        <span className="text-4xl font-bold font-mono tracking-tight text-foreground">{ofp.origin?.icao_code || '???'}</span>
                        <span className="text-muted-foreground text-2xl font-light">→</span>
                        <span className="text-4xl font-bold font-mono tracking-tight text-foreground">{ofp.destination?.icao_code || '???'}</span>
                      </div>
                      
                      {/* Divider */}
                      <div className="hidden sm:block h-10 w-px bg-border/60" />

                      {/* Aircraft */}
                      <div className="flex flex-col text-sm">
                        <span className="font-semibold text-foreground">{ofp.aircraft?.name || 'Unknown Aircraft'}</span>
                        {ofp.aircraft?.reg && (
                          <span className="font-mono text-xs text-muted-foreground mt-0.5">{ofp.aircraft.reg}</span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      onClick={() => navigate('/flight-plan')}
                      className="w-full sm:w-auto shrink-0 shadow-sm"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" /> View full flight plan
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-5 rounded-xl bg-muted/20 border border-border/50 text-sm text-muted-foreground">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground/70" />
                    <div className="flex-1 leading-relaxed">
                      No OFP loaded. Set your SimBrief ID above and click Save, or go to the{' '}
                      <button
                        onClick={() => navigate('/flight-plan')}
                        className="font-semibold text-primary hover:underline underline-offset-2"
                      >
                        Flight Plan page
                      </button>{' '}
                      to fetch one.
                    </div>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <Card className="xl:col-span-1 flex flex-col border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="h-5 w-5 text-primary" /> Flight Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            <div className="space-y-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 text-muted-foreground font-medium">
                  <Plane className="h-4 w-4" /> Total Flights
                </span>
                <span className="font-mono font-semibold text-base">{completedFlights.length}</span>
              </div>
              <Separator className="bg-border/60" />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 text-muted-foreground font-medium">
                  <MapPin className="h-4 w-4" /> Airports Visited
                </span>
                <span className="font-mono font-semibold text-base">{uniqueAirports.size}</span>
              </div>
              <Separator className="bg-border/60" />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 text-muted-foreground font-medium">
                  <Clock className="h-4 w-4" /> Total Hours
                </span>
                <span className="font-mono font-semibold text-base">
                  {Math.floor(totalMins / 60)}h {totalMins % 60}m
                </span>
              </div>
              <Separator className="bg-border/60" />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 text-muted-foreground font-medium">
                  <Award className="h-4 w-4" /> Total Distance
                </span>
                <span className="font-mono font-semibold text-base">{totalDistance.toLocaleString()} nm</span>
              </div>
            </div>
            
            <div className="pt-6 mt-auto text-xs text-muted-foreground border-t border-border/60 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              {completedFlights.length === 0
                ? 'Complete a flight in MSFS to log your first entry.'
                : `Last flight: ${completedFlights[0].departure || '???'} → ${completedFlights[0].arrival || '???'}`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-end gap-4 pt-2 pb-8">
        {isDirty && !saving && (
          <span className="text-sm text-amber-500 font-medium animate-pulse bg-amber-500/10 px-3 py-1.5 rounded-md">
            Unsaved changes
          </span>
        )}
        <Button 
          onClick={handleSave} 
          disabled={saving || !isDirty}
          size="lg"
          className="shadow-md min-w-[180px]"
        >
          {saved ? (
            <><CheckCircle2 className="h-4 w-4 mr-2" /> Saved</>
          ) : saving ? (
            <><Save className="h-4 w-4 mr-2 animate-pulse" /> Saving…</>
          ) : (
            <><Save className="h-4 w-4 mr-2" /> Save Profile</>
          )}
        </Button>
      </div>
    </div>
  )
}