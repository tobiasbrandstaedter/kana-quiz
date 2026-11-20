import type { KanjiAnswerInput, KanjiStatEntry, KanjiStatsMap } from '../types'
import { review } from './scheduler'
import { kanjiOfId } from '../kanjiKeys'

export function newKanjiEntry(id: string): KanjiStatEntry {
  return {
    id, correct: 0, incorrect: 0, totalMs: 0, count: 0, lastSeen: 0, lastWrong: 0, resolvedAt: 0,
    streak: 0, confusions: {}, byType: {}, box: 0, due: 0,
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
 * `review`, except with holdBox (right on the re-ask after a miss in the same session).
 * "Don't know" comes with an empty `given` and leaves no confusion behind.
 */
export function applyKanjiAnswer(old: KanjiStatEntry | undefined, a: KanjiAnswerInput, now: number): KanjiStatEntry {
  const e = old ? { ...old, confusions: { ...old.confusions }, byType: { ...old.byType } } : newKanjiEntry(a.id)
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
  }
  if (!a.holdBox) Object.assign(e, review(e, a.correct, now))
  if (a.ms > 0 && a.ms < 30_000) {
    e.totalMs += a.ms
    e.count++
  }
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
