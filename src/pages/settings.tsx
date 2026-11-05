import { useEffect, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { remove, exists, BaseDirectory } from '@tauri-apps/plugin-fs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Upload, Trash2, Image as ImageIcon, AlertTriangle } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'
import { useBackground } from '@/lib/background-context'
import { loadJson, saveJson } from '@/lib/storage'
import { readFile } from '@tauri-apps/plugin-fs'
import { toast } from 'sonner'
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
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.msfsConfig')}</CardTitle>
          <CardDescription>{t('settings.msfsConfigDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('settings.folderPath')}</Label>
            <div className="flex gap-2">
              <Input readOnly value={msfsPath} placeholder={t('settings.noPath')} />
              <Button variant="outline" onClick={pickMsfsPath}>
                {t('settings.browse')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('settings.msfsPathHint')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.appearance')}</CardTitle>
          <CardDescription>{t('settings.appearanceDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('settings.bgImage')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.bgImageDesc')}</p>
            <div className="flex items-start gap-4">
              <div className="h-24 w-40 shrink-0 overflow-hidden rounded-md border bg-muted flex items-center justify-center">
                {bgUrl ? (
                  <img src={bgUrl} alt="Background preview" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={pickBackground} disabled={bgBusy}>
                  <Upload className="h-4 w-4 mr-1" />
                  {bgUrl ? t('settings.changeImage') : t('settings.uploadImage')}
                </Button>
                {bgFilename && (
                  <Button variant="ghost" size="sm" onClick={clearBackground} disabled={bgBusy} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" /> {t('settings.removeImage')}
                  </Button>
                )}
                {bgBusy && <p className="text-xs text-muted-foreground">{t('common.saving')}</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('settings.dangerZone')}
          </CardTitle>
          <CardDescription>{t('settings.dangerZoneDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-md border border-destructive/40 bg-destructive/5 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold flex items-center gap-2 text-destructive">
                <Trash2 className="h-4 w-4" /> {t('settings.wipeData')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('settings.wipeDataDesc')}
              </p>
            </div>
            <Button variant="destructive" className="shrink-0" onClick={() => setWipeOpen(true)}>
              {t('settings.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

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