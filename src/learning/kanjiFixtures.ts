// Made up courses and the shared time and stats builders for the kanji tests, no real content.
import type { KanjiStatEntry, KanjiStatsMap } from '../types'
import type { PlanCourse, PlanGroup, PlanWord } from './kanjiPlan'
import { newKanjiEntry } from './kanjiStats'

export const DAY = 24 * 60 * 60 * 1000
export const NOW = 1_800_000_000_000

export const IDS = Array.from({ length: 30 }, (_, i) => `k:${String.fromCharCode(65 + i)}`)

export const stat = (id: string, patch: Partial<KanjiStatEntry> = {}): KanjiStatEntry => ({ ...newKanjiEntry(id), ...patch })
export const seen = (id: string, box: number, due: number): KanjiStatEntry => stat(id, { correct: 1, box, due })
export const statsOf = (...entries: KanjiStatEntry[]): KanjiStatsMap => Object.fromEntries(entries.map(e => [e.id, e]))

// A course with words: every kanji has its own first word, A has two further words, one
// of them special, the first word of D needs A too
export const word = (id: string, kanji: string[], first: boolean, special = false): PlanWord =>
  ({ id: `w:${id}`, kanji: kanji.map(k => `k:${k}`), home: `k:${kanji[kanji.length - 1]}`, first, special })
export const WORDS: PlanWord[] = [
  word('a', ['A'], true), word('a-special', ['A'], false, true), word('a2', ['A'], false),
  word('b', ['B'], true), word('c', ['C'], true), word('ad', ['A', 'D'], true), word('e', ['E'], true),
]
export const C: PlanCourse = { kanji: ['k:A', 'k:B', 'k:C', 'k:D', 'k:E'], words: WORDS, groups: [] }

// A group on B: two words and a question word that also needs E, all three practiced
const gw = (id: string, kanji: string[]): PlanWord => ({ ...word(id, kanji, false), home: 'k:B', group: 'gb' })
export const GROUP: PlanGroup = {
  id: 'gb', home: 'k:B', words: [gw('g1', ['A', 'B']), gw('g2', ['D', 'B']), gw('gq', ['E', 'B'])], question: 'w:gq',
}
export const G: PlanCourse = { ...C, words: [...WORDS, ...GROUP.words], groups: [GROUP] }

// A second group, on D, which comes after B in the course: two words, no question word
const gd = (id: string, kanji: string[]): PlanWord => ({ ...word(id, kanji, false), home: 'k:D', group: 'gd' })
export const GROUP_D: PlanGroup = { id: 'gd', home: 'k:D', words: [gd('d1', ['A', 'D']), gd('d2', ['B', 'D'])], question: null }
export const G2: PlanCourse = { ...C, words: [...WORDS, ...GROUP.words, ...GROUP_D.words], groups: [GROUP, GROUP_D] }

// A, B and D met with their first words, B reviewed on a later day; C and E still new
export const READY = [
  seen('k:A', 1, NOW + DAY), seen('k:B', 2, NOW + DAY), seen('k:D', 1, NOW + DAY),
  seen('w:a', 1, NOW + DAY), seen('w:b', 1, NOW + DAY), seen('w:ad', 1, NOW + DAY),
]
export const readyWith = (...extra: KanjiStatEntry[]) => statsOf(...READY, ...extra)
