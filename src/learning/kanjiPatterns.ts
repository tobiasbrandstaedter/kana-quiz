// Pattern cards for kanji and words (KR37 to KR41), the kanji twin of patterns.ts. The rules
// work on item ids and a PatternCourse, kanjiCards.ts binds the real course to it.
import type { DirectionStat, KanjiAnswerRecord, KanjiMode, KanjiStatEntry, KanjiStatsMap, QuestionType, ReadingKind } from '../types'
import { kanjiOfId } from '../kanjiKeys'
import { applyKanjiAnswer } from './kanjiStats'
import { isSeen, MASTERED_BOX } from './scheduler'
import { kanjiQuestionType } from './kanjiQuiz'
import { wordQuestionType } from './wordQuiz'
import { spreadCards } from './kanjiSession'
import type { PlannedCard } from './kanjiSession'
import { shuffle } from './distractors'

export type KanjiPatternKind = 'confusion' | 'reading-habit' | 'reading-gap' | 'weak-set' | 'slipping'

// A card's text is English with the Japanese parts as pieces of their own, so the screen can
// mark them lang="ja" (KR57) and no kanji ends up inside an English string
export interface Piece { text: string; ja?: boolean }

export interface KanjiPattern {
  kind: KanjiPatternKind
  title: Piece[]
  detail: Piece[]
  chips: string[]      // kanji and written forms shown under the text
  severity: number
  practice: string[]   // item ids
  // the question type the pattern is about, picked by the box the way that mode picks it
  mode?: 'recognize' | 'read-choice'
}

export interface PatternCourse {
  text: (id: string) => string | null                         // the kanji or the written form, null for an id the course lacks
  setOf: (id: string) => { id: string; title: string } | null  // a word by its home kanji
  lookalikes: (kanjiId: string) => string[]                    // item ids
  hint: (a: string, b: string) => string | null                // lookalike hint of two kanji ids
  wordsWith: (kanjiId: string) => string[]                     // practiced words that have the kanji
  swap: (wordId: string, form: string) => [string, string] | null  // a wrong form: the right kanji id and the one put in
}

export type PatternScope = 'round' | 'all'

// Where a rule is the same idea as for kana, the bar is the kana one. A round has few
// answers per item, so its bars are lower, as for kana.
const THRESHOLDS = {
  round: { confusions: 1, habit: 2, setSeen: 3, setErrors: 2, typeSeen: 2 },
  all:   { confusions: 2, habit: 3, setSeen: 5, setErrors: 3, typeSeen: 3 },
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MAX_PATTERNS = 6
// pattern practice asks every item twice while that stays this short, else once
const MAX_CARDS = 16

const en = (text: string): Piece => ({ text })
const ja = (text: string): Piece => ({ text, ja: true })

const JAPANESE = /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々・]+)/u

/** A hand written text as pieces, its kanji and kana marked as Japanese. */
export function jaPieces(text: string): Piece[] {
  return text.split(JAPANESE).filter(Boolean).map(part => JAPANESE.test(part) ? ja(part) : en(part))
}

const seenCount = (e: { correct: number; incorrect: number }) => e.correct + e.incorrect
const acc = (e: { correct: number; incorrect: number }) => seenCount(e) > 0 ? e.correct / seenCount(e) : 0
const pct = (x: number) => `${Math.round(x * 100)}%`
const isKanji = (id: string) => kanjiOfId(id) !== null

function sum(stats: Array<DirectionStat | undefined>): DirectionStat {
  return {
    correct: stats.reduce((n, d) => n + (d?.correct ?? 0), 0),
    incorrect: stats.reduce((n, d) => n + (d?.incorrect ?? 0), 0),
  }
}

/** Stats from a slice of the answer log, one session say, so it can be read the same way. Boxes stay at 0. */
export function kanjiStatsFromLog(records: KanjiAnswerRecord[]): KanjiStatsMap {
  const out: KanjiStatsMap = {}
  for (const r of records) out[r.id] = applyKanjiAnswer(out[r.id], { ...r, holdBox: true }, r.t)
  return out
}

// KR37: a kanji picked for another, both ways merged. A wrong written form counts too, it
// swaps one kanji for another
function confusions(entries: KanjiStatEntry[], course: PatternCourse, min: number): KanjiPattern[] {
  const merged = new Map<string, { a: string; b: string; count: number }>()
  const add = (x: string, y: string, n: number) => {
    if (x === y) return
    const [a, b] = [x, y].sort()
    const m = merged.get(a + b) ?? { a, b, count: 0 }
    m.count += n
    merged.set(a + b, m)
  }
  for (const e of entries) {
    for (const [given, n] of Object.entries(e.confusions)) {
      if (isKanji(e.id)) {
        if (isKanji(given)) add(e.id, given, n)
        continue
      }
      const swap = course.swap(e.id, given)
      if (swap) add(swap[0], swap[1], n)
    }
  }
  const out: KanjiPattern[] = []
  for (const { a, b, count } of merged.values()) {
    const [ta, tb] = [course.text(a), course.text(b)]
    if (count < min || !ta || !tb) continue
    const hint = course.hint(a, b)
    out.push({
      kind: 'confusion',
      title: [ja(ta), en(' vs '), ja(tb)],
      detail: hint ? [en(`Mixed up ${count}×. `), ...jaPieces(hint)] : [en(`Mixed up ${count}×`)],
      chips: [ta, tb],
      severity: 10 + count,
      practice: [...new Set([a, b, ...course.lookalikes(a), ...course.lookalikes(b)])],
      mode: 'recognize',
    })
  }
  return out
}

// KR38, the kinds that are habits; another reading of a kanji is about that kanji, not a habit
const HABITS: Array<[Exclude<ReadingKind, 'other-reading'>, Piece[], string]> = [
  ['long-vowel', [en('Long vowels')], 'A vowel held too long or too short.'],
  ['vowel-kana', [en('Long vowel spelling')], 'A long vowel held with the wrong kana.'],
  ['small-tsu', [en('Small '), ja('っ')], 'The short stop before a sound added or left out.'],
  ['voicing', [en('Voicing marks')], 'A sound voiced or unvoiced where the word has it the other way.'],
]

// counted over all words, and only a habit once it shows in two words or more
function readingHabits(entries: KanjiStatEntry[], course: PatternCourse, scope: PatternScope): KanjiPattern[] {
  const out: KanjiPattern[] = []
  for (const [kind, title, sentence] of HABITS) {
    const words = entries.filter(e => !isKanji(e.id) && (e.mistakes[kind] ?? 0) > 0)
    const total = words.reduce((n, e) => n + (e.mistakes[kind] ?? 0), 0)
    if (words.length < 2 || total < THRESHOLDS[scope].habit) continue
    out.push({
      kind: 'reading-habit', title,
      detail: [en(`${sentence} ${total}× ${scope === 'round' ? 'this round' : 'so far'}, in ${words.length} words.`)],
      chips: words.map(e => course.text(e.id)!),
      severity: 5 + total,
      practice: words.map(e => e.id),
      mode: 'read-choice',
    })
  }
  return out
}

const readingOf = (e: KanjiStatEntry | undefined) => sum([e?.byType['read-choice'], e?.byType['read-type']])

// KR39: the meaning of a kanji sits (mastered, or its meaning and recognize questions mostly
// right) while the readings of its words mostly go wrong
function readingGap(stats: KanjiStatsMap, entries: KanjiStatEntry[], course: PatternCourse, typeSeen: number): KanjiPattern[] {
  const kanji: string[] = []
  const words = new Set<string>()
  for (const k of entries) {
    if (!isKanji(k.id)) continue
    const meaning = sum([k.byType.meaning, k.byType.recognize])
    if (k.box < MASTERED_BOX && (seenCount(meaning) < typeSeen || acc(meaning) < 0.8)) continue
    const own = course.wordsWith(k.id).filter(id => seenCount(readingOf(stats[id])) > 0)
    const reading = sum(own.map(id => readingOf(stats[id])))
    if (seenCount(reading) < typeSeen || acc(reading) > 0.5) continue
    kanji.push(course.text(k.id)!)
    for (const id of own) if (acc(readingOf(stats[id])) <= 0.5) words.add(id)
  }
  if (!kanji.length) return []
  const one = kanji.length === 1
  return [{
    kind: 'reading-gap',
    title: [en('Meaning sits, reading not yet')],
    detail: [
      en('You know what '), ja(kanji.join('・')),
      en(one ? ' means, but its words are not read right yet' : ' mean, but their words are not read right yet'),
    ],
    chips: [...words].map(id => course.text(id)!),
    severity: 4 + kanji.length,
    practice: [...words],
    mode: 'read-choice',
  }]
}

// KR40: a set clearly worse than the learner's level, kanji and words of it together; one
// bad item alone is not a weak set
function weakSets(entries: KanjiStatEntry[], course: PatternCourse, t: typeof THRESHOLDS.all, overall: number): KanjiPattern[] {
  const sets = new Map<string, { title: string; items: KanjiStatEntry[] }>()
  for (const e of entries) {
    const set = course.setOf(e.id)
    if (!set) continue
    const s = sets.get(set.id) ?? { title: set.title, items: [] }
    s.items.push(e)
    sets.set(set.id, s)
  }
  const out: KanjiPattern[] = []
  for (const { title, items } of sets.values()) {
    const all = sum(items)
    const n = seenCount(all)
    if (n < t.setSeen || all.incorrect < t.setErrors || items.filter(e => e.incorrect > 0).length < 2 || acc(all) > overall - 0.15) continue
    out.push({
      kind: 'weak-set',
      title: [en(`Weak set: ${title}`)],
      detail: [en(`${all.incorrect} of ${n} wrong (${pct(acc(all))}), overall ${pct(overall)}`)],
      chips: items.map(e => course.text(e.id)!),
      severity: 5 + all.incorrect,
      practice: items.map(e => e.id),
    })
  }
  return out
}

// KR41: usually right and missed again this week. Five answers at 80 % is about what an item
// has once it reached the mastered box. One miss is enough: a kanji or word that sits only
// comes up every few days, a second miss within the week is rare
function slipping(entries: KanjiStatEntry[], log: KanjiAnswerRecord[], course: PatternCourse, now: number): KanjiPattern[] {
  const missed = new Set(log.filter(r => !r.correct && r.t >= now - WEEK_MS).map(r => r.id))
  const hits = entries.filter(e => seenCount(e) >= 5 && acc(e) >= 0.8 && missed.has(e.id))
  if (!hits.length) return []
  return [{
    kind: 'slipping',
    title: [en('Slipping')],
    detail: [en('Usually right, but missed again this week')],
    chips: hits.map(e => course.text(e.id)!),
    severity: 7 + hits.length,
    practice: hits.map(e => e.id),
  }]
}

/**
 * Up to six pattern cards, most useful first. `stats` is everything for the scope 'all', or
 * built by kanjiStatsFromLog from the answers of one round for 'round'. Slipping looks at the
 * last week and needs the full stats, it only runs for 'all', as for kana.
 */
export function detectKanjiPatterns(
  stats: KanjiStatsMap, log: KanjiAnswerRecord[], scope: PatternScope, course: PatternCourse, now: number = Date.now(),
): KanjiPattern[] {
  const t = THRESHOLDS[scope]
  const entries = Object.values(stats).filter(e => isSeen(e) && course.text(e.id) !== null)
  if (!entries.length) return []
  const overall = acc(sum(entries))
  const found = [
    ...confusions(entries, course, t.confusions),
    ...readingHabits(entries, course, scope),
    ...readingGap(stats, entries, course, t.typeSeen),
    ...weakSets(entries, course, t, overall),
    ...(scope === 'all' ? slipping(entries, log, course, now) : []),
  ]
  return found.sort((a, b) => b.severity - a.severity).slice(0, MAX_PATTERNS)
}

/**
 * The session for a pattern card: its items the learner has met (nothing gets an intro), twice
 * each while that stays at MAX_CARDS (a single item once), shuffled and spread. With a mode the question type is
 * fixed by the box the way that mode picks it, else the session's mode decides as for any card.
 */
export function patternCards(p: KanjiPattern, stats: KanjiStatsMap, rng: () => number = Math.random): PlannedCard[] {
  const ids = p.practice.filter(id => isSeen(stats[id]))
  // one item twice would come back to back, the second answer then proves nothing
  const passes = ids.length > 1 && ids.length * 2 <= MAX_CARDS ? 2 : 1
  const typeOf = (id: string, mode: KanjiMode): QuestionType =>
    isKanji(id) ? kanjiQuestionType(stats[id], mode, rng) : wordQuestionType(stats[id], mode, rng)
  const cards = Array.from({ length: passes }, () => shuffle(ids, rng)).flat()
    .map((id): PlannedCard => p.mode ? { id, type: typeOf(id, p.mode) } : { id })
  return spreadCards(cards)
}
