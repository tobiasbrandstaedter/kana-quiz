// everything the app keeps in localStorage, so a backup carries progress and preferences
export const BACKUP_KEYS = ['kana_stats_v3', 'kana_answers_v1', 'kana_days_v1', 'kana_prefs', 'kana_script', 'hiragana_kana_font']
const STATS_KEY = 'kana_stats_v3'

export interface Backup {
  app: 'kana-quiz'
  version: 1
  savedAt: number  // ms epoch
  data: Record<string, string>  // localStorage key -> raw value
}

export function buildBackup(read: (key: string) => string | null, now: number): Backup {
  const data: Record<string, string> = {}
  for (const key of BACKUP_KEYS) {
    const value = read(key)
    if (value !== null) data[key] = value
  }
  return { app: 'kana-quiz', version: 1, savedAt: now, data }
}

/** Throws with a message meant for the user when the text is not a usable backup. */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new Error('This file is not a Kana Quiz backup, it is not valid JSON.') }
  const b = raw as Partial<Backup> | null
  if (!b || b.app !== 'kana-quiz' || typeof b.data !== 'object' || b.data === null)
    throw new Error('This file is not a Kana Quiz backup.')
  if (b.version !== 1)
    throw new Error(`This backup has version ${b.version}, this app reads version 1. Update the app first.`)

  // only keys the app knows, a hand edited file shouldn't plant anything else
  const data: Record<string, string> = {}
  for (const key of BACKUP_KEYS)
    if (typeof b.data[key] === 'string') data[key] = b.data[key]
  if (backupKanaCount(data) === 0) throw new Error('This backup has no progress in it.')
  return { app: 'kana-quiz', version: 1, savedAt: typeof b.savedAt === 'number' ? b.savedAt : 0, data }
}

function backupKanaCount(data: Record<string, string>): number {
  try {
    const stats = JSON.parse(data[STATS_KEY] ?? 'null')
    return stats && typeof stats === 'object' ? Object.keys(stats).length : 0
  } catch { return 0 }
}

/** How many kana the backup has answers for, shown before it replaces anything. */
export function kanaInBackup(b: Backup): number {
  return backupKanaCount(b.data)
}

/** Replaces what is stored with the backup. Keys the backup doesn't have are removed. */
export function restoreBackup(b: Backup, storage: Pick<Storage, 'setItem' | 'removeItem'>): void {
  for (const key of BACKUP_KEYS) {
    if (key in b.data) storage.setItem(key, b.data[key])
    else storage.removeItem(key)
  }
}
