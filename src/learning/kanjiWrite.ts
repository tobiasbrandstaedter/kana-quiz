// Writing kanji from memory (W1, KD11, KR26, KR50): which kanji a write quiz asks, when a write
// on the Writing tab is stored, and the log without written answers for everything that
// judges how well an item is known on sight.
import type { KanjiAnswerRecord, KanjiStatEntry, KanjiStatsMap } from '../types'
import { isSeen } from './scheduler'
import { dayKey } from './progress'

/** The kanji of `kanjiIds` the learner has been introduced to, in the order given: the custom quiz in the mode Write. */
export function writeQuizIds(kanjiIds: string[], stats: KanjiStatsMap): string[] {
  return kanjiIds.filter(id => isSeen(stats[id]))
}

/**
 * What a clean write on the Writing tab does: `new` when the kanji isn't in practice yet (it
 * should get its intro card first), `peeked` when it was on screen since it was picked (not
 * from memory), `repeat` when one was stored for it today already, else `save`. Writes from
 * the tab are the write records without a time.
 */
export function writePractice(
  stat: KanjiStatEntry | undefined, log: KanjiAnswerRecord[], id: string, peeked: boolean, now: number,
): 'new' | 'peeked' | 'repeat' | 'save' {
  if (!isSeen(stat)) return 'new'
  if (peeked) return 'peeked'
  const today = dayKey(now)
  if (log.some(r => r.id === id && r.type === 'write' && r.ms === 0 && dayKey(r.t) === today)) return 'repeat'
  return 'save'
}

/** The log without written answers. Weak items, open errors and patterns are about knowing an item on sight. */
export function recallAnswers(log: KanjiAnswerRecord[]): KanjiAnswerRecord[] {
  return log.filter(r => r.type !== 'write')
}

/**
 * The answer log after a new record, trimmed for each kind on its own: the last `max` records
 * that are not writes and the last `maxWrites` writes, order kept. Writes only feed the once
 * per kanji and day rule, so lots of writing must not push out the history the plan reads.
 */
export function trimLog(log: KanjiAnswerRecord[], max = 1000, maxWrites = 300): KanjiAnswerRecord[] {
  let recall = log.length - log.filter(r => r.type === 'write').length
  let writes = log.length - recall
  return log.filter(r => {
    if (r.type === 'write') return writes-- <= maxWrites
    return recall-- <= max
  })
}

/**
 * Whether a finished drawing on a write card counts as right: clean, and the card wasn't left
 * and resumed. A new canvas after Resume has forgotten the hints and faults of the old one.
 */
export const writeCorrect = (clean: boolean, resumed: boolean): boolean => clean && !resumed

/** Written cleanly from memory at least once, the check mark on the Writing tab. */
export const writtenClean = (stat: KanjiStatEntry | undefined): boolean => (stat?.byType.write?.correct ?? 0) > 0
