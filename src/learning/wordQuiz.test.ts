import { describe, it, expect } from 'vitest'
import { seeded } from './seeded'
import { wordQuestionType, knownThenNearest, pickMeaningOptions, pickReadingOptions, pickSpellOptions, isWordType } from './wordQuiz'
import { newKanjiEntry } from './kanjiStats'
import type { KanjiEntry, KanjiMode } from '../types'

// letters for kanji and words, made up kana; nothing here is course content
const never = () => false

describe('isWordType', () => {
  it('knows the word question types', () => {
    expect(['word-meaning', 'read-choice', 'read-type', 'spell'].every(isWordType)).toBe(true)
    expect(['meaning', 'recognize', 'mixed'].some(isWordType)).toBe(false)
  })
})

describe('wordQuestionType', () => {
  // reading counts the right answers of both reading types, the box 3 rule only looks at typed
  const at = (box: number, right: { choice?: number; typed?: number; meaning?: number; spell?: number } = {}) => ({
    ...newKanjiEntry('w:a'), correct: 1, box,
    byType: {
      'read-choice': { correct: right.choice ?? 0, incorrect: 0 },
      'read-type': { correct: right.typed ?? 0, incorrect: 0 },
      'word-meaning': { correct: right.meaning ?? 0, incorrect: 0 },
      spell: { correct: right.spell ?? 0, incorrect: 0 },
    },
  })

  it('follows the modes Words and Spelling', () => {
    for (const mode of ['word-meaning', 'spell'] as KanjiMode[]) {
      for (const box of [0, 2, 4]) expect(wordQuestionType(at(box), mode)).toBe(mode)
    }
  })

  it('asks the reading by choice in box 0 and 1 and typed from box 2 in the mode Reading', () => {
    expect(wordQuestionType(undefined, 'read-choice')).toBe('read-choice')
    expect(wordQuestionType(at(1), 'read-choice')).toBe('read-choice')
    expect(wordQuestionType(at(2), 'read-choice')).toBe('read-type')
    expect(wordQuestionType(at(5), 'read-choice')).toBe('read-type')
  })

  it('asks the reading by choice while new and in box 1, the meaning while it was never right (KR25)', () => {
    expect(wordQuestionType(undefined, 'mixed')).toBe('read-choice')
    expect(wordQuestionType(at(1, { choice: 2, meaning: 1 }), 'mixed')).toBe('read-choice')
    expect(wordQuestionType(at(0, { choice: 3, meaning: 0 }), 'mixed')).toBe('word-meaning')
  })

  it('asks the reading typed in box 2', () => {
    expect(wordQuestionType(at(2, { typed: 9 }), 'mixed')).toBe('read-type')
  })

  it('from box 3 asks the typed reading, spelling or meaning only once it falls below half of it', () => {
    expect(wordQuestionType(at(3, { typed: 1, meaning: 1, spell: 0 }), 'mixed')).toBe('spell')
    expect(wordQuestionType(at(4, { typed: 2, meaning: 1, spell: 1 }), 'mixed')).toBe('read-type')
    expect(wordQuestionType(at(5, { typed: 4, meaning: 2, spell: 2 }), 'mixed')).toBe('read-type')
    expect(wordQuestionType(at(5, { typed: 5, meaning: 2, spell: 3 }), 'mixed')).toBe('word-meaning')
    // a word answered right every time is read in about two of three reviews
    let e = at(3, { choice: 1, meaning: 1 })
    const asked: string[] = []
    for (let i = 0; i < 12; i++) {
      const t = wordQuestionType(e, 'mixed', seeded(i))
      asked.push(t)
      e = { ...e, byType: { ...e.byType, [t]: { correct: (e.byType[t]?.correct ?? 0) + 1, incorrect: 0 } } }
    }
    expect(asked.filter(t => t === 'read-type').length).toBeGreaterThanOrEqual(7)
    for (let seed = 1; seed < 20; seed++) expect(wordQuestionType(at(3, { choice: 0 }), 'mixed', seeded(seed))).not.toBe('read-choice')
  })

  it('leaves words to the box rules in the kanji modes', () => {
    expect(wordQuestionType(at(2), 'meaning')).toBe('read-type')
    expect(wordQuestionType(at(3, { typed: 1, meaning: 1 }), 'recognize')).toBe('spell')
  })
})

const WORDS = 'abcdefghij'.split('').map(x => ({ id: `w:${x}`, gloss: `gloss ${x}`, glosses: [`gloss ${x}`] }))

describe('knownThenNearest', () => {
  it('lists the words met first, then all by distance in course order', () => {
    for (let seed = 1; seed < 10; seed++) {
      const out = knownThenNearest('w:e', WORDS, new Set(['w:a', 'w:j']), seeded(seed)).map(w => w.id)
      expect(out.slice(0, 2).sort()).toEqual(['w:a', 'w:j'])
      expect(out.slice(2, 5)).toEqual(['w:e', 'w:d', 'w:f'])
    }
  })
})

describe('pickMeaningOptions', () => {
  it('gives three other words, ones the learner met first', () => {
    const known = new Set(['w:h', 'w:i'])
    for (let seed = 1; seed < 20; seed++) {
      const wrong = pickMeaningOptions(WORDS[0], WORDS, known, never, seeded(seed))
      expect(wrong).toHaveLength(3)
      expect(wrong.slice(0, 2).sort()).toEqual(['w:h', 'w:i'])
      // then the closest in course order
      expect(wrong[2]).toBe('w:b')
    }
  })

  it('never offers the same gloss, one too close, or a gloss twice (KR72)', () => {
    const word = (id: string, gloss: string) => ({ id, gloss, glosses: [gloss] })
    const words = [
      word('w:a', 'tall'), word('w:b', 'tall'), word('w:c', 'up'),
      word('w:d', 'low'), word('w:e', 'low'), word('w:f', 'red'), word('w:g', 'blue'),
    ]
    const close = (a: string, b: string) => [a, b].sort().join() === 'tall,up'
    expect(pickMeaningOptions(words[0], words, new Set(), close, seeded())).toEqual(['w:d', 'w:f', 'w:g'])
  })

  it('never offers a gloss that is one of the source glosses of the answer, or the other way round', () => {
    const words = [
      { id: 'w:a', gloss: 'big', glosses: ['big; large', 'great'] },
      { id: 'w:b', gloss: 'large', glosses: ['large'] },
      { id: 'w:c', gloss: 'huge', glosses: ['huge; big'] },
      { id: 'w:d', gloss: 'red', glosses: ['red'] },
      { id: 'w:e', gloss: 'blue', glosses: ['blue'] },
      { id: 'w:f', gloss: 'great', glosses: ['great'] },
      { id: 'w:g', gloss: 'green', glosses: ['green'] },
    ]
    expect(pickMeaningOptions(words[0], words, new Set(), never, seeded()).sort()).toEqual(['w:d', 'w:e', 'w:g'])
  })

  it('compares glosses by their parts, case and punctuation aside', () => {
    const words = [
      { id: 'w:a', gloss: 'what spot', glosses: ['what spot', 'how many spots'] },
      { id: 'w:b', gloss: 'What spot?; what spot of the map?', glosses: ['What spot?; what spot of the map?'] },
      { id: 'w:c', gloss: 'red', glosses: ['red'] },
      { id: 'w:d', gloss: 'blue; Red.', glosses: ['blue; Red.'] },
      { id: 'w:e', gloss: 'green', glosses: ['green'] },
      { id: 'w:f', gloss: 'pink', glosses: ['pink'] },
    ]
    // b is the answer said again, d shares a part with c, which comes first
    expect(pickMeaningOptions(words[0], words, new Set(), never, seeded()).sort()).toEqual(['w:c', 'w:e', 'w:f'])
    expect(pickMeaningOptions(words[1], words, new Set(), never, seeded())).not.toContain('w:a')
  })
})

describe('pickReadingOptions', () => {
  it('fills with readings of words met first, then of the nearest words', () => {
    const word = (id: string, reading: string) => ({ id, reading, readings: [reading], homographs: [], split: [] })
    // ん has no near misses at all, so every option comes from the fill
    const words = [word('w:a', 'ん'), word('w:b', 'ほ'), word('w:c', 'ら'), word('w:d', 'む'), word('w:e', 'め')]
    for (let seed = 1; seed < 10; seed++) {
      const opts = pickReadingOptions(words[0], words, new Set(['w:e']), () => [], seeded(seed))
      expect(opts).toEqual(['め', 'ほ', 'ら'])
    }
  })
})

describe('pickSpellOptions', () => {
  // the word ABる read あいる, A is the part あ and B the part い
  const WORD = {
    form: 'ABる', reading: 'あいる', kanji: ['A', 'B'],
    split: [{ text: 'A', reading: 'あ' }, { text: 'B', reading: 'い' }, { text: 'る', reading: 'る' }],
  }
  const entry = (kanji: string, set: string, order: number): KanjiEntry =>
    ({ id: `k:${kanji}`, kanji, keyword: kanji, meanings: [], strokeCount: 1, parts: [], hook: '', set, order, words: [] })
  const ALL = [
    entry('A', 's1', 0), entry('B', 's1', 1), entry('C', 's2', 2), entry('D', 's2', 3), entry('E', 's2', 4),
    entry('F', 's2', 5), entry('G', 's1', 6), entry('H', 's3', 7), entry('I', 's3', 8), entry('J', 's3', 9),
  ]
  const none = () => [] as string[]

  it('swaps one kanji for a confusion or lookalike first, then one with the same reading, then the set (KR18, KR16)', () => {
    const opts = pickSpellOptions(WORD, ALL, k => k === 'B' ? ['C'] : [], new Set(),
      r => r === 'あ' ? ['E', 'A'] : r === 'い' ? ['F'] : [], never, seeded())
    expect(opts).toEqual(['ACる', 'EBる', 'AFる'])
    expect(pickSpellOptions(WORD, ALL, none, new Set(), none, never, seeded())).toEqual(['GBる', 'AGる', expect.any(String)])
  })

  it('takes turns over the kanji of the word within a tier', () => {
    const opts = pickSpellOptions(WORD, ALL, k => k === 'A' ? ['C', 'D'] : ['E', 'F'], new Set(), none, never, seeded())
    expect(opts).toEqual(['CBる', 'AEる', 'DBる'])
  })

  it('falls back to the kanji met and then the nearest ones', () => {
    const small = [entry('A', 's1', 0), entry('B', 's2', 1), entry('H', 's3', 2), entry('I', 's4', 3), entry('J', 's5', 4)]
    const opts = pickSpellOptions(WORD, small, none, new Set(['J']), none, never, seeded())
    expect(opts.slice(0, 2).sort()).toEqual(['AJる', 'JBる'])
    expect(opts[2]).toMatch(/^(HB|AH|IB|AI)る$/)
  })

  it('swaps one place of a kanji the word has twice', () => {
    const twice = { form: 'ABA', reading: 'あいう', kanji: ['A', 'B'], split: [] }
    const opts = pickSpellOptions(twice, ALL, k => k === 'A' ? ['C'] : [], new Set(), none, never, seeded())
    expect(opts[0]).toBe('CBA')
    for (const f of opts) expect([...f].filter((ch, i) => ch !== twice.form[i]), f).toHaveLength(1)
  })

  it('never makes the form of another word with the same reading, nor uses a kanji of the word', () => {
    const opts = pickSpellOptions(WORD, ALL, () => ['A', 'B', 'C', 'D', 'E'], new Set(), none,
      (form, reading) => form === 'CBる' && reading === 'あいる', seeded())
    expect(opts).not.toContain('CBる')
    expect(opts.every(f => !/AA|BB/.test(f))).toBe(true)
    expect(new Set(opts).size).toBe(3)
  })
})
