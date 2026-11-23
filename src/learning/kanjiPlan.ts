import type { KanjiAnswerRecord, KanjiSetEntry, KanjiStatEntry, KanjiStatsMap } from '../types'
import { kanjiId } from '../kanjiKeys'
import { isDue, isSeen, recentErrors } from './scheduler'
import { shuffle } from './distractors'

// too many shaky items, kanji and words together: nothing new until those settle (KR31)
export const MAX_KANJI_LEARNING = 12
// a new kanji is an intro card and two tests, a new word too (one test for the reading,
// one for the meaning), so a new kanji with its first word takes six (KR14)
export const CARDS_PER_NEW = 3
export const CARDS_PER_WORD = 3
// a further word waits until its home kanji was answered right once (KR29), a group until
// its counter has survived a review on a later day (KR76): a table is many words at once
export const WORD_UNLOCK_BOX = 1
export const GROUP_UNLOCK_BOX = 2

// a word as the plan sees it, a course word or a practiced word of a group
export interface PlanWord {
  id: string
  kanji: string[]  // item ids of the course kanji in it
  home: string     // item id of its home kanji
  first: boolean   // the first word of its home kanji
  special: boolean // a reading that can't be split over the kanji (KD14)
  group?: string   // the group id of a group word, which only comes in through its group
}

// a word group: the words that get practiced, in table order with the question word last
export interface PlanGroup {
  id: string
  home: string             // item id of the counter kanji
  words: PlanWord[]
  question: string | null  // the id of its question word, the last of `words`
}

export interface PlanCourse {
  kanji: string[]     // item ids in learning order
  words: PlanWord[]   // in course order: by home kanji, then teaching order, group words included
  groups: PlanGroup[]
}

type Lock = { unseen: string[]; review: boolean } | null

/**
 * What still keeps a word from coming in, null once nothing does: kanji of it not seen yet,
 * and for a further word a home kanji below WORD_UNLOCK_BOX. A first word only waits for its kanji.
 */
export function wordLock(w: PlanWord, stats: KanjiStatsMap): Lock {
  const unseen = w.kanji.filter(id => !isSeen(stats[id]))
  const review = !w.first && (stats[w.home]?.box ?? 0) < WORD_UNLOCK_BOX
  return unseen.length || review ? { unseen, review } : null
}

/**
 * What still keeps a group from opening (KR76): kanji of its practiced words not seen yet, a
 * counter below GROUP_UNLOCK_BOX. The question word doesn't hold the group back (its kanji for
 * "what" comes late in the course), it waits for its own kanji through wordLock like any word.
 */
export function groupLock(g: PlanGroup, stats: KanjiStatsMap): Lock {
  const members = g.words.filter(w => w.id !== g.question)
  const unseen = [...new Set(members.flatMap(w => w.kanji))].filter(id => !isSeen(stats[id]))
  const review = (stats[g.home]?.box ?? 0) < GROUP_UNLOCK_BOX
  return unseen.length || review ? { unseen, review } : null
}

/** A group has started once one of its practiced words has been answered, nothing else is stored. */
export const groupStarted = (g: PlanGroup, stats: KanjiStatsMap) => g.words.some(w => isSeen(stats[w.id]))

export interface KanjiPlan {
  due: string[]
  weak: string[]
  // new words that were waiting for kanji the learner has met: first words that didn't come
  // along with their kanji, the next words of groups already started, further words (KR29)
  waitingWords: string[]
  fresh: string[]                      // new kanji
  firstWords: Record<string, string>   // new kanji -> its first word, when that comes along
  // a group that opens: its card, then as many of its words as the limits allow (KR76)
  group: { id: string; words: string[] } | null
  fill: string[]
  // why nothing new comes although something is left: switched off, the picked sets have
  // nothing new, too many still settling, or the reviews fill the session. null when new
  // ones come or none are left
  newBlocked: 'off' | 'sets' | 'cap' | 'reviews' | null
  // kanji outside the picked sets, not seen yet, that words of the picked sets need: those
  // words only come once every set is in use. Empty without a pick
  outsideSets: string[]
}

/**
 * The next smart session over the kanji and words of `course` (KR28). `size` counts every
 * card. Each step takes what the steps before it left of the room:
 * 1. due reviews, lowest box and most overdue first
 * 2. weak items, by their recent error rate
 * 3. waiting words of kanji the learner has met, three cards each: first words left behind,
 *    the next words of groups already started, further words (special ones of a kanji last)
 * 4. a group opens only when nothing else waits: its card (one card, counts against no
 *    limit) and as many of its words as still fit, one group per session
 * 5. new kanji from `newIds` (the picked sets, in course order), each with its first word
 *    when the learner can read it by then: six cards, else three, and only when all fit.
 *    None while a further word of a kanji already met was left behind in step 3: the words
 *    carry the readings, so they keep up and the kanji wait (KD8)
 * 6. the items due next fill the rest
 * New words and new kanji have a limit of `newLimit` each (KR30), nothing new comes while
 * MAX_KANJI_LEARNING items are in box 0 or 1 (KR31). With sets picked, new words, groups and
 * kanji come from those sets only, a word or a group by its home kanji.
 */
export function planKanji(
  stats: KanjiStatsMap, log: KanjiAnswerRecord[], course: PlanCourse, size: number, now: number, newLimit: number,
  newIds: string[] = course.kanji,
): KanjiPlan {
  const ids = [...course.kanji, ...course.words.map(w => w.id)]
  const reviewable = ids.map(id => stats[id]).filter(isSeen)
  const taken = new Set<string>()
  const take = (list: KanjiStatEntry[], limit: number) => {
    const out = list.filter(e => !taken.has(e.id)).slice(0, Math.max(0, limit))
    out.forEach(e => taken.add(e.id))
    return out.map(e => e.id)
  }

  // 1. due reviews
  const due = take(reviewable.filter(e => isDue(e, now)).sort((a, b) => a.box - b.box || a.due - b.due), size)

  // 2. weak items
  const recent = recentErrors(log, r => r.id)
  const rate = (e: KanjiStatEntry) => {
    const r = recent.get(e.id)
    return r && r.answers >= 3 ? r.errors / r.answers : 0
  }
  const weak = take(reviewable.filter(e => rate(e) >= 0.3).sort((a, b) => rate(b) - rate(a)), size - due.length)

  const capped = reviewable.filter(e => e.box <= 1).length >= MAX_KANJI_LEARNING
  const limit = capped ? 0 : newLimit
  let room = size - due.length - weak.length

  // 3. waiting words of kanji the learner has met
  const picked = new Set(newIds)
  const position = new Map(course.kanji.map((id, i) => [id, i]))
  // not met yet and nothing keeps it back, whatever sets are picked
  const unlocked = (w: PlanWord) => !isSeen(stats[w.id]) && !wordLock(w, stats)
  const isOpen = (w: PlanWord) => picked.has(w.home) && unlocked(w)
  const open = course.words.filter(isOpen)
  const groups = course.groups.filter(g => picked.has(g.home)).sort((a, b) => position.get(a.home)! - position.get(b.home)!)
  const waiting = [
    ...open.filter(w => w.first),
    // a group that has begun goes on while its table is fresh
    ...groups.filter(g => groupStarted(g, stats)).flatMap(g => g.words.filter(isOpen)),
    // the special ones of a kanji after its regular ones (KD14), the sort is stable
    ...open.filter(w => !w.first && !w.group).sort((a, b) => position.get(a.home)! - position.get(b.home)! || Number(a.special) - Number(b.special)),
  ]
  const waitingWords = waiting.slice(0, Math.max(0, Math.min(limit, Math.floor(room / CARDS_PER_WORD)))).map(w => w.id)
  room -= waitingWords.length * CARDS_PER_WORD

  // 4. a group opens only when nothing else waits
  const opening = groups.find(g => !groupStarted(g, stats) && !groupLock(g, stats))
  const nothingElseWaits = waitingWords.length === waiting.length
  const wordsLeft = limit - waitingWords.length
  let group: KanjiPlan['group'] = null
  if (opening && nothingElseWaits && wordsLeft > 0 && room >= 1 + CARDS_PER_WORD) {
    const words = opening.words.filter(isOpen).slice(0, Math.min(wordsLeft, Math.floor((room - 1) / CARDS_PER_WORD))).map(w => w.id)
    group = { id: opening.id, words }
    room -= 1 + words.length * CARDS_PER_WORD
  }

  // 5. new kanji, unless words of met kanji are still waiting for their turn
  const wordsBehind = waiting.some(w => !w.group && !waitingWords.includes(w.id))
  const fresh: string[] = []
  const firstWords: Record<string, string> = {}
  const met = new Set(reviewable.map(e => e.id))
  for (const id of newIds) {
    if (wordsBehind || fresh.length >= limit) break
    if (isSeen(stats[id])) continue
    const first = course.words.find(w => w.home === id && w.first)
    // its other kanji met before or new earlier in this session
    const withWord = !!first && !isSeen(stats[first.id]) && first.kanji.every(k => k === id || met.has(k))
    const cost = CARDS_PER_NEW + (withWord ? CARDS_PER_WORD : 0)
    // a kanji only starts when all of its cards fit, the next one in line doesn't jump ahead
    if (cost > room) break
    fresh.push(id)
    if (withWord) firstWords[id] = first.id
    met.add(id)
    room -= cost
  }

  // 6. fill
  const fill = take([...reviewable].sort((a, b) => a.due - b.due), room)

  const outsideSets = [...new Set(course.words
    .filter(w => picked.has(w.home) && !isSeen(stats[w.id]))
    .flatMap(w => w.kanji.filter(k => !picked.has(k) && !isSeen(stats[k]))))]

  let newBlocked: KanjiPlan['newBlocked'] = null
  const somethingLeft = course.kanji.some(id => !isSeen(stats[id]))
    || course.words.some(w => !w.group && unlocked(w))
    || course.groups.some(g => (groupStarted(g, stats) || !groupLock(g, stats)) && g.words.some(unlocked))
  if (fresh.length === 0 && waitingWords.length === 0 && !group && somethingLeft) {
    if (newLimit === 0) newBlocked = 'off'
    else if (newIds.every(id => isSeen(stats[id])) && waiting.length === 0 && !opening) newBlocked = 'sets'
    else if (capped) newBlocked = 'cap'
    // something of the picked sets is ready, it just didn't fit next to the reviews
    else newBlocked = 'reviews'
  }

  return { due, weak, waitingWords, fresh, firstWords, group, fill, newBlocked, outsideSets }
}

/** How many cards the plan makes. */
export function planCards(p: KanjiPlan): number {
  return p.due.length + p.weak.length + p.fill.length + p.fresh.length * CARDS_PER_NEW
    + (p.waitingWords.length + Object.keys(p.firstWords).length) * CARDS_PER_WORD
    + (p.group ? 1 + p.group.words.length * CARDS_PER_WORD : 0)
}

/** Item ids of the kanji in the picked sets, in course order: the custom quiz and the source of new kanji. */
export function pickedKanjiIds(sets: KanjiSetEntry[], picked: Set<string>): string[] {
  return sets.filter(s => picked.has(s.id)).flatMap(s => s.kanji.map(kanjiId))
}

/** The words of the kanji in `kanjiIds` the learner has met, in course order: the custom quiz in a word mode (KR47). */
export function pickedWordIds(kanjiIds: string[], words: PlanWord[], stats: KanjiStatsMap): string[] {
  const picked = new Set(kanjiIds)
  return words.filter(w => picked.has(w.home) && isSeen(stats[w.id])).map(w => w.id)
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
