import { KANJI_KEYS, KANJI_STATS_KEY } from './kanjiKeys'

// everything the app keeps in localStorage, so a backup carries progress and preferences
const KANA_KEYS = ['kana_stats_v3', 'kana_answers_v1', 'kana_days_v1', 'kana_prefs', 'kana_script', 'hiragana_kana_font', 'kana_theme']
export const BACKUP_KEYS = [...KANA_KEYS, ...KANJI_KEYS]
const STATS_KEY = 'kana_stats_v3'

// version 1 is from before kanji, version 2 carries the kanji keys too
export interface Backup {
  app: 'kana-quiz'
  version: 1 | 2
  savedAt: number  // ms epoch
  data: Record<string, string>  // localStorage key -> raw value
}

// a version 1 backup can't know about kanji, so it neither brings nor removes them
function keysOf(version: 1 | 2): string[] {
  return version === 1 ? KANA_KEYS : BACKUP_KEYS
}

export function buildBackup(read: (key: string) => string | null, now: number): Backup {
  const data: Record<string, string> = {}
  for (const key of BACKUP_KEYS) {
    const value = read(key)
    if (value !== null) data[key] = value
  }
  // without kanji there is nothing new in it, and the previous build can still read a version 1
  const version = KANJI_KEYS.some(key => key in data) ? 2 : 1
  return { app: 'kana-quiz', version, savedAt: now, data }
}

/** Throws with a message meant for the user when the text is not a usable backup. */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new Error('This file is not a Kana Quiz backup, it is not valid JSON.') }
  const b = raw as Partial<Backup> | null
  if (!b || b.app !== 'kana-quiz' || typeof b.data !== 'object' || b.data === null)
    throw new Error('This file is not a Kana Quiz backup.')
  if (b.version !== 1 && b.version !== 2)
    throw new Error(`This backup has version ${b.version}, this app reads version 1 and 2. Update the app first.`)

  // only keys the app knows, a hand edited file shouldn't plant anything else
  const data: Record<string, string> = {}
  for (const key of keysOf(b.version))
    if (typeof b.data[key] === 'string') data[key] = b.data[key]
  if (statsIds(data, STATS_KEY).length === 0 && statsIds(data, KANJI_STATS_KEY).length === 0)
    throw new Error('This backup has no progress in it.')
  return { app: 'kana-quiz', version: b.version, savedAt: typeof b.savedAt === 'number' ? b.savedAt : 0, data }
}

function statsIds(data: Record<string, string>, key: string): string[] {
  try {
    const stats = JSON.parse(data[key] ?? 'null')
    return stats && typeof stats === 'object' ? Object.keys(stats) : []
  } catch { return [] }
}

/** How many kana the backup has answers for, shown before it replaces anything. */
export function kanaInBackup(b: Backup): number {
  return statsIds(b.data, STATS_KEY).length
}

/** Same for kanji. The kanji stats also hold words (ids `w:...`), those don't count here. */
export function kanjiInBackup(b: Backup): number {
  return statsIds(b.data, KANJI_STATS_KEY).filter(id => id.startsWith('k:')).length
}

/** Replaces what is stored with the backup. Keys the backup doesn't have are removed. */
export function restoreBackup(b: Backup, storage: Pick<Storage, 'setItem' | 'removeItem'>): void {
  for (const key of keysOf(b.version)) {
    if (key in b.data) storage.setItem(key, b.data[key])
    else storage.removeItem(key)
  }
  // with no kana stats in the backup, useStats would fall back to this old key and bring old progress back
  storage.removeItem('kana_stats_v2')
}
