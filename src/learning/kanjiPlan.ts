import type { KanjiAnswerRecord, KanjiSetEntry, KanjiStatEntry, KanjiStatsMap } from '../types'
import { kanjiId } from '../kanjiKeys'
import { isDue, isSeen, recentErrors } from './scheduler'
import type { SmartPicks } from './scheduler'
import { shuffle } from './distractors'

// too many shaky items: no new ones until those settle (KR31)
export const MAX_KANJI_LEARNING = 12
// a new kanji is an intro card and two tests
export const CARDS_PER_NEW = 3

export interface KanjiPlan extends SmartPicks<string> {
  // why no new kanji come although some are left: switched off, the picked sets are all seen,
  // or too many still settling. null when new ones come, none are left, or the reviews leave no room
  newBlocked: 'off' | 'sets' | 'cap' | null
}

/**
 * The next smart session over `ids`, item ids in learning order, in priority order: due
 * reviews (lowest box, most overdue first), items with a high recent error rate, up to
 * `newLimit` new ones in that order, then the items due next to fill up. `size` counts
 * every card, a new item takes CARDS_PER_NEW of them. New items come from `newIds` (the
 * picked sets, in the same order), reviews from all of `ids`.
 */
export function planKanji(
  stats: KanjiStatsMap, log: KanjiAnswerRecord[], ids: string[], size: number, now: number, newLimit: number,
  newIds: string[] = ids,
): KanjiPlan {
  const reviewable = ids.map(id => stats[id]).filter(isSeen)
  const taken = new Set<string>()
  const take = (list: KanjiStatEntry[], limit: number) => {
    const out = list.filter(e => !taken.has(e.id)).slice(0, Math.max(0, limit))
    out.forEach(e => taken.add(e.id))
    return out.map(e => e.id)
  }

  const due = take(reviewable.filter(e => isDue(e, now)).sort((a, b) => a.box - b.box || a.due - b.due), size)

  const recent = recentErrors(log, r => r.id)
  const rate = (e: KanjiStatEntry) => {
    const r = recent.get(e.id)
    return r && r.answers >= 3 ? r.errors / r.answers : 0
  }
  const weak = take(reviewable.filter(e => rate(e) >= 0.3).sort((a, b) => rate(b) - rate(a)), size - due.length)

  const learning = reviewable.filter(e => e.box <= 1).length
  const room = size - due.length - weak.length
  const unseen = ids.filter(id => !isSeen(stats[id]))
  const unseenPicked = newIds.filter(id => !isSeen(stats[id]))
  const freshLimit = learning >= MAX_KANJI_LEARNING ? 0 : Math.min(newLimit, Math.floor(room / CARDS_PER_NEW))
  const fresh = unseenPicked.slice(0, Math.max(0, freshLimit))

  const fill = take([...reviewable].sort((a, b) => a.due - b.due), room - fresh.length * CARDS_PER_NEW)

  let newBlocked: KanjiPlan['newBlocked'] = null
  if (fresh.length === 0 && unseen.length > 0) {
    if (newLimit === 0) newBlocked = 'off'
    else if (unseenPicked.length === 0) newBlocked = 'sets'
    else if (learning >= MAX_KANJI_LEARNING) newBlocked = 'cap'
  }

  return { due, weak, fresh, fill, newBlocked }
}

/** Item ids of the kanji in the picked sets, in course order: the custom quiz and the source of new kanji. */
export function pickedKanjiIds(sets: KanjiSetEntry[], picked: Set<string>): string[] {
  return sets.filter(s => picked.has(s.id)).flatMap(s => s.kanji.map(kanjiId))
}

/** Practice for the open errors: each one once to three times, by its recent misses, shuffled. */
export function errorPracticeIds(errors: KanjiStatEntry[], log: KanjiAnswerRecord[], rng: () => number = Math.random): string[] {
  const recent = recentErrors(log, r => r.id)
  const ids = errors.flatMap(e => Array.from({ length: Math.min(3, Math.max(1, recent.get(e.id)?.errors ?? 0)) }, () => e.id))
  return shuffle(ids, rng)
}

/**
 * One kanji on its own: asked three times, each time followed by a kanji the learner
 * knows, so it is never the same card twice in a row. Fewer known ones, fewer in between.
 */
export function singleKanjiOrder(id: string, known: string[], rng: () => number = Math.random): string[] {
  const others = shuffle(known.filter(k => k !== id), rng)
  return [0, 1, 2].flatMap(i => others[i] ? [id, others[i]] : [id])
}
