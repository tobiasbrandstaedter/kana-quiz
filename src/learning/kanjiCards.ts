// Cards over the course content: the course as the plan sees it, what an item id stands for,
// the card for a planned item with its options, and what an option means per question type.
// Reads kanjiData, holds no state.
import type { ItemInfo, KanjiCard, KanjiMode, KanjiStatsMap } from '../types'
import {
  allKanji, courseWords, kanjiEntry, kanjiLookalikes, kanjiReadings, kanjiWithReading, ownWords, tooClose, wordById,
} from '../data/kanjiData'
import { kanjiId, kanjiOfId } from '../kanjiKeys'
import type { PlanCourse, PlannedCard } from './kanjiPlan'
import { confusedKanji } from './kanjiStats'
import { kanjiQuestionType, makeKanjiCard, pickKanjiOptions } from './kanjiQuiz'
import { isWordType, pickMeaningOptions, pickReadingOptions, pickSpellOptions, wordQuestionType } from './wordQuiz'
import { readingMistake } from './readings'
import type { ReadingMistake } from './readings'
import { shuffle } from './distractors'

const KANJI = allKanji()
const WORDS = courseWords()

/** Every kanji and course word as the plan works with them. */
export const PLAN_COURSE: PlanCourse = {
  kanji: KANJI.map(k => k.id),
  words: KANJI.flatMap(k => ownWords(k.kanji).map((w, i) => ({
    id: w.id, kanji: w.kanji.map(kanjiId), home: k.id, first: i === 0, special: w.special,
  }))),
}

/** What an item id stands for, null for an id the course doesn't have (any more). */
export function itemInfo(id: string): ItemInfo | null {
  const kanji = kanjiOfId(id)
  if (kanji) {
    const k = kanjiEntry(kanji)
    return k && { id, kind: 'kanji', text: k.kanji, meaning: k.keyword, reading: '', home: k.kanji }
  }
  const w = wordById(id)
  return w && { id, kind: 'word', text: w.form, meaning: w.gloss, reading: w.reading, home: w.home }
}

/** Where an item sits in the course: a kanji at its position, its words right after it in teaching order. */
export function itemOrder(id: string): number {
  const info = itemInfo(id)
  if (!info) return Infinity
  const home = kanjiEntry(info.home)!
  return info.kind === 'kanji' ? home.order : home.order + (home.words.indexOf(id) + 1) / 100
}

export interface CardContext {
  stats: KanjiStatsMap
  mode: KanjiMode
  knownKanji: Set<string>  // kanji the learner has met, this session's included
  knownWords: Set<string>  // word ids, the same
}

// the confusions of a kanji and its lookalikes, the first tier of wrong kanji
const preferredFor = (stats: KanjiStatsMap) => (kanji: string) =>
  [...confusedKanji(stats[kanjiId(kanji)]).map(c => c.kanji), ...kanjiLookalikes(kanji)]

/** The card for a planned item. A question without a type gets the one its box and the mode call for. */
export function makeCard(item: PlannedCard, ctx: CardContext, rng: () => number = Math.random): KanjiCard {
  const kanji = kanjiOfId(item.id)
  if (kanji) {
    const entry = kanjiEntry(kanji)!
    if (item.type === 'intro') return { id: item.id, home: kanji, type: 'intro', options: [], answer: kanji }
    const type = item.type === 'meaning' || item.type === 'recognize' ? item.type : kanjiQuestionType(ctx.stats[item.id], ctx.mode, rng)
    const wrong = pickKanjiOptions(entry, KANJI, preferredFor(ctx.stats)(kanji), ctx.knownKanji, tooClose, rng)
    return makeKanjiCard(entry, type, wrong, rng)
  }

  const word = wordById(item.id)!
  const base = { id: word.id, home: word.home, ...(item.needs ? { needs: item.needs } : {}) }
  if (item.type === 'intro') return { ...base, type: 'intro', options: [], answer: word.form }
  const type = item.type && isWordType(item.type) ? item.type : wordQuestionType(ctx.stats[item.id], ctx.mode, rng)

  let answer: string
  let wrong: string[]
  if (type === 'word-meaning') {
    answer = word.id
    wrong = pickMeaningOptions(word, WORDS, ctx.knownWords, tooClose, rng)
  } else if (type === 'read-choice') {
    answer = word.reading
    wrong = pickReadingOptions(word, WORDS, ctx.knownWords, kanjiReadings, rng)
  } else {
    answer = word.form
    const isWord = (form: string, reading: string) => WORDS.some(w => w.form === form && w.readings.includes(reading))
    wrong = pickSpellOptions(word, KANJI, preferredFor(ctx.stats), ctx.knownKanji, kanjiWithReading, isWord, rng)
  }
  return { ...base, type, options: shuffle([answer, ...wrong], rng), answer }
}

/** What an option shows: keywords and glosses in English, kanji, readings and forms as they are. */
export function optionText(card: KanjiCard, option: string): string {
  if (card.type === 'meaning') return kanjiEntry(option)?.keyword ?? ''
  if (card.type === 'word-meaning') return wordById(option)?.gloss ?? ''
  return option
}

/** What goes into the stats and the log for a pick, '' for "Don't know": a kanji as its item id, everything else as picked. */
export function storedAnswer(card: KanjiCard, given: string | null): string {
  if (!given) return ''
  return card.type === 'meaning' || card.type === 'recognize' ? kanjiId(given) : given
}

/** For a wrong written form: the kanji of the right form and the one put in for it, null when they don't differ in one kanji. */
export function spellDiff(right: string, given: string): { right: string; given: string } | null {
  const a = [...right]
  const b = [...given]
  if (a.length !== b.length) return null
  const differ = a.flatMap((ch, i) => ch !== b[i] ? [i] : [])
  if (differ.length !== 1 || !kanjiEntry(a[differ[0]]) || !kanjiEntry(b[differ[0]])) return null
  return { right: a[differ[0]], given: b[differ[0]] }
}

/**
 * What kind of mistake a wrong reading of a word is, null when it has no name or the id is no
 * word. A reading another word gives the same form is no mistake about this kanji, it gets no name.
 */
export function wordReadingMistake(id: string, given: string): ReadingMistake | null {
  const w = wordById(id)
  if (!w || w.homographs.includes(given)) return null
  return readingMistake(given, w.reading, w.split, kanjiReadings)
}
