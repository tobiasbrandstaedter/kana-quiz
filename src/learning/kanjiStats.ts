import type { KanjiAnswerInput, KanjiAnswerRecord, KanjiStatEntry, KanjiStatsMap, StrokeFault } from '../types'
import { review, KANJI_INTERVALS } from './scheduler'
import { kanjiOfId } from '../kanjiKeys'

export function newKanjiEntry(id: string): KanjiStatEntry {
  return {
    id, correct: 0, incorrect: 0, totalMs: 0, count: 0, lastSeen: 0, lastWrong: 0, resolvedAt: 0,
    streak: 0, confusions: {}, byType: {}, mistakes: {}, box: 0, due: 0, strokeErrors: [], strokeFaults: {},
  }
}

const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const num = (x: unknown): number => typeof x === 'number' && Number.isFinite(x) ? x : 0

// storage and backups can be edited by hand: every key below is user text, __proto__ included
function counts(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!isObject(raw)) return out
  for (const [k, n] of Object.entries(raw)) {
    if (k !== '__proto__' && typeof n === 'number' && Number.isFinite(n)) out[k] = n
  }
  return out
}

function directions(raw: unknown): KanjiStatEntry['byType'] {
  const out: Record<string, { correct: number; incorrect: number }> = {}
  if (!isObject(raw)) return out
  for (const [k, d] of Object.entries(raw)) {
    if (k !== '__proto__' && isObject(d)) out[k] = { correct: num(d.correct), incorrect: num(d.incorrect) }
  }
  return out
}

function entry(id: string, e: Record<string, unknown>): KanjiStatEntry {
  const box = num(e.box)
  return {
    id,
    correct: num(e.correct), incorrect: num(e.incorrect), totalMs: num(e.totalMs), count: num(e.count),
    lastSeen: num(e.lastSeen), lastWrong: num(e.lastWrong), resolvedAt: num(e.resolvedAt), streak: num(e.streak),
    confusions: counts(e.confusions),
    byType: directions(e.byType),
    mistakes: counts(e.mistakes),
    box: Number.isInteger(box) ? Math.min(Math.max(box, 0), KANJI_INTERVALS.length - 1) : 0,
    due: num(e.due),
    strokeErrors: Array.isArray(e.strokeErrors) ? e.strokeErrors.map(num) : [],
    strokeFaults: counts(e.strokeFaults),
  }
}

/**
 * What storage holds, as a map. Fields added after an entry was written get their defaults,
 * and anything of the wrong shape is dropped or set back, a crafted backup included: only
 * `k:` and `w:` ids, plain objects and finite numbers inside, a box in range.
 */
export function normalizeKanjiStats(raw: unknown): KanjiStatsMap {
  const out: KanjiStatsMap = {}
  if (!isObject(raw)) return out
  for (const [id, e] of Object.entries(raw)) {
    if ((id.startsWith('k:') || id.startsWith('w:')) && isObject(e)) out[id] = entry(id, e)
  }
  return out
}

/** The stored answer log, records without a string id and type or a finite time dropped. */
export function normalizeKanjiLog(raw: unknown): KanjiAnswerRecord[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((r): r is KanjiAnswerRecord =>
    isObject(r) && typeof r.id === 'string' && typeof r.type === 'string' && typeof r.t === 'number' && Number.isFinite(r.t))
}

/**
 * The entry after one answer, the old one stays untouched. The Leitner box moves through
 * `review` with the kanji intervals (up to box 7, 120 days), except with holdBox (right on the re-ask after a miss in the same session) and
 * for a typo (a typed reading that slipped twice), as for kana.
 * "Don't know" comes with an empty `given` and leaves no confusion behind. A wrong reading
 * with a name counts its kind in `mistakes`. A written answer goes to `applyWrite`.
 */
export function applyKanjiAnswer(old: KanjiStatEntry | undefined, a: KanjiAnswerInput, now: number): KanjiStatEntry {
  if (a.type === 'write') return applyWrite(old, a)
  const e = old
    ? { ...old, confusions: { ...old.confusions }, byType: { ...old.byType }, mistakes: { ...old.mistakes } }
    : newKanjiEntry(a.id)
  const byType = { ...(e.byType[a.type] ?? { correct: 0, incorrect: 0 }) }
  e.byType[a.type] = byType
  e.lastSeen = now
  if (a.correct) {
    e.correct++
    byType.correct++
    e.streak++
  } else {
    e.incorrect++
    byType.incorrect++
    e.streak = 0
    e.lastWrong = now
    if (a.given) e.confusions[a.given] = (e.confusions[a.given] ?? 0) + 1
    if (a.mistake) e.mistakes[a.mistake] = (e.mistakes[a.mistake] ?? 0) + 1
  }
  if (!a.holdBox && !a.typo) Object.assign(e, review(e, a.correct, now, KANJI_INTERVALS))
  if (a.ms > 0 && a.ms < 30_000) {
    e.totalMs += a.ms
    e.count++
  }
  return e
}

/**
 * A written kanji (KD11): counted under `write` with its stroke tallies, nothing else. The box,
 * the totals, the streak and the errors say how well the kanji is known on sight, writing
 * from memory is an offer on top and must not move them either way.
 */
function applyWrite(old: KanjiStatEntry | undefined, a: KanjiAnswerInput): KanjiStatEntry {
  const e = old
    ? { ...old, byType: { ...old.byType }, strokeErrors: [...old.strokeErrors], strokeFaults: { ...old.strokeFaults } }
    : newKanjiEntry(a.id)
  const write = { ...(e.byType.write ?? { correct: 0, incorrect: 0 }) }
  if (a.correct) write.correct++
  else write.incorrect++
  e.byType.write = write
  a.strokes?.errors.forEach((n, i) => { e.strokeErrors[i] = (e.strokeErrors[i] ?? 0) + n })
  for (const [fault, n] of Object.entries(a.strokes?.faults ?? {}) as Array<[StrokeFault, number]>)
    e.strokeFaults[fault] = (e.strokeFaults[fault] ?? 0) + n
  return e
}

/** The kanji picked instead of this item, most often first, with how often. Words and Don't know aren't in there. */
export function confusedKanji(stat: KanjiStatEntry | undefined): Array<{ kanji: string; n: number }> {
  if (!stat) return []
  const out: Array<{ kanji: string; n: number }> = []
  for (const [id, n] of Object.entries(stat.confusions)) {
    const kanji = kanjiOfId(id)
    if (kanji) out.push({ kanji, n })
  }
  return out.sort((a, b) => b.n - a.n)
}
