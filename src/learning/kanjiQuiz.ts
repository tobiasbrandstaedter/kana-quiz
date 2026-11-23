import type { KanjiCard, KanjiEntry, KanjiMode, KanjiQuestionType, KanjiStatEntry } from '../types'
import { isSeen, MASTERED_BOX } from './scheduler'
import { shuffle } from './distractors'

/**
 * Which question a kanji gets (KR24). Meaning and Recognize ask their type. Every other mode
 * (Mixed, and the word modes, which leave kanji to Mixed) goes by how well the kanji is
 * known: its meaning while new and in box 1, the kanji for its keyword in box 2, from box 3
 * the kanji read in a word it is in (KR83), meaning or recognize once it has fewer than half
 * the right answers of that (the one with fewer, a tie at random). A known kanji should be
 * readable, not only recognized (KD19). makeCard falls back when no word was met yet.
 */
export function kanjiQuestionType(e: KanjiStatEntry | undefined, mode: KanjiMode, rng: () => number = Math.random): KanjiQuestionType {
  if (mode === 'meaning' || mode === 'recognize') return mode
  if (!isSeen(e) || e.box <= 1) return 'meaning'
  if (e.box === 2) return 'recognize'
  const right = (t: KanjiQuestionType) => e.byType[t]?.correct ?? 0
  const read = right('kanji-read')
  const behind = (['meaning', 'recognize'] as const).filter(t => right(t) * 2 < read)
  if (!behind.length) return 'kanji-read'
  return sightType(e, rng, behind)
}

/** Meaning or recognize, the one with fewer right answers, a tie at random. */
export function sightType(e: KanjiStatEntry, rng: () => number = Math.random, types: readonly ('meaning' | 'recognize')[] = ['meaning', 'recognize']): 'meaning' | 'recognize' {
  const right = (t: 'meaning' | 'recognize') => e.byType[t]?.correct ?? 0
  const fewest = Math.min(...types.map(right))
  const tied = types.filter(t => right(t) === fewest)
  return tied[Math.floor(rng() * tied.length)]
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
  return { id: answer.id, home: answer.kanji, type, options: shuffle([answer.kanji, ...wrong], rng), answer: answer.kanji }
}

// Round scoring, per item: kanji and words count alike.

// per item: missed at any point this round, and the latest answer
export type RoundResults = Record<string, { missed: boolean; last: boolean }>

export function noteResult(results: RoundResults, id: string, correct: boolean): RoundResults {
  const prev = results[id]
  return { ...results, [id]: { missed: (prev?.missed ?? false) || !correct, last: correct } }
}

/** Right on the re-ask, seconds after seeing the answer, is no reason to promote: the box holds. */
export const holdsBox = (results: RoundResults, id: string, correct: boolean): boolean => correct && !!results[id]?.missed

/** Scored once per item: first try means never missed this round. */
export function summarizeRound(results: RoundResults): { total: number; first: number; fixed: number; open: number } {
  const all = Object.values(results)
  const first = all.filter(r => !r.missed).length
  const fixed = all.filter(r => r.missed && r.last).length
  return { total: all.length, first, fixed, open: all.length - first - fixed }
}

export type RoundSummary = ReturnType<typeof summarizeRound>

/** Share of items right on the first try, as the big number on the results screen. */
export function resultScore({ total, first }: RoundSummary): string {
  return total ? `${Math.round((first / total) * 100)}%` : '0%'
}

export function resultLabel({ total, first, fixed, open }: RoundSummary): { title: string; jp: string; detail: string } {
  if (!total) return { title: 'Nothing scored', jp: '', detail: 'This round only had intro cards.' }
  const pct = Math.round((first / total) * 100)
  const [title, jp] =
    pct === 100 ? ['Perfect!', '完璧！'] :
    open === 0  ? ['Got there!', 'できた！'] :
    pct >= 80   ? ['Great work', 'よくできました'] :
    pct >= 60   ? ['Keep practicing', 'もう少し'] :
                  ['Keep studying', '頑張って！']
  const parts = [`${first} of ${total} ${total === 1 ? 'kanji or word' : 'kanji and words'} on the first try`]
  if (fixed) parts.push(`${fixed} right on retry`)
  if (open) parts.push(`${open} still open`)
  return { title, jp, detail: parts.join(' · ') }
}

/**
 * How the boxes moved in a round, by item id: mastered (crossed into the mastered box),
 * up (moved up without that, so nothing is listed twice) and down.
 */
export function splitMoves(moves: Record<string, { from: number; to: number }>): { up: string[]; down: string[]; mastered: string[] } {
  const all = Object.entries(moves)
  const mastered = all.filter(([, m]) => m.from < MASTERED_BOX && m.to >= MASTERED_BOX).map(([id]) => id)
  return {
    up: all.filter(([id, m]) => m.to > m.from && !mastered.includes(id)).map(([id]) => id),
    down: all.filter(([, m]) => m.to < m.from).map(([id]) => id),
    mastered,
  }
}
