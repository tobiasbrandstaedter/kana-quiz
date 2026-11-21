// Cards over the course content: the course as the plan and the pattern rules see it, what an
// item id stands for, the card for a planned item with its options, and what an option means per question type.
// Reads kanjiData, holds no state.
import type { ItemInfo, KanjiCard, KanjiMode, KanjiStatsMap, WordEntry } from '../types'
import {
  allKanji, groupById, groupPractice, homeWords, kanjiEntry, kanjiLookalikeHint, kanjiLookalikes, kanjiReadings, kanjiSets, kanjiWithReading,
  practicedWords, sameForm, tooClose, wordById, wordGroups,
} from '../data/kanjiData'
import { cardGroup, kanjiId, kanjiOfId } from '../kanjiKeys'
import type { PlanCourse, PlanWord } from './kanjiPlan'
import type { PlannedCard } from './kanjiSession'
import type { PatternCourse } from './kanjiPatterns'
import { confusedKanji } from './kanjiStats'
import { kanjiQuestionType, makeKanjiCard, pickKanjiOptions } from './kanjiQuiz'
import { isWordType, pickMeaningOptions, pickReadingOptions, pickSpellOptions, wordQuestionType } from './wordQuiz'
import { readingMistake, typedVerdict } from './readings'
import type { ReadingMistake, TypedVerdict } from './readings'
import { shuffle } from './distractors'
import { isSeen } from './scheduler'

const KANJI = allKanji()
// practiced words: the course words and the practiced words of the groups. Wrong options
// come from all of them
const PRACTICED = practicedWords()
// every reading of a practiced word, a typed one in here is a mix-up and not a slip
const PRACTICED_READINGS = new Set(PRACTICED.flatMap(w => w.readings))

const planWord = (w: WordEntry): PlanWord => ({
  id: w.id, kanji: w.kanji.map(kanjiId), home: kanjiId(w.home), first: kanjiEntry(w.home)!.words[0] === w.id, special: w.special,
  ...(w.group ? { group: w.group } : {}),
})
const PLAN_WORDS = new Map(PRACTICED.map(w => [w.id, planWord(w)]))

/** Every kanji, practiced word and group as the plan works with them. */
export const PLAN_COURSE: PlanCourse = {
  kanji: KANJI.map(k => k.id),
  words: [...PLAN_WORDS.values()],
  groups: wordGroups().map(g => ({
    id: g.id, home: kanjiId(g.counter), words: groupPractice(g).map(w => PLAN_WORDS.get(w.id)!), question: g.question,
  })),
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

const SETS = new Map(kanjiSets().map(s => [s.id, s]))
// kanji id -> the practiced words that have it
const WORDS_WITH = new Map<string, string[]>()
for (const w of PRACTICED) for (const k of w.kanji) WORDS_WITH.set(kanjiId(k), [...(WORDS_WITH.get(kanjiId(k)) ?? []), w.id])

/** The course as the pattern rules see it. */
export const PATTERN_COURSE: PatternCourse = {
  text: id => itemInfo(id)?.text ?? null,
  setOf: id => {
    const info = itemInfo(id)
    return (info && SETS.get(kanjiEntry(info.home)!.set)) ?? null
  },
  lookalikes: id => kanjiLookalikes(kanjiOfId(id) ?? '').map(kanjiId),
  hint: (a, b) => kanjiLookalikeHint(kanjiOfId(a) ?? '', kanjiOfId(b) ?? ''),
  wordsWith: id => WORDS_WITH.get(id) ?? [],
  swap: (id, form) => {
    const w = wordById(id)
    const diff = w && spellDiff(w.form, form)
    return diff ? [kanjiId(diff.right), kanjiId(diff.given)] : null
  },
}

/** Where an item sits in the course:a kanji at its position, its words right after it in teaching order, then its group words. */
export function itemOrder(id: string): number {
  const info = itemInfo(id)
  if (!info) return Infinity
  const home = kanjiEntry(info.home)!
  return info.kind === 'kanji' ? home.order : home.order + (homeWords(home.kanji).findIndex(w => w.id === id) + 1) / 100
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
  // the table of a group that opens: shown, never asked
  const group = cardGroup(item.id)
  if (group) return { id: item.id, home: groupById(group)!.counter, type: 'intro', options: [], answer: '' }

  const kanji = kanjiOfId(item.id)
  if (kanji) {
    const entry = kanjiEntry(kanji)!
    if (item.type === 'intro' || item.type === 'write') return { id: item.id, home: kanji, type: item.type, options: [], answer: kanji }
    const type = item.type === 'meaning' || item.type === 'recognize' ? item.type : kanjiQuestionType(ctx.stats[item.id], ctx.mode, rng)
    const wrong = pickKanjiOptions(entry, KANJI, preferredFor(ctx.stats)(kanji), ctx.knownKanji, tooClose, rng)
    return makeKanjiCard(entry, type, wrong, rng)
  }

  const word = wordById(item.id)!
  const base = { id: word.id, home: word.home, ...(item.needs ? { needs: item.needs } : {}), ...(item.after ? { after: item.after } : {}) }
  if (item.type === 'intro') return { ...base, type: 'intro', options: [], answer: word.form }
  const type = item.type && isWordType(item.type) ? item.type : wordQuestionType(ctx.stats[item.id], ctx.mode, rng)

  let answer: string
  let wrong: string[]
  if (type === 'word-meaning') {
    answer = word.id
    wrong = pickMeaningOptions(word, PRACTICED, ctx.knownWords, tooClose, rng)
  } else if (type === 'read-choice') {
    answer = word.reading
    wrong = pickReadingOptions(word, PRACTICED, ctx.knownWords, kanjiReadings, rng)
  } else if (type === 'read-type') {
    return { ...base, type, options: [], answer: word.reading }
  } else {
    answer = word.form
    const isPracticed = (form: string, reading: string) => PRACTICED.some(w => w.form === form && w.readings.includes(reading))
    wrong = pickSpellOptions(word, KANJI, preferredFor(ctx.stats), ctx.knownKanji, kanjiWithReading, isPracticed, rng)
  }
  return { ...base, type, options: shuffle([answer, ...wrong], rng), answer }
}

/**
 * The card as it is about to be shown after `prev`. Options are shuffled per card, but two cards
 * in a row can still draw the same four in the same order (two new kanji of one set), which
 * looks like a stuck screen: then they move round by one.
 */
export function unlikePrevious(card: KanjiCard, prev: KanjiCard | undefined): KanjiCard {
  const o = card.options
  if (!prev || o.length < 2 || o.join('|') !== prev.options.join('|')) return card
  return { ...card, options: [...o.slice(1), o[0]] }
}

/**
 * The second cue of a write question next to the keyword (W1): the reading of the kanji's
 * first word in hiragana, once the learner has met that word. Null before that.
 */
export function writeCue(kanji: string, stats: KanjiStatsMap): string | null {
  const first = kanjiEntry(kanji)?.words[0]
  const word = first && isSeen(stats[first]) ? wordById(first) : null
  return word?.reading ?? null
}

/** Kanji and practiced words the learner has met, the session's own items included: the pools wrong options prefer. */
export function metSoFar(stats: KanjiStatsMap, sessionIds: string[]): { kanji: Set<string>; words: Set<string> } {
  const ids = [...Object.keys(stats).filter(id => isSeen(stats[id])), ...sessionIds]
  return {
    kanji: new Set(ids.map(kanjiOfId).filter((k): k is string => !!k)),
    words: new Set(ids.filter(id => PLAN_WORDS.has(id))),
  }
}

export interface Explained { text: string; meaning: string }

/**
 * What a wrong meaning, recognize or spelling answer shows (KR35): the pick next to the right
 * one, each with its keyword, and the lookalike hint when the two are in one group. For a
 * written form the kanji that differs. Only the right one after "Don't know" (picked null),
 * null for other types and for a form that doesn't swap one kanji.
 */
export function missExplanation(card: KanjiCard, picked: string | null): { yours: Explained | null; right: Explained; hint: string | null } | null {
  if (picked === card.answer) return null
  if (card.type === 'meaning' || card.type === 'recognize') {
    const right = kanjiEntry(card.home)!
    const yours = picked ? kanjiEntry(picked) : null
    return {
      yours: yours && { text: yours.kanji, meaning: yours.keyword },
      right: { text: right.kanji, meaning: right.keyword },
      hint: yours ? kanjiLookalikeHint(card.home, yours.kanji) : null,
    }
  }
  const diff = card.type === 'spell' && picked ? spellDiff(card.answer, picked) : null
  if (!diff) return null
  return {
    yours: { text: picked!, meaning: kanjiEntry(diff.given)!.keyword },
    right: { text: card.answer, meaning: kanjiEntry(diff.right)!.keyword },
    hint: kanjiLookalikeHint(diff.right, diff.given),
  }
}

/**
 * The lookalikes a kanji intro warns about (KR11): only those the learner has met (`met`, which
 * the caller makes "seen, or in this session"), the rest would be noise. Null when there is none.
 */
export function introLookalikes(kanji: string, met: (k: string) => boolean): { others: string[]; hint: string | null } | null {
  const others = kanjiLookalikes(kanji).filter(met)
  return others.length ? { others, hint: kanjiLookalikeHint(kanji, others[0]) } : null
}

/**
 * The table a typed reading comes from when it is the reading of a group word written like this
 * word (KR78, KR80): 十 typed the counting way on the plain number card. Null otherwise.
 */
export function twinTable(id: string, kana: string): string | null {
  const w = wordById(id)
  const twin = w && sameForm(w).find(t => t.reading === kana)
  return twin?.group ? groupById(twin.group)?.title ?? null : null
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

/**
 * What a typed reading of a word may be: `right` counts, `again` asks again and counts nothing.
 * A group word takes only the reading its table shows, the other readings of its entry would
 * let an irregular word through the regular way. Any word asks again for the reading of a
 * twin written the same way (KR78). A course word keeps the other readings of its entry, and
 * a reading other entries give the form asks again as before.
 */
export function typedReadings(w: WordEntry): { right: string[]; again: string[] } {
  const twins = sameForm(w).map(t => t.reading).filter(r => r !== w.reading)
  const right = w.group ? [w.reading] : w.readings.filter(r => !twins.includes(r))
  return { right, again: [...new Set([...w.homographs, ...twins, ...w.readings.filter(r => !right.includes(r))])] }
}

/**
 * The verdict on a typed reading of a word (see typedVerdict), over `typedReadings`. A known
 * reading is one of a practiced word or one of the word's kanji as the practiced words show it.
 */
export function wordTypedVerdict(id: string, typed: string, slipped: boolean): TypedVerdict {
  const w = wordById(id)!
  const { right, again } = typedReadings(w)
  const isKnownReading = (kana: string) =>
    PRACTICED_READINGS.has(kana) || w.kanji.some(k => kanjiReadings(k).some(r => r.reading === kana))
  return typedVerdict(typed, { ...w, readings: right, homographs: again }, kanjiReadings, isKnownReading, slipped)
}
