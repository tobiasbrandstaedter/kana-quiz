import type { AnswerRecord, KanaPair, ScriptName, StatEntry, StatsMap } from '../types'
import { pairFor } from '../data/kana'
import { shuffle } from './distractors'

// Leitner boxes. The interval is how long a kana rests after being promoted into that box.
const DAY = 24 * 60 * 60 * 1000
const INTERVALS = [0, 1, 3, 7, 14, 30].map(d => d * DAY)
export const MAX_BOX = INTERVALS.length - 1
export const MASTERED_BOX = 3

// reviews done a few hours early still count, nobody studies at the exact same time every day
const DUE_SLACK = 4 * 60 * 60 * 1000

const NEW_PER_SESSION = 5
// too many shaky kana: stop adding new ones until those settle
const MAX_LEARNING = 10
const RECENT_WINDOW = 10

export interface Schedule {
  box: number
  due: number
}

export function isDue(s: Schedule, now: number): boolean {
  return now >= s.due - DUE_SLACK
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

/** Errors per kana within its last RECENT_WINDOW answers in the log. */
export function recentErrors(log: AnswerRecord[]): Map<string, { errors: number; answers: number }> {
  const out = new Map<string, { errors: number; answers: number }>()
  for (let i = log.length - 1; i >= 0; i--) {
    const r = log[i]
    const m = out.get(r.kana) ?? { errors: 0, answers: 0 }
    if (m.answers >= RECENT_WINDOW) continue
    m.answers++
    if (!r.correct) m.errors++
    out.set(r.kana, m)
  }
  return out
}

export interface SmartPicks {
  due: KanaPair[]
  weak: KanaPair[]
  fresh: KanaPair[]
  fill: KanaPair[]
}

function seen(e: StatEntry): boolean {
  return e.correct + e.incorrect > 0
}

/**
 * What a smart session should contain, in priority order: due reviews (lowest box,
 * most overdue first), kana with a high recent error rate, a few new kana from
 * `candidates` in table order, then the kana due next to fill up.
 */
export function pickSmart(
  stats: StatsMap,
  log: AnswerRecord[],
  candidates: KanaPair[],
  scripts: ScriptName[],
  size: number,
  now: number,
): SmartPicks {
  const reviewable = Object.values(stats).filter(e => seen(e) && scripts.includes(e.script) && pairFor(e.kana))
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

  const recent = recentErrors(log)
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
  const freshLimit = learning >= MAX_LEARNING ? 0 : Math.min(NEW_PER_SESSION, Math.floor(room / 2))
  const fresh = candidates
    .filter(p => scripts.includes(p.script) && !(stats[p.kana] && seen(stats[p.kana])))
    .filter((p, i, arr) => arr.findIndex(q => q.kana === p.kana) === i)
    .slice(0, freshLimit)

  const fill = take(
    [...reviewable].sort((a, b) => a.due - b.due),
    room - fresh.length * 2,
  )

  return { due, weak, fresh, fill }
}

export interface PlannedItem {
  pair: KanaPair
  intro: boolean
}

/**
 * Lay the picks out as a question list. Reviews are spread evenly. Each new kana
 * gets an intro card, a test shortly after and one more later, interleaved with
 * the other new kana so the user doesn't just echo what they saw a second ago.
 */
export function orderSession(picks: SmartPicks, rng: () => number = Math.random): PlannedItem[] {
  const reviews = shuffle([...picks.due, ...picks.weak, ...picks.fill], rng)
  const total = reviews.length + picks.fresh.length * 3
  const slots: Array<{ pos: number; item: PlannedItem }> = []

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
    if (!e || !seen(e)) continue
    p.seen++
    if (e.box >= MASTERED_BOX) p.mastered++
    if (isDue(e, now)) p.due++
  }
  return p
}
