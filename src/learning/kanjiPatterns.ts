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
  round: { confusions: 1, habit: 2, setSeen: 3, setErrors: 2 },
  all:   { confusions: 2, habit: 3, setSeen: 5, setErrors: 3 },
}

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
// a mix-up of two kanji that both sit again, or a reading habit, is history after this long without a miss
const FRESH_MS = 30 * DAY_MS
const MAX_PATTERNS = 6
// the reading gap sentence names this many kanji, then "and n more"
const MAX_NAMED = 4
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
// swaps one kanji for another. A pair counts while one of the two (met by the learner) is
// below the mastered box or was missed in the last 30 days, else it is history. In a round a pair needs a lookalike
// group or two kanji the learner has met: one stray wrong option is no mix-up
function confusions(
  entries: KanjiStatEntry[], all: KanjiStatsMap, course: PatternCourse, scope: PatternScope, now: number,
): KanjiPattern[] {
  const min = THRESHOLDS[scope].confusions
  // a kanji never met doesn't keep a pair alive, it was only a wrong option
  const live = (id: string) => {
    const e = all[id]
    return isSeen(e) && (e.box < MASTERED_BOX || e.lastWrong >= now - FRESH_MS)
  }
  const related = (a: string, b: string) => course.lookalikes(a).includes(b) || (isSeen(all[a]) && isSeen(all[b]))
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
    if (count < min || !ta || !tb || !(live(a) || live(b))) continue
    if (scope === 'round' && !related(a, b)) continue
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

// Counted over all words from the typed readings of the last 30 days in the log, and only a
// habit once it shows in two words or more. A wrong pick on a choice card doesn't count: its
// options are near misses by construction, that is a guess, not a habit
function readingHabits(log: KanjiAnswerRecord[], course: PatternCourse, scope: PatternScope, now: number): KanjiPattern[] {
  const out: KanjiPattern[] = []
  const typed = log.filter(r => r.type === 'read-type' && r.mistake && r.t >= now - FRESH_MS && course.text(r.id) !== null)
  for (const [kind, title, sentence] of HABITS) {
    const hits = typed.filter(r => r.mistake === kind)
    const words = [...new Set(hits.map(r => r.id))]
    if (words.length < 2 || hits.length < THRESHOLDS[scope].habit) continue
    out.push({
      kind: 'reading-habit', title,
      detail: [en(`${sentence} ${hits.length}× ${scope === 'round' ? 'this round' : 'in the last 30 days'}, in ${words.length} words.`)],
      chips: words.map(id => course.text(id)!),
      severity: 5 + hits.length,
      practice: words,
      mode: 'read-choice',
    })
  }
  return out
}

const readingOf = (e: KanjiStatEntry | undefined) => sum([e?.byType['read-choice'], e?.byType['read-type']])

// KR39: the meaning of a kanji sits (mastered, or its meaning and recognize questions mostly
// right) while the readings of its words mostly go wrong
function readingGap(stats: KanjiStatsMap, entries: KanjiStatEntry[], course: PatternCourse): KanjiPattern[] {
  // answers per side, the kana direction gap bar over everything
  const typeSeen = 3
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
  const more = kanji.length - MAX_NAMED
  return [{
    kind: 'reading-gap',
    title: [en('Meaning sits, reading not yet')],
    detail: [
      en('You know what '), ja(kanji.slice(0, MAX_NAMED).join('・')),
      ...(more > 0 ? [en(` and ${more} more`)] : []),
      en(one ? ' means, but its words are not read right yet' : ' mean, but their words are not read right yet'),
    ],
    chips: [...words].map(id => course.text(id)!),
    severity: 4 + kanji.length,
    practice: [...words],
    mode: 'read-choice',
  }]
}

// KR40: a set clearly worse than the learner's level, kanji and words of it together; one
// bad item alone is not a weak set. A set still being learned (half its items or more in box
// 0 or 1) always looks bad against the lifetime average, it waits
function weakSets(
  entries: KanjiStatEntry[], all: KanjiStatsMap, course: PatternCourse, t: typeof THRESHOLDS.all, overall: number,
): KanjiPattern[] {
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
    const answers = sum(items)
    const n = seenCount(answers)
    const learning = items.filter(e => (all[e.id]?.box ?? 0) <= 1).length
    if (n < t.setSeen || answers.incorrect < t.setErrors || items.filter(e => e.incorrect > 0).length < 2) continue
    if (acc(answers) > overall - 0.15 || learning * 2 >= items.length) continue
    out.push({
      kind: 'weak-set',
      title: [en(`Weak set: ${title}`)],
      detail: [en(`${answers.incorrect} of ${n} answers wrong, ${pct(acc(answers))} right against ${pct(overall)} overall`)],
      chips: items.map(e => course.text(e.id)!),
      severity: 5 + answers.incorrect,
      practice: items.map(e => e.id),
    })
  }
  return out
}

// KR41: missed this week while it sat in the mastered box or above, by the box the log
// record keeps. One miss is enough: an item that sits comes up every few days at most.
// Records from before the box was kept don't count
function slipping(log: KanjiAnswerRecord[], course: PatternCourse, now: number): KanjiPattern[] {
  const ids = [...new Set(log
    .filter(r => !r.correct && r.t >= now - WEEK_MS && (r.box ?? -1) >= MASTERED_BOX && course.text(r.id) !== null)
    .map(r => r.id))]
  if (!ids.length) return []
  return [{
    kind: 'slipping',
    title: [en('Slipping')],
    detail: [en('Mastered before, but missed again this week')],
    chips: ids.map(id => course.text(id)!),
    severity: 7 + ids.length,
    practice: ids,
  }]
}

/**
 * Up to six pattern cards, most useful first. For the scope 'all' `stats` and `log` are
 * everything. For 'round' they are the answers of one round (`stats` built by
 * kanjiStatsFromLog), and `all` is the full stats: boxes and what the learner has met. The
 * reading gap and Slipping only run for 'all': one round can't show either.
 */
export function detectKanjiPatterns(
  stats: KanjiStatsMap, log: KanjiAnswerRecord[], scope: PatternScope, course: PatternCourse, now: number = Date.now(),
  all: KanjiStatsMap = stats,
): KanjiPattern[] {
  const t = THRESHOLDS[scope]
  const entries = Object.values(stats).filter(e => isSeen(e) && course.text(e.id) !== null)
  if (!entries.length) return []
  const overall = acc(sum(entries))
  const found = [
    ...confusions(entries, all, course, scope, now),
    ...readingHabits(log, course, scope, now),
    ...(scope === 'all' ? readingGap(stats, entries, course) : []),
    ...weakSets(entries, all, course, t, overall),
    ...(scope === 'all' ? slipping(log, course, now) : []),
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
