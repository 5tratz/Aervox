import { useEffect, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { remove, exists, BaseDirectory } from '@tauri-apps/plugin-fs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { 
  Upload, 
  Trash2, 
  Image as ImageIcon, 
  AlertTriangle, 
  FolderOpen, 
  Monitor, 
  Settings as SettingsIcon,
  ShieldAlert 
} from 'lucide-react'
import { useLocale } from '@/lib/locale-context'
import { useBackground } from '@/lib/background-context'
import { loadJson, saveJson } from '@/lib/storage'
import { readFile } from '@tauri-apps/plugin-fs'
import { toast } from 'sonner'
import { LicenseCard } from '@/components/license-card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

export function SettingsPage() {
  const { t } = useLocale()
  const { bgUrl, bgFilename, setFromFile, clear } = useBackground()

  const [msfsPath, setMsfsPath] = useState<string>('')
  const [bgBusy, setBgBusy] = useState(false)

  const [wipeOpen, setWipeOpen] = useState(false)
  const [wipeConfirm, setWipeConfirm] = useState('')
  const [wiping, setWiping] = useState(false)

  useEffect(() => {
    loadJson<{ path: string }>('settings/msfs_path.json').then((data) => {
      if (data?.path) setMsfsPath(data.path)
    })
  }, [])

  const pickMsfsPath = async () => {
    try {
      const selected = await open({ directory: true, multiple: false })
      if (selected && typeof selected === 'string') {
        setMsfsPath(selected)
        await invoke('save_packages_path', { path: selected })
        await saveJson('settings/msfs_path.json', { path: selected })
        toast.success(t('settings.msfsPathSaved'))
      }
    } catch (e) {
      console.error(e)
      toast.error(String(e))
    }
  }

  const pickBackground = async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      })
      if (!file || typeof file !== 'string') return

      setBgBusy(true)
      const bytes = await readFile(file)
      const ext = file.split('.').pop()?.toLowerCase() ?? 'png'
      await setFromFile(bytes, ext)
      toast.success(t('settings.bgUpdated'))
    } catch (e) {
      console.error('Background pick failed:', e)
      toast.error(String(e))
    } finally {
      setBgBusy(false)
    }
  }

  const clearBackground = async () => {
    setBgBusy(true)
    try {
      await clear()
      toast.success(t('settings.bgRemoved'))
    } catch (e) {
      toast.error(String(e))
    } finally {
      setBgBusy(false)
    }
  }

  const handleWipeAllData = async () => {
    if (wipeConfirm !== 'RESET') return
    setWiping(true)
    try {
      const keep = ['sidebar:collapsed', 'theme', 'locale']
      Object.keys(localStorage).forEach(k => {
        if (!keep.includes(k) && !k.startsWith('aervox:bg')) {
          localStorage.removeItem(k)
        }
      })

      const filesToWipe = [
        'settings/map.json',
        'settings/flights.json',
        'settings/user.json',
        'settings/locale.json',
        'settings/msfs_path.json',
        'settings/auth.json',
        'settings/session.json',
      ]

      for (const file of filesToWipe) {
        try {
          if (await exists(file, { baseDir: BaseDirectory.AppData })) {
            await remove(file, { baseDir: BaseDirectory.AppData })
          }
        } catch { /* file may not exist */ }
      }

      await clear()

      const avatarExts = ['png', 'jpg', 'jpeg', 'webp']
      for (const ext of avatarExts) {
        try {
          const avatarFile = `avatars/avatar.${ext}`
          if (await exists(avatarFile, { baseDir: BaseDirectory.AppData })) {
            await remove(avatarFile, { baseDir: BaseDirectory.AppData })
          }
        } catch { /* skip */ }
      }

      try {
        await invoke('save_packages_path', { path: '' })
      } catch { /* not critical */ }

      toast.success(t('settings.wipeSuccess'))
      setTimeout(() => window.location.reload(), 1000)
    } catch (e) {
      console.error(e)
      toast.error(t('settings.wipeFailed') + ' ' + String(e))
      setWiping(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-full space-y-6 pb-10">
      
      {/* Page Title */}
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" />
          {t('settings.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your app preferences and MSFS configuration.</p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1 items-start">
        
        {/* ── MSFS Configuration ── */}
        <Card className="shadow-sm border-border/60 h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              {t('settings.msfsConfig')}
            </CardTitle>
            <CardDescription>{t('settings.msfsConfigDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            <div className="space-y-3 h-full flex flex-col">
              <Label>{t('settings.folderPath')}</Label>
              <div className="flex gap-2">
                <Input readOnly value={msfsPath} placeholder={t('settings.noPath')} className="bg-muted/30 font-mono text-xs" />
                <Button variant="outline" onClick={pickMsfsPath} className="shrink-0">
                  {t('settings.browse')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mt-auto pt-4">
                {t('settings.msfsPathHint')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Appearance ── */}
        <Card className="shadow-sm border-border/60 h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              {t('settings.appearance')}
            </CardTitle>
            <CardDescription>{t('settings.appearanceDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col">
            <div className="space-y-3 flex-1 flex flex-col">
              <Label>{t('settings.bgImage')}</Label>
              
              {/* Side-by-side compact image preview */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/20 border border-border/50 rounded-lg p-3">
                <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted flex items-center justify-center group">
                  {bgUrl ? (
                    <>
                      <img src={bgUrl} alt="Background preview" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button variant="destructive" size="icon" className="h-7 w-7" onClick={clearBackground} disabled={bgBusy}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                  )}
                </div>

                <div className="flex flex-col gap-2 w-full">
                  <div className="flex gap-2 w-full">
                    <Button variant="outline" size="sm" onClick={pickBackground} disabled={bgBusy} className="flex-1">
                      <Upload className="h-4 w-4 mr-2" />
                      {bgUrl ? t('settings.changeImage') : t('settings.uploadImage')}
                    </Button>
                    {bgFilename && (
                      <Button variant="outline" size="sm" onClick={clearBackground} disabled={bgBusy} className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 px-3">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {bgBusy && <p className="text-[10px] text-muted-foreground animate-pulse">{t('common.saving')}</p>}
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed mt-auto pt-2">
                {t('settings.bgImageDesc')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── License ── */}
      <LicenseCard />

      {/* ── Danger Zone (Full Width) ── */}
      <Card className="border-destructive/30 shadow-sm bg-destructive/5 shrink-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            {t('settings.dangerZone')}
          </CardTitle>
          <CardDescription>{t('settings.dangerZoneDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-destructive/20 bg-background p-4 shadow-sm">
            <div className="space-y-1">
              <p className="text-sm font-semibold flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" /> {t('settings.wipeData')}
              </p>
              <p className="text-xs text-muted-foreground max-w-4xl leading-relaxed">
                {t('settings.wipeDataDesc')}
              </p>
            </div>
            <Button variant="destructive" className="shrink-0 shadow-sm" onClick={() => setWipeOpen(true)}>
              {t('settings.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Wipe Confirmation Dialog ── */}
      <Dialog open={wipeOpen} onOpenChange={(o) => { if (!wiping) { setWipeOpen(o); if (!o) setWipeConfirm('') } }}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center text-destructive">{t('settings.wipeConfirmTitle')}</DialogTitle>
            <DialogDescription className="text-center">
              {t('settings.wipeConfirmDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="wipe-confirm">
              {t('settings.typeReset')}
            </Label>
            <Input
              id="wipe-confirm"
              value={wipeConfirm}
              onChange={(e) => setWipeConfirm(e.target.value)}
              placeholder="RESET"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWipeOpen(false)} disabled={wiping}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={handleWipeAllData}
              disabled={wiping || wipeConfirm !== 'RESET'}
            >
              {wiping ? t('settings.wiping') : t('settings.wipeEverything')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}