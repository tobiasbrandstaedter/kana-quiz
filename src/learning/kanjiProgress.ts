import type { ItemInfo, KanjiAnswerRecord, KanjiRow, KanjiSort, KanjiStatEntry, KanjiStatsMap } from '../types'
import { accuracy } from '../format'
import { hasOpenError, recentErrors } from './scheduler'

/**
 * The open errors among `ids` (missed, not back in a mastered box, not resolved since),
 * most recent misses first, then most misses overall, then in the order of `ids`.
 */
export function openKanjiErrors(stats: KanjiStatsMap, log: KanjiAnswerRecord[], ids: string[]): KanjiStatEntry[] {
  const recent = recentErrors(log, r => r.id)
  const recentOf = (id: string) => recent.get(id)?.errors ?? 0
  return ids
    .map(id => stats[id])
    .filter((stat): stat is KanjiStatEntry => !!stat && hasOpenError(stat))
    .sort((a, b) => recentOf(b.id) - recentOf(a.id) || b.incorrect - a.incorrect)
}

/**
 * A word the learner can read: its reading was typed right at least once and it is in box 2 or
 * above now. A miss sends it to box 0 or 1, from where it climbs back on a later day.
 * A reading only ever picked among four doesn't count.
 */
export const readsWord = (stat: KanjiStatEntry): boolean => (stat.byType['read-type']?.correct ?? 0) > 0 && stat.box >= 2

/** A table row: what the item is, where it sits in the course, and its numbers. */
export function itemRow(item: ItemInfo, order: number, stat: KanjiStatEntry): KanjiRow {
  return { item, order, correct: stat.correct, incorrect: stat.incorrect, acc: accuracy(stat), box: stat.box, due: stat.due }
}

/** The table in the order the learner asked for, course order without a pick. */
export function sortKanjiRows(rows: KanjiRow[], sort: KanjiSort | null): KanjiRow[] {
  const byOrder = [...rows].sort((a, b) => a.order - b.order)
  if (!sort) return byOrder
  const sign = sort.dir === 'asc' ? 1 : -1
  // ties stay in course order, the sort is stable
  return byOrder.sort((a, b) => {
    if (sort.col === 'kanji') return sign * (a.order - b.order)
    if (sort.col === 'acc') return sign * (a.acc - b.acc)
    if (sort.col === 'errors') return sign * (a.incorrect - b.incorrect)
    return sign * (a.box - b.box || a.due - b.due)
  })
}
