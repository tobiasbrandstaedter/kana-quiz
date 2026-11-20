import { describe, it, expect } from 'vitest'
import { seeded } from './seeded'
import { readingMistake, readingOptions } from './readings'
import type { KanjiReading, ReadingPart } from '../types'

// Made up kana strings and letters for kanji, none of this is a reading of a real word.
const none = () => [] as KanjiReading[]

// X is read あさ here and もと in another word, Y ねに
const SPLIT: ReadingPart[] = [{ text: 'X', reading: 'あさ', kind: 'kun' }, { text: 'Y', reading: 'ねに', kind: 'on' }]
const READINGS: Record<string, KanjiReading[]> = {
  X: [{ reading: 'あさ', kind: 'kun', word: 'w:X:あさ' }, { reading: 'もと', kind: 'on', word: 'w:XZ:もとそ' }, { reading: 'あざ', word: 'w:ZX:けあざ' }],
  Y: [{ reading: 'ねに', kind: 'on', word: 'w:XY:あさねに' }],
}
const readingsOf = (k: string) => READINGS[k] ?? []

describe('readingMistake', () => {
  it('names a vowel held too long or too short', () => {
    expect(readingMistake('ねこ', 'ねこう', [], none)).toEqual({ kind: 'long-vowel' })
    expect(readingMistake('ねこうう', 'ねこう', [], none)).toEqual({ kind: 'long-vowel' })
    expect(readingMistake('さあ', 'さ', [], none)).toEqual({ kind: 'long-vowel' })
  })

  it('names a long vowel held with the wrong kana', () => {
    expect(readingMistake('ねこお', 'ねこう', [], none)).toEqual({ kind: 'vowel-kana' })
    expect(readingMistake('めせえ', 'めせい', [], none)).toEqual({ kind: 'vowel-kana' })
  })

  it('names a small っ added or dropped', () => {
    expect(readingMistake('まか', 'まっか', [], none)).toEqual({ kind: 'small-tsu' })
    expect(readingMistake('まっか', 'まか', [], none)).toEqual({ kind: 'small-tsu' })
  })

  it('names a sound voiced or unvoiced', () => {
    expect(readingMistake('だか', 'たか', [], none)).toEqual({ kind: 'voicing' })
    expect(readingMistake('ぱに', 'はに', [], none)).toEqual({ kind: 'voicing' })
    expect(readingMistake('ほろ', 'ぼろ', [], none)).toEqual({ kind: 'voicing' })
  })

  it('names another reading of one of the kanji, with the word it comes from', () => {
    expect(readingMistake('もとねに', 'あさねに', SPLIT, readingsOf)).toEqual({
      kind: 'other-reading', kanji: 'X', reading: 'もと', right: 'あさ', word: 'w:XZ:もとそ',
    })
  })

  it('prefers the near miss when the other reading is one', () => {
    expect(readingMistake('あざねに', 'あさねに', SPLIT, readingsOf)).toEqual({ kind: 'voicing' })
  })

  it('has no name for anything else', () => {
    expect(readingMistake('るるる', 'あさねに', SPLIT, readingsOf)).toBeNull()
    expect(readingMistake('あさねに', 'あさねに', SPLIT, readingsOf)).toBeNull()
  })
})

describe('readingOptions', () => {
  const WORD = { reading: 'あさねに', readings: ['あさねに'], homographs: [], split: SPLIT }
  const kindOf = (r: string) => readingMistake(r, WORD.reading, SPLIT, readingsOf)?.kind

  it('puts another reading of a kanji first, then one near miss of each other kind', () => {
    for (let seed = 1; seed < 30; seed++) {
      const opts = readingOptions(WORD, readingsOf, [], seeded(seed))
      expect(opts).toHaveLength(3)
      expect(opts[0]).toBe('もとねに')
      const kinds = opts.slice(1).map(kindOf)
      expect(kinds.every(k => k && k !== 'other-reading'), opts.join()).toBe(true)
      expect(new Set(kinds).size).toBe(2)
    }
  })

  it('never offers an accepted reading', () => {
    const word = { reading: 'さ', readings: ['さ', 'ざ', 'さあ'], homographs: [], split: [] }
    for (let seed = 1; seed < 30; seed++) {
      const opts = readingOptions(word, none, ['ざ', 'ほ', 'ら', 'む'], seeded(seed))
      expect(opts).not.toContain('ざ')
      expect(opts).not.toContain('さあ')
      expect(opts).toHaveLength(3)
    }
  })

  it('never offers a reading another word gives the same form', () => {
    // もとねに is how another word with this form is read: right too, so never a trap
    const word = { ...WORD, homographs: ['もとねに', 'あざねに'] }
    for (let seed = 1; seed < 30; seed++) {
      const opts = readingOptions(word, readingsOf, ['もとねに'], seeded(seed))
      expect(opts).not.toContain('もとねに')
      expect(opts).not.toContain('あざねに')
    }
  })

  it('fills from the readings it is given when the word has too few near misses', () => {
    const word = { reading: 'に', readings: ['に'], homographs: [], split: [] }
    expect(readingOptions(word, none, ['に', 'ほ', 'ら'], seeded()).sort()).toEqual(['にい', 'ほ', 'ら'].sort())
  })

  it('makes nothing that cannot be a reading', () => {
    const word = { reading: 'かっさき', readings: ['かっさき'], homographs: [], split: [] }
    for (let seed = 1; seed < 30; seed++) {
      for (const reading of readingOptions(word, none, [], seeded(seed))) {
        expect(reading.endsWith('っ')).toBe(false)
        expect(reading).not.toMatch(/^[っんゃゅょ]|っっ/)
      }
    }
  })

  it('does not split a syllable with a small kana', () => {
    const word = { reading: 'きょう', readings: ['きょう'], homographs: [], split: [] }
    for (let seed = 1; seed < 30; seed++) {
      for (const reading of readingOptions(word, none, [], seeded(seed))) expect(reading).not.toMatch(/^き[^ょ]/)
    }
  })
})
