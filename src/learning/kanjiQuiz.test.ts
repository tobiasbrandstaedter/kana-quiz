import { describe, it, expect } from 'vitest'
import { seeded } from './seeded'
import { holdsBox, kanjiQuestionType, pickKanjiOptions, makeKanjiCard, noteResult, summarizeRound, resultScore, resultLabel, splitMoves } from './kanjiQuiz'
import type { RoundResults } from './kanjiQuiz'
import { newKanjiEntry } from './kanjiStats'
import type { KanjiEntry } from '../types'

// letters stand in for kanji, nothing here is course content
function entry(kanji: string, set: string, order: number, keyword = kanji.toLowerCase(), meanings = [keyword]): KanjiEntry {
  return { id: `k:${kanji}`, kanji, keyword, meanings, strokeCount: 1, parts: [], hook: '', set, order, words: [] }
}

const ALL = [
  entry('A', 's1', 0), entry('B', 's1', 1), entry('C', 's1', 2), entry('D', 's1', 3), entry('E', 's1', 4),
  entry('F', 's2', 5), entry('G', 's2', 6), entry('H', 's2', 7), entry('I', 's2', 8),
]
const byKanji = (k: string) => ALL.find(e => e.kanji === k)!
const never = () => false

describe('kanjiQuestionType', () => {
  const at = (box: number, meaning = 0, recognize = 0, read = 0) => ({
    ...newKanjiEntry('k:A'), correct: 1, box,
    byType: {
      meaning: { correct: meaning, incorrect: 0 }, recognize: { correct: recognize, incorrect: 0 },
      'kanji-read': { correct: read, incorrect: 0 },
    },
  })

  it('asks the meaning while new and in box 1, the kanji in box 2', () => {
    expect(kanjiQuestionType(undefined, 'mixed')).toBe('meaning')
    expect(kanjiQuestionType(at(0), 'mixed')).toBe('meaning')
    expect(kanjiQuestionType(at(1), 'mixed')).toBe('meaning')
    expect(kanjiQuestionType(at(2), 'mixed')).toBe('recognize')
  })

  it('from box 3 reads the kanji in a word, meaning or recognize once below half of that (KR83)', () => {
    expect(kanjiQuestionType(at(3, 2, 1), 'mixed')).toBe('kanji-read')
    expect(kanjiQuestionType(at(4, 2, 1, 2), 'mixed')).toBe('kanji-read')
    expect(kanjiQuestionType(at(4, 2, 1, 3), 'mixed')).toBe('recognize')
    expect(kanjiQuestionType(at(4, 1, 2, 3), 'mixed')).toBe('meaning')
    expect(kanjiQuestionType(at(5, 2, 2, 6), 'mixed', () => 0.1)).toBe('meaning')
    expect(kanjiQuestionType(at(5, 2, 2, 6), 'mixed', () => 0.9)).toBe('recognize')
    // answered right every time: about half the reviews read it in a word
    let e = at(3, 2, 1)
    const asked: string[] = []
    for (let i = 0; i < 12; i++) {
      const t = kanjiQuestionType(e, 'mixed', seeded(i))
      asked.push(t)
      e = { ...e, byType: { ...e.byType, [t]: { correct: (e.byType[t]?.correct ?? 0) + 1, incorrect: 0 } } }
    }
    const reads = asked.filter(t => t === 'kanji-read').length
    expect(reads).toBeGreaterThanOrEqual(5)
    expect(reads).toBeLessThanOrEqual(7)
  })

  it('follows a fixed mode', () => {
    expect(kanjiQuestionType(at(0), 'recognize')).toBe('recognize')
    expect(kanjiQuestionType(at(4), 'meaning')).toBe('meaning')
  })

  it('goes by the box in the word modes, they only fix the type of words', () => {
    expect(kanjiQuestionType(at(1), 'spell')).toBe('meaning')
    expect(kanjiQuestionType(at(2), 'read-choice')).toBe('recognize')
    expect(kanjiQuestionType(at(3, 5, 2), 'word-meaning')).toBe('kanji-read')
  })
})

describe('pickKanjiOptions', () => {
  it('gives three other kanji', () => {
    const wrong = pickKanjiOptions(byKanji('A'), ALL, [], new Set(), never, seeded())
    expect(wrong).toHaveLength(3)
    expect(new Set(wrong).size).toBe(3)
    expect(wrong).not.toContain('A')
  })

  it('puts confusions and lookalikes first, in the order given', () => {
    const wrong = pickKanjiOptions(byKanji('A'), ALL, ['H', 'G'], new Set(), never, seeded())
    expect(wrong.slice(0, 2)).toEqual(['H', 'G'])
  })

  it('prefers known kanji of the same set, then any known kanji', () => {
    const known = new Set(['B', 'F', 'G', 'H'])
    const wrong = pickKanjiOptions(byKanji('A'), ALL, [], known, never, seeded())
    expect(wrong[0]).toBe('B')
    expect(wrong.slice(1).every(k => known.has(k))).toBe(true)
  })

  it('fills from the set being learned while too few kanji are known', () => {
    for (let seed = 1; seed < 20; seed++) {
      const wrong = pickKanjiOptions(byKanji('G'), ALL, [], new Set(['A']), never, seeded(seed))
      expect(wrong[0]).toBe('A')
      expect(wrong.slice(1).every(k => byKanji(k).set === 's2')).toBe(true)
    }
  })

  it('reaches into the other sets when the set is too small', () => {
    const small = [entry('A', 's1', 0), entry('B', 's2', 1), entry('C', 's3', 2), entry('D', 's4', 3)]
    expect(pickKanjiOptions(small[0], small, [], new Set(), never).sort()).toEqual(['B', 'C', 'D'])
  })

  it('never offers a kanji whose keyword could be right too', () => {
    const answer = entry('A', 's1', 0, 'tall', ['tall', 'high'])
    const all = [answer, entry('B', 's1', 1, 'high'), entry('C', 's1', 2, 'up'), entry('D', 's1', 3, 'big', ['big', 'tall']),
      entry('E', 's1', 4), entry('F', 's1', 5), entry('G', 's1', 6)]
    const close = (a: string, b: string) => (a === 'tall' && b === 'up') || (a === 'up' && b === 'tall')
    for (let seed = 1; seed < 20; seed++) {
      // preferred too: a confusion or lookalike that clashes is still left out
      const wrong = pickKanjiOptions(answer, all, ['B', 'C', 'D'], new Set(), close, seeded(seed))
      expect(wrong.sort()).toEqual(['E', 'F', 'G'])
    }
  })
})

describe('makeKanjiCard', () => {
  it('holds the answer among the options', () => {
    const card = makeKanjiCard(byKanji('A'), 'recognize', ['B', 'C', 'D'], seeded())
    expect(card).toMatchObject({ id: 'k:A', home: 'A', type: 'recognize', answer: 'A' })
    expect([...card.options].sort()).toEqual(['A', 'B', 'C', 'D'])
  })
})

describe('round scoring', () => {
  it('scores each item once: first try, right on retry, still open', () => {
    let r: RoundResults = {}
    r = noteResult(r, 'k:A', true)
    r = noteResult(r, 'k:A', true)
    r = noteResult(r, 'k:B', false)
    r = noteResult(r, 'k:B', true)
    r = noteResult(r, 'k:C', true)
    r = noteResult(r, 'k:C', false)
    expect(summarizeRound(r)).toEqual({ total: 3, first: 1, fixed: 1, open: 1 })
    expect(summarizeRound({})).toEqual({ total: 0, first: 0, fixed: 0, open: 0 })
  })

  it('holds the box on a right answer after a miss of the same item this round, nothing else', () => {
    let r: RoundResults = noteResult({}, 'k:A', false)
    r = noteResult(r, 'k:B', true)
    expect(holdsBox(r, 'k:A', true)).toBe(true)
    // a miss moves the box down anyway, a first answer or one right so far moves as usual
    expect(holdsBox(r, 'k:A', false)).toBe(false)
    expect(holdsBox(r, 'k:B', true)).toBe(false)
    expect(holdsBox(r, 'k:C', true)).toBe(false)
    // still held once it was right on the re-ask
    expect(holdsBox(noteResult(r, 'k:A', true), 'k:A', true)).toBe(true)
  })
})

describe('resultScore and resultLabel', () => {
  const round = (total: number, first: number, fixed = 0) => ({ total, first, fixed, open: total - first - fixed })

  it('scores the share right on the first try', () => {
    expect(resultScore(round(4, 3))).toBe('75%')
    expect(resultScore(round(0, 0))).toBe('0%')
  })

  it('says what happened in the round', () => {
    expect(resultLabel(round(0, 0)).title).toBe('Nothing scored')
    expect(resultLabel(round(5, 5)).title).toBe('Perfect!')
    // everything fixed on retry
    expect(resultLabel(round(5, 2, 3)).title).toBe('Got there!')
    expect(resultLabel(round(5, 4)).title).toBe('Great work')
    expect(resultLabel(round(5, 1, 1)).detail).toBe('1 of 5 kanji and words on the first try · 1 right on retry · 3 still open')
    expect(resultLabel(round(1, 1)).detail).toBe('1 of 1 kanji or word on the first try')
    expect(resultLabel(round(2, 0, 2)).detail).toBe('0 of 2 kanji and words on the first try · 2 right on retry')
  })
})

describe('splitMoves', () => {
  it('lists mastered ones once, not also as moved up', () => {
    const moves = { 'k:A': { from: 1, to: 2 }, 'k:B': { from: 2, to: 3 }, 'k:C': { from: 2, to: 0 }, 'k:D': { from: 1, to: 1 } }
    expect(splitMoves(moves)).toEqual({ up: ['k:A'], down: ['k:C'], mastered: ['k:B'] })
  })
})
