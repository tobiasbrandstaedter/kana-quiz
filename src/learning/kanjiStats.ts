import type { KanjiAnswerInput, KanjiStatEntry, KanjiStatsMap, StrokeFault } from '../types'
import { review, KANJI_INTERVALS } from './scheduler'
import { kanjiOfId } from '../kanjiKeys'

export function newKanjiEntry(id: string): KanjiStatEntry {
  return {
    id, correct: 0, incorrect: 0, totalMs: 0, count: 0, lastSeen: 0, lastWrong: 0, resolvedAt: 0,
    streak: 0, confusions: {}, byType: {}, mistakes: {}, box: 0, due: 0, strokeErrors: [], strokeFaults: {},
  }
}

/** What storage holds, as a map. Fields added after an entry was written get their defaults. */
export function normalizeKanjiStats(raw: unknown): KanjiStatsMap {
  if (!raw || typeof raw !== 'object') return {}
  const out: KanjiStatsMap = {}
  for (const [id, e] of Object.entries(raw as Record<string, unknown>)) {
    if (e && typeof e === 'object') out[id] = { ...newKanjiEntry(id), ...(e as Partial<KanjiStatEntry>), id }
  }
  return out
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
