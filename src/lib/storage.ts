import { writeTextFile, writeFile, readTextFile, exists, mkdir, BaseDirectory, readFile, remove } from '@tauri-apps/plugin-fs'

export async function ensureAppDirs() {
  const dirs = ['logs', 'avatars', 'logos', 'settings'] as const
  for (const dir of dirs) {
    try {
      const present = await exists(dir, { baseDir: BaseDirectory.AppData })
      if (!present) {
        await mkdir(dir, { baseDir: BaseDirectory.AppData, recursive: true })
      }
    } catch (e) {
      console.error(`Failed to create AppData directory "${dir}":`, e)
    }
  }
}

export async function saveJson<T>(filename: string, data: T): Promise<void> {
  // Extract the parent directory from the filename (e.g. "settings/user.json" -> "settings")
  const dir = filename.split('/').slice(0, -1).join('/')

  // Ensure the parent directory exists before writing
  if (dir) {
    try {
      if (!(await exists(dir, { baseDir: BaseDirectory.AppData }))) {
        await mkdir(dir, { baseDir: BaseDirectory.AppData, recursive: true })
      }
    } catch (e) {
      console.warn(`Could not verify/create directory "${dir}":`, e)
    }
  }

  // Now write the file
  await writeTextFile(filename, JSON.stringify(data, null, 2), {
    baseDir: BaseDirectory.AppData,
  })
}

export async function loadJson<T>(filename: string): Promise<T | null> {
  try {
    if (!(await exists(filename, { baseDir: BaseDirectory.AppData }))) return null
    const content = await readTextFile(filename, { baseDir: BaseDirectory.AppData })
    return JSON.parse(content) as T
  } catch (e) {
    return null
  }
}

export async function appendLog(
  level: 'info' | 'error' | 'crash',
  message: string,
  meta?: Record<string, unknown>
): Promise<void> {
  const timestamp = new Date().toISOString()
  const metaStr = meta ? ' ' + JSON.stringify(meta) : ''
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`
  const file = `logs/${level}.log`

  let existing = ''
  try {
    if (await exists(file, { baseDir: BaseDirectory.AppData })) {
      existing = await readTextFile(file, { baseDir: BaseDirectory.AppData })
    }
  } catch { /* file doesn't exist yet */ }

  await writeTextFile(file, existing + line, {
    baseDir: BaseDirectory.AppData,
  })
}

export async function logInfo(msg: string, meta?: Record<string, unknown>) {
  await appendLog('info', msg, meta)
}

export async function logError(msg: string, meta?: Record<string, unknown>) {
  await appendLog('error', msg, meta)
}

export async function logCrash(msg: string, meta?: Record<string, unknown>) {
  await appendLog('crash', msg, meta)
}

export async function readAvatarAsDataUrl(absPath: string | null | undefined): Promise<string | null> {
  if (!absPath) return null
  try {
    const filename = absPath.split(/[\\/]/).pop()
    if (!filename) return null

    const bytes = await readFile(`avatars/${filename}`, { baseDir: BaseDirectory.AppData })

    const ext = filename.split('.').pop()?.toLowerCase() ?? 'png'
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
    const base64 = btoa(
      bytes.reduce((data, byte) => data + String.fromCharCode(byte), '')
    )
    return `data:${mime};base64,${base64}`
  } catch (e) {
    console.error('readAvatarAsDataUrl failed:', e)
    return null
  }
}

export async function readLogoAsDataUrl(filename: string | null | undefined): Promise<string | null> {
  if (!filename) return null
  try {
    const cleanName = filename.split(/[\\/]/).pop()
    if (!cleanName) return null

    const bytes = await readFile(`logos/${cleanName}`, { baseDir: BaseDirectory.AppData })

    const ext = cleanName.split('.').pop()?.toLowerCase() ?? 'png'
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
    const base64 = btoa(
      bytes.reduce((data, byte) => data + String.fromCharCode(byte), '')
    )
    return `data:${mime};base64,${base64}`
  } catch (e) {
    console.error('readLogoAsDataUrl failed:', e)
    return null
  }
}

export function bytesToDataUrl(bytes: Uint8Array, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'png'
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
  const base64 = btoa(
    bytes.reduce((data, byte) => data + String.fromCharCode(byte), '')
  )
  return `data:${mime};base64,${base64}`
}

// ── Background images ──

export async function ensureBackgroundsDir(): Promise<void> {
  try {
    if (!(await exists('settings/backgrounds', { baseDir: BaseDirectory.AppData }))) {
      await mkdir('settings/backgrounds', { baseDir: BaseDirectory.AppData, recursive: true })
    }
  } catch { /* dir exists */ }
}

export async function saveBackgroundImage(bytes: Uint8Array, ext: string): Promise<string> {
  await ensureBackgroundsDir()
  // Always named "background.<ext>" so old uploads are overwritten rather than accumulating.
  const filename = `background.${ext}`
  await writeFile(`settings/backgrounds/${filename}`, bytes, { baseDir: BaseDirectory.AppData })
  return filename
}

export async function readBackgroundAsDataUrl(filename: string | null | undefined): Promise<string | null> {
  if (!filename) return null
  try {
    const clean = filename.split(/[\\/]/).pop()
    if (!clean) return null
    const bytes = await readFile(`settings/backgrounds/${clean}`, { baseDir: BaseDirectory.AppData })
    return bytesToDataUrl(bytes, clean)
  } catch (e) {
    console.error('readBackgroundAsDataUrl failed:', e)
    return null
  }
}

export async function deleteBackgroundImage(filename: string | null | undefined): Promise<void> {
  if (!filename) return
  try {
    const clean = filename.split(/[\\/]/).pop()
    if (!clean) return
    await remove(`settings/backgrounds/${clean}`, { baseDir: BaseDirectory.AppData })
  } catch { /* already gone */ }
}