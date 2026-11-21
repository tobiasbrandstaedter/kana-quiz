import type { KanjiEntry, KanjiMode, KanjiReading, KanjiStatEntry, ReadingPart, WordQuestionType } from '../types'
import { isSeen } from './scheduler'
import { shuffle } from './distractors'
import { readingOptions } from './readings'

export const isWordType = (t: string): t is WordQuestionType =>
  t === 'word-meaning' || t === 'read-choice' || t === 'read-type' || t === 'spell'

/**
 * Which question a word gets (KR25). The modes Words and Spelling ask their type, Reading
 * asks by choice in box 0 and 1 and typed from box 2. Every other mode goes by the box:
 * - box 0 and 1: reading by choice or meaning, whichever has fewer right answers
 * - box 2: reading typed
 * - box 3 and up: spelling, meaning or reading typed, whichever has the fewest right answers
 */
export function wordQuestionType(e: KanjiStatEntry | undefined, mode: KanjiMode, rng: () => number = Math.random): WordQuestionType {
  const box = isSeen(e) ? e.box : 0
  if (mode === 'read-choice') return box >= 2 ? 'read-type' : 'read-choice'
  if (isWordType(mode)) return mode
  if (box === 2) return 'read-type'
  const types: WordQuestionType[] = box >= 3 ? ['spell', 'word-meaning', 'read-type'] : ['read-choice', 'word-meaning']
  const right = (t: WordQuestionType) => e?.byType[t]?.correct ?? 0
  const fewest = Math.min(...types.map(right))
  const tied = types.filter(t => right(t) === fewest)
  return tied[Math.floor(rng() * tied.length)]
}

/** Words the learner has met in random order, then every word by its distance to `id` in course order. */
export function knownThenNearest<W extends { id: string }>(id: string, words: W[], known: Set<string>, rng: () => number = Math.random): W[] {
  const at = words.findIndex(w => w.id === id)
  const nearest = words.map((w, i) => ({ w, d: Math.abs(i - at) })).sort((a, b) => a.d - b.d).map(x => x.w)
  return [...shuffle(words.filter(w => known.has(w.id)), rng), ...nearest]
}

// a gloss as the parts it is made of: split at ";", case and punctuation ignored, so
// "what day" and "what day?; what day of the week?" share a part
const partsOf = (gloss: string) => gloss.split(';').map(x => x.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim())
// every part of every sense JMdict gives a word
const sourceParts = (w: { glosses: string[] }) => w.glosses.flatMap(partsOf)
const shares = (a: string[], b: string[]) => a.some(x => b.includes(x))

/**
 * Three wrong meanings for a meaning question, as word ids (KR72): glosses of words the
 * learner has met first, then of the words closest in course order. Never a gloss that shares
 * a part with the right one or with its source glosses, or whose source glosses hold a part
 * of the right one, never one too close to it, and no two options that share a part.
 */
export function pickMeaningOptions<W extends { id: string; gloss: string; glosses: string[] }>(
  answer: W, words: W[], known: Set<string>, tooClose: (a: string, b: string) => boolean, rng: () => number = Math.random,
): string[] {
  const answerParts = partsOf(answer.gloss)
  const answerSources = [...answerParts, ...sourceParts(answer)]
  const clash = (w: W) => tooClose(w.gloss, answer.gloss) || shares(partsOf(w.gloss), answerSources) || shares(answerParts, sourceParts(w))
  const picked: W[] = []
  for (const w of knownThenNearest(answer.id, words, known, rng)) {
    if (picked.length === 3) break
    if (w.id === answer.id || clash(w) || picked.some(p => shares(partsOf(p.gloss), partsOf(w.gloss)))) continue
    picked.push(w)
  }
  return picked.map(p => p.id)
}

/**
 * Three wrong readings for a reading question: near misses and other readings of its kanji
 * (see readingOptions), filled up with readings of words the learner has met, then of the
 * words closest in course order.
 */
export function pickReadingOptions<W extends { id: string; reading: string; readings: string[]; homographs: string[]; split: ReadingPart[] }>(
  answer: W, words: W[], known: Set<string>, readingsOf: (kanji: string) => KanjiReading[], rng: () => number = Math.random,
): string[] {
  const fill = knownThenNearest(answer.id, words, known, rng).map(w => w.reading)
  return readingOptions(answer, readingsOf, fill, rng)
}

/**
 * Three wrong written forms for a spelling question (KR18, KR16): the word with one of its
 * kanji swapped for, in this order, a kanji this learner confused with it or a lookalike
 * (`preferred`), a kanji with the same reading for that part, a kanji of the same set, a kanji
 * met so far, then the kanji closest in learning order. Never a kanji the word has already,
 * and never the form of a practiced word with the same reading (`isWord`), that would be right too.
 */
export function pickSpellOptions(
  word: { form: string; reading: string; split: ReadingPart[]; kanji: string[] }, all: KanjiEntry[],
  preferred: (kanji: string) => string[], known: Set<string>, sameReading: (reading: string) => string[],
  isWord: (form: string, reading: string) => boolean, rng: () => number = Math.random,
): string[] {
  const byKanji = new Map(all.map(k => [k.kanji, k]))
  const partReading = (k: string) => word.split.find(p => p.text === k)?.reading
  const nearest = (k: string) => {
    const order = byKanji.get(k)?.order ?? 0
    return [...all].sort((a, b) => Math.abs(a.order - order) - Math.abs(b.order - order)).map(x => x.kanji)
  }
  const tiers: Array<(k: string) => string[]> = [
    preferred,
    k => { const r = partReading(k); return r ? sameReading(r) : [] },
    k => shuffle(all.filter(x => x.set === byKanji.get(k)?.set).map(x => x.kanji), rng),
    () => shuffle([...known], rng),
    nearest,
  ]

  const chars = [...word.form]
  const picked: string[] = []
  for (const tier of tiers) {
    // every kanji of the word gets its turn before the next tier, so a two kanji word
    // doesn't have all its traps on one side
    const lists = word.kanji.map(k => ({ k, swaps: tier(k).filter(x => byKanji.has(x) && !word.kanji.includes(x)) }))
    while (picked.length < 3 && lists.some(l => l.swaps.length)) {
      for (const { k, swaps } of lists) {
        const swap = swaps.shift()
        if (!swap || picked.length === 3) continue
        // a kanji the word has twice is swapped once, the other one stays as a hint
        const at = chars.indexOf(k)
        const form = chars.map((ch, i) => i === at ? swap : ch).join('')
        if (picked.includes(form) || isWord(form, word.reading)) continue
        picked.push(form)
      }
    }
    if (picked.length === 3) break
  }
  return picked
}
