import { describe, it, expect } from 'vitest'
import { kanjiQuestionType, pickKanjiOptions, makeKanjiCard, noteResult, summarizeRound } from './kanjiQuiz'
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
const seeded = (seed = 1) => () => (seed = (seed * 16807) % 2147483647) / 2147483647

describe('kanjiQuestionType', () => {
  const at = (box: number, meaning = 0, recognize = 0) => ({
    ...newKanjiEntry('k:A'), correct: 1, box,
    byType: { meaning: { correct: meaning, incorrect: 0 }, recognize: { correct: recognize, incorrect: 0 } },
  })

  it('asks the meaning while new and in box 1, the kanji in box 2', () => {
    expect(kanjiQuestionType(undefined, 'mixed')).toBe('meaning')
    expect(kanjiQuestionType(at(0), 'mixed')).toBe('meaning')
    expect(kanjiQuestionType(at(1), 'mixed')).toBe('meaning')
    expect(kanjiQuestionType(at(2), 'mixed')).toBe('recognize')
  })

  it('from box 3 picks the type with fewer right answers', () => {
    expect(kanjiQuestionType(at(3, 5, 2), 'mixed')).toBe('recognize')
    expect(kanjiQuestionType(at(4, 1, 2), 'mixed')).toBe('meaning')
    expect(kanjiQuestionType(at(3, 2, 2), 'mixed', () => 0.1)).toBe('meaning')
    expect(kanjiQuestionType(at(3, 2, 2), 'mixed', () => 0.9)).toBe('recognize')
  })

  it('follows a fixed mode', () => {
    expect(kanjiQuestionType(at(0), 'recognize')).toBe('recognize')
    expect(kanjiQuestionType(at(4), 'meaning')).toBe('meaning')
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
    expect(card).toMatchObject({ id: 'k:A', kanji: 'A', type: 'recognize' })
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
})
