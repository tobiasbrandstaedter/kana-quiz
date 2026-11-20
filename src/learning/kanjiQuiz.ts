import type { KanjiCard, KanjiEntry, KanjiMode, KanjiQuestionType, KanjiStatEntry } from '../types'
import { isSeen } from './scheduler'
import { shuffle } from './distractors'

/**
 * Which question an item gets (KR24). A fixed mode asks that type. Mixed goes by how well
 * the kanji is known: its meaning while new and in box 1, the kanji for its keyword in
 * box 2, from box 3 the type with fewer right answers so far.
 */
export function kanjiQuestionType(e: KanjiStatEntry | undefined, mode: KanjiMode, rng: () => number = Math.random): KanjiQuestionType {
  if (mode !== 'mixed') return mode
  if (!isSeen(e) || e.box <= 1) return 'meaning'
  if (e.box === 2) return 'recognize'
  const meaning = e.byType.meaning?.correct ?? 0
  const recognize = e.byType.recognize?.correct ?? 0
  if (meaning !== recognize) return meaning < recognize ? 'meaning' : 'recognize'
  return rng() < 0.5 ? 'meaning' : 'recognize'
}

// two kanji whose keywords could both be right: one keyword is a source meaning of the
// other kanji, or the pair is on the hand kept list of meanings too close to tell apart (KR15)
function clash(a: KanjiEntry, b: KanjiEntry, tooClose: (x: string, y: string) => boolean): boolean {
  return a.meanings.includes(b.keyword) || b.meanings.includes(a.keyword) || tooClose(a.keyword, b.keyword)
}

/**
 * Three wrong options for a card about `answer`, as kanji (KR15, KR16). In this order: what
 * the learner picked for it before and its lookalikes (`preferred`), kanji of its set the
 * learner knows, any kanji the learner knows, then while that is too few the set being
 * learned and the kanji closest to it in learning order. Never one that clashes with the answer.
 */
export function pickKanjiOptions(
  answer: KanjiEntry, all: KanjiEntry[], preferred: string[], known: Set<string>,
  tooClose: (a: string, b: string) => boolean, rng: () => number = Math.random,
): string[] {
  const byKanji = new Map(all.map(k => [k.kanji, k]))
  const sameSet = shuffle(all.filter(k => k.set === answer.set), rng)
  const isKnown = (k: KanjiEntry) => known.has(k.kanji)
  const nearest = [...all].sort((a, b) => Math.abs(a.order - answer.order) - Math.abs(b.order - answer.order))

  const tiers: KanjiEntry[][] = [
    preferred.map(k => byKanji.get(k)).filter((k): k is KanjiEntry => !!k),
    sameSet.filter(isKnown),
    shuffle(all.filter(isKnown), rng),
    sameSet,
    nearest,
  ]

  const picked: KanjiEntry[] = []
  for (const tier of tiers) {
    for (const k of tier) {
      if (picked.length === 3) return picked.map(p => p.kanji)
      if (k === answer || picked.includes(k) || clash(answer, k, tooClose)) continue
      picked.push(k)
    }
  }
  return picked.map(p => p.kanji)
}

export function makeKanjiCard(answer: KanjiEntry, type: KanjiQuestionType, wrong: string[], rng: () => number = Math.random): KanjiCard {
  return { id: answer.id, kanji: answer.kanji, type, options: shuffle([answer.kanji, ...wrong], rng) }
}

// per item: missed at any point this round, and the latest answer
export type RoundResults = Record<string, { missed: boolean; last: boolean }>

export function noteResult(results: RoundResults, id: string, correct: boolean): RoundResults {
  const prev = results[id]
  return { ...results, [id]: { missed: (prev?.missed ?? false) || !correct, last: correct } }
}

/** Scored once per item: first try means never missed this round. */
export function summarizeRound(results: RoundResults): { total: number; first: number; fixed: number; open: number } {
  const all = Object.values(results)
  const first = all.filter(r => !r.missed).length
  const fixed = all.filter(r => r.missed && r.last).length
  return { total: all.length, first, fixed, open: all.length - first - fixed }
}
