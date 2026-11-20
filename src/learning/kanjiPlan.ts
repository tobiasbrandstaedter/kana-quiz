import type { KanjiAnswerRecord, KanjiStatEntry, KanjiStatsMap } from '../types'
import { isDue, isSeen, recentErrors } from './scheduler'
import type { SmartPicks } from './scheduler'

// too many shaky items: no new ones until those settle (KR31)
export const MAX_KANJI_LEARNING = 12
// a new kanji is an intro card and two tests
export const CARDS_PER_NEW = 3

export interface KanjiPlan extends SmartPicks<string> {
  // why no new kanji come although some are left: switched off, or too many still settling.
  // null when new ones come, none are left, or the reviews leave no room
  newBlocked: 'off' | 'cap' | null
}

/**
 * The next smart session over `ids`, item ids in learning order, in priority order: due
 * reviews (lowest box, most overdue first), items with a high recent error rate, up to
 * `newLimit` new ones in that order, then the items due next to fill up. `size` counts
 * every card, a new item takes CARDS_PER_NEW of them.
 */
export function planKanji(
  stats: KanjiStatsMap, log: KanjiAnswerRecord[], ids: string[], size: number, now: number, newLimit: number,
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
  const freshLimit = learning >= MAX_KANJI_LEARNING ? 0 : Math.min(newLimit, Math.floor(room / CARDS_PER_NEW))
  const fresh = unseen.slice(0, Math.max(0, freshLimit))

  const fill = take([...reviewable].sort((a, b) => a.due - b.due), room - fresh.length * CARDS_PER_NEW)

  let newBlocked: KanjiPlan['newBlocked'] = null
  if (fresh.length === 0 && unseen.length > 0) {
    if (newLimit === 0) newBlocked = 'off'
    else if (learning >= MAX_KANJI_LEARNING) newBlocked = 'cap'
  }

  return { due, weak, fresh, fill, newBlocked }
}
