import { MASTERED_BOX } from './learning/scheduler'
import type { AccClass } from './types'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** "now", "in 3 h", "tomorrow", "in 4 days" */
export function fromNow(t: number, now: number = Date.now()): string {
  const diff = t - now
  if (diff <= 0) return 'now'
  if (diff < HOUR) return 'within the hour'
  if (diff < DAY) return `in ${Math.round(diff / HOUR)} h`
  const days = Math.round(diff / DAY)
  return days === 1 ? 'tomorrow' : `in ${days} days`
}

/** Share of right answers in percent, 0 while nothing was answered. */
export function accuracy(e: { correct: number; incorrect: number }): number {
  const n = e.correct + e.incorrect
  return n > 0 ? Math.round((e.correct / n) * 100) : 0
}

// one cut for every place a result gets a color
export function accClass(pct: number): AccClass {
  return pct >= 80 ? 'good' : pct >= 50 ? 'ok' : 'bad'
}

export type Stage = 'new' | 'learning' | 'reviewing' | 'mastered'

/** Plain words for a Leitner box, so the learner doesn't have to know the system. */
export function stageOf(box: number, seen: boolean): Stage {
  if (!seen) return 'new'
  if (box >= MASTERED_BOX) return 'mastered'
  return box === MASTERED_BOX - 1 ? 'reviewing' : 'learning'
}

export const STAGE_LABEL: Record<Stage, string> = {
  new: 'Not seen',
  learning: 'Learning',
  reviewing: 'Reviewing',
  mastered: 'Mastered',
}
