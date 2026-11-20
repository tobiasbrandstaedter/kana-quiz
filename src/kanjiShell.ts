// The only kanji code in the entry chunk: which course is on screen, which kanji screen,
// the counts the shell needs (due dot, tab badge, reset label), the reset and the door to
// the chunk. It reads the kanji keys straight from storage and imports nothing of the chunk.
import { ref, computed } from 'vue'
import type { Course, KanjiMode, KanjiStatsMap } from './types'
import { KANJI_PREFS_KEY, KANJI_PROGRESS_KEYS, KANJI_STATS_KEY, kanjiOfId } from './kanjiKeys'
import { hasOpenError, isDue, isSeen } from './learning/scheduler'
import { clock } from './clock'

export function readJson(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null }
}

export function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export interface KanjiPrefs {
  course?: Course
  mode?: KanjiMode
  smartSize?: number
  smartNew?: number
  sets?: string[]  // picked for the custom quiz and as the source of new kanji
}

const MODES: KanjiMode[] = ['meaning', 'recognize', 'mixed']

const inRange = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max

/** The stored prefs, anything unknown or out of range left out so the defaults apply. */
export function loadKanjiPrefs(): KanjiPrefs {
  const raw = readJson(KANJI_PREFS_KEY)
  if (!raw || typeof raw !== 'object') return {}
  const p = raw as Record<string, unknown>
  const prefs: KanjiPrefs = {}
  if (p.course === 'kana' || p.course === 'kanji') prefs.course = p.course
  if (MODES.includes(p.mode as KanjiMode)) prefs.mode = p.mode as KanjiMode
  if (inRange(p.smartSize, 5, 100)) prefs.smartSize = p.smartSize
  if (inRange(p.smartNew, 0, 10)) prefs.smartNew = p.smartNew
  // which set ids exist is the chunk's business, it drops the unknown ones
  if (Array.isArray(p.sets)) prefs.sets = p.sets.filter((x): x is string => typeof x === 'string')
  return prefs
}

export function saveKanjiPrefs(patch: KanjiPrefs): void {
  writeJson(KANJI_PREFS_KEY, { ...loadKanjiPrefs(), ...patch })
}

export const course = ref<Course>(loadKanjiPrefs().course ?? 'kana')

export function setCourse(c: Course): void {
  // a kana learner who never picked Kanji gets no kanji key, so their backups stay version 1
  if (course.value === c) return
  course.value = c
  saveKanjiPrefs({ course: c })
}

// set by the kanji part, App.vue shows its screens from it
export const kanjiScreen = ref<'setup' | 'quiz' | 'results'>('setup')

// the kanji the sheet is open for. App.vue mounts the sheet once, wherever it was opened from
export const kanjiDetail = ref<string | null>(null)
export const openKanji = (kanji: string) => { kanjiDetail.value = kanji }
export const closeKanji = () => { kanjiDetail.value = null }

// bumped whenever kanji stats are written, so the counts below read them again
export const kanjiRevision = ref(0)

// the loaded kanji part registers here what it has to drop on a reset
let dropLoadedState: (() => void) | null = null
export function onKanjiReset(fn: () => void): void {
  dropLoadedState = fn
}

/** Wipes kanji progress, the prefs stay. A loaded kanji part forgets what it holds. */
export function resetKanji(): void {
  for (const key of KANJI_PROGRESS_KEYS) {
    try { localStorage.removeItem(key) } catch {}
  }
  dropLoadedState?.()
  kanjiScreen.value = 'setup'
  closeKanji()
  kanjiRevision.value++
}

const stored = computed((): KanjiStatsMap => {
  // only read so this runs again after every kanji write
  kanjiRevision.value
  const raw = readJson(KANJI_STATS_KEY)
  return raw && typeof raw === 'object' ? raw as KanjiStatsMap : {}
})

/** Kanji (and later words) due now, for the dot on the switch and the tab badge. */
export const kanjiDue = computed(() => Object.values(stored.value).filter(e => isSeen(e) && isDue(e, clock.value)).length)

/** Kanji with an open error, for the badge on the Progress tab. */
export const kanjiErrors = computed(() => Object.entries(stored.value).filter(([id, e]) => e && kanjiOfId(id) !== null && hasOpenError(e)).length)

/** Kanji with stored progress, words not counted. */
export const kanjiTracked = computed(() => Object.keys(stored.value).filter(id => kanjiOfId(id) !== null).length)

export const loadKanji = () => import('./kanjiChunk')
