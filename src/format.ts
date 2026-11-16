import { MASTERED_BOX } from './learning/scheduler'

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
