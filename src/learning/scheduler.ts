import type { AnswerRecord, KanaPair, QuizDirection, ScriptName, StatEntry, StatsMap } from '../types'
import { pairFor } from '../data/kana'
import { lookalikesOf } from '../data/lookalikes'
import { shuffle } from './distractors'

// Leitner boxes. The interval is how long a kana rests after being promoted into that box.
const DAY = 24 * 60 * 60 * 1000
const INTERVALS = [0, 1, 3, 7, 14, 30].map(d => d * DAY)
export const MAX_BOX = INTERVALS.length - 1
export const MASTERED_BOX = 3

// reviews done a few hours early still count, nobody studies at the exact same time every day
const DUE_SLACK = 4 * 60 * 60 * 1000

export const NEW_PER_SESSION = 5
// too many shaky kana: stop adding new ones until those settle
export const MAX_LEARNING = 10
const RECENT_WINDOW = 10

export interface Schedule {
  box: number
  due: number
}

/** When a kana starts to count as due. Texts like "next review in 3 h" use this too, so they agree with the due dots. */
export function dueAt(s: Schedule): number {
  return s.due - DUE_SLACK
}

export function isDue(s: Schedule, now: number): boolean {
  return now >= dueAt(s)
}

/**
 * Wrong answers drop back to box 0. Correct answers only promote when the kana
 * was actually due, so answering it five times in one sitting doesn't fake mastery.
 */
export function review(s: Schedule, correct: boolean, now: number): Schedule {
  if (!correct) return { box: 0, due: now }
  if (!isDue(s, now)) return s
  const box = Math.min(MAX_BOX, s.box + 1)
  return { box, due: now + INTERVALS[box] }
}

/** Errors per item within its last RECENT_WINDOW answers in the log. `idOf` says which item a record is about. */
export function recentErrors<R extends { correct: boolean }>(log: R[], idOf: (r: R) => string): Map<string, { errors: number; answers: number }> {
  const out = new Map<string, { errors: number; answers: number }>()
  for (let i = log.length - 1; i >= 0; i--) {
    const r = log[i]
    const id = idOf(r)
    const m = out.get(id) ?? { errors: 0, answers: 0 }
    if (m.answers >= RECENT_WINDOW) continue
    m.answers++
    if (!r.correct) m.errors++
    out.set(id, m)
  }
  return out
}

export interface SmartPicks<T = KanaPair> {
  due: T[]
  weak: T[]
  fresh: T[]
  fill: T[]
}

/** Answered at least once. An entry can exist without that, e.g. after a migration. */
export function isSeen<E extends { correct: number; incorrect: number }>(e: E | undefined): e is E {
  return !!e && e.correct + e.incorrect > 0
}

// lookalikes that are both new go next to each other, so the second intro card
// comes right after the first and the difference is fresh
function groupLookalikes(pairs: KanaPair[]): KanaPair[] {
  const out: KanaPair[] = []
  for (const p of pairs) {
    if (out.includes(p)) continue
    out.push(p)
    for (const k of lookalikesOf(p.kana)) {
      const twin = pairs.find(q => q.kana === k)
      if (twin && !out.includes(twin)) out.push(twin)
    }
  }
  return out
}

/**
 * What a smart session should contain, in priority order: due reviews (lowest box,
 * most overdue first), kana with a high recent error rate, up to `newLimit` new kana
 * from `candidates` in table order, then the kana due next to fill up.
 */
export function pickSmart(
  stats: StatsMap,
  log: AnswerRecord[],
  candidates: KanaPair[],
  scripts: ScriptName[],
  size: number,
  now: number,
  newLimit: number = NEW_PER_SESSION,
): SmartPicks {
  const reviewable = Object.values(stats).filter(e => isSeen(e) && scripts.includes(e.script) && pairFor(e.kana))
  const toPair = (e: StatEntry) => pairFor(e.kana)!
  const taken = new Set<string>()
  const take = (list: StatEntry[], limit: number) => {
    const out = list.filter(e => !taken.has(e.kana)).slice(0, Math.max(0, limit))
    out.forEach(e => taken.add(e.kana))
    return out.map(toPair)
  }

  const due = take(
    reviewable.filter(e => isDue(e, now)).sort((a, b) => a.box - b.box || a.due - b.due),
    size,
  )

  const recent = recentErrors(log, r => r.kana)
  const rate = (e: StatEntry) => {
    const r = recent.get(e.kana)
    return r && r.answers >= 3 ? r.errors / r.answers : 0
  }
  const weak = take(
    reviewable.filter(e => rate(e) >= 0.3).sort((a, b) => rate(b) - rate(a)),
    size - due.length,
  )

  // a new kana takes about two question slots (intro is free, it gets tested twice)
  const learning = reviewable.filter(e => e.box <= 1).length
  const room = size - due.length - weak.length
  const freshLimit = learning >= MAX_LEARNING ? 0 : Math.min(newLimit, Math.floor(room / 2))
  const fresh = groupLookalikes(candidates
    .filter(p => scripts.includes(p.script) && !isSeen(stats[p.kana]))
    .filter((p, i, arr) => arr.findIndex(q => q.kana === p.kana) === i)
    .slice(0, freshLimit))

  const fill = take(
    [...reviewable].sort((a, b) => a.due - b.due),
    room - fresh.length * 2,
  )

  return { due, weak, fresh, fill }
}

export interface PlannedItem<T = KanaPair> {
  pair: T
  intro: boolean
}

/**
 * Lay the picks out as a question list. Reviews are spread evenly. Each new kana
 * gets an intro card, a test shortly after and one more later, interleaved with
 * the other new kana so the user doesn't just echo what they saw a second ago.
 */
export function orderSession<T>(picks: SmartPicks<T>, rng: () => number = Math.random): PlannedItem<T>[] {
  const reviews = shuffle([...picks.due, ...picks.weak, ...picks.fill], rng)
  const total = reviews.length + picks.fresh.length * 3
  const slots: Array<{ pos: number; item: PlannedItem<T> }> = []

  reviews.forEach((pair, i) => {
    slots.push({ pos: (i + 0.5) * total / Math.max(1, reviews.length), item: { pair, intro: false } })
  })
  // intros two slots apart, first test 2.5 after: the next intro always lands in between
  picks.fresh.forEach((pair, j) => {
    const start = j * 2
    slots.push({ pos: start,       item: { pair, intro: true } })
    slots.push({ pos: start + 2.5, item: { pair, intro: false } })
    slots.push({ pos: start + 6.5, item: { pair, intro: false } })
  })

  // Array.prototype.sort is stable, so ties keep insertion order
  return slots.sort((a, b) => a.pos - b.pos).map(s => s.item)
}

// other cards between a miss and its re-ask, so it isn't answered from short term memory
export const REASK_GAP = 2

/**
 * Where a missed kana comes back in the running session. `queue` is the kana per card,
 * `current` the card that was just missed. Returns the index to insert at and how many
 * other cards have to go in front of it: close to the end, or right behind another card
 * of the same kana, the re-ask would come while the answer is still fresh.
 */
export function reaskSlot(queue: string[], current: number, kana: string, offset: number): { index: number; pad: number } {
  let index = Math.min(current + offset, queue.length)
  while (index < queue.length && (queue[index] === kana || queue[index - 1] === kana)) index++
  const behindSameKana = index - 1 !== current && queue[index - 1] === kana
  return { index, pad: Math.max(REASK_GAP - (index - current - 1), behindSameKana ? 1 : 0) }
}

const MAX_REASKS = 2

/**
 * How a missed item comes back: 3 to 6 cards later, at most MAX_REASKS times per session
 * (`reasked` is how often it already came back). `candidates` are the ids of the round that
 * may go in front of it as padding, `pad` says which ones the caller has to insert before
 * the re-ask at `index`. Null when the re-ask is dropped: asked back often enough, or too
 * few other items left to pad with, it is due next session anyway.
 */
export function planReask(
  queue: string[], current: number, id: string, candidates: string[], reasked: number,
  rng: () => number = Math.random,
): { index: number; pad: string[] } | null {
  if (reasked >= MAX_REASKS) return null
  const { index, pad } = reaskSlot(queue, current, id, 3 + Math.floor(rng() * 4))
  const others = shuffle([...new Set(candidates.filter(c => c !== id))], rng).slice(0, pad)
  if (others.length < pad) return null
  return { index, pad: others }
}

export interface ColumnProgress {
  total: number
  seen: number
  mastered: number
  due: number
}

export function columnProgress(kana: string[], stats: StatsMap, now: number): ColumnProgress {
  const p = { total: kana.length, seen: 0, mastered: 0, due: 0 }
  for (const k of kana) {
    const e = stats[k]
    if (!isSeen(e)) continue
    p.seen++
    if (e.box >= MASTERED_BOX) p.mastered++
    if (isDue(e, now)) p.due++
  }
  return p
}

export interface DueOutlook {
  now: number      // due right now
  soon: number     // due within the next day, not yet due
  nextAt: number   // ms epoch when the next kana becomes due, 0 if none is waiting
}

/** For the "all caught up" message: what comes back and when, over the entries in play. */
export function dueOutlook(entries: Array<Schedule & { correct: number; incorrect: number }>, now: number): DueOutlook {
  const out = { now: 0, soon: 0, nextAt: 0 }
  for (const e of entries) {
    if (!isSeen(e)) continue
    if (isDue(e, now)) { out.now++; continue }
    const at = dueAt(e)
    if (at <= now + DAY) out.soon++
    if (!out.nextAt || at < out.nextAt) out.nextAt = at
  }
  return out
}

/**
 * Mixed mode picks the direction by how well a kana is known: recognize it first,
 * then read it, then write it. Past box 2 it goes for a direction never answered right.
 */
export function mixedDirection(e: StatEntry | undefined, rng: () => number = Math.random): QuizDirection {
  if (!isSeen(e) || e.box <= 1) return 'romaji-to-kana'
  if (e.box === 2) return 'kana-to-romaji'
  const dirs: QuizDirection[] = ['draw', 'kana-to-romaji', 'romaji-to-kana']
  const missing = dirs.filter(d => !e.byDirection[d]?.correct)
  if (missing.length) return missing[0]
  return dirs[Math.floor(rng() * dirs.length)]
}
