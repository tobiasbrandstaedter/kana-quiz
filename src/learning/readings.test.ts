import { describe, it, expect } from 'vitest'
import { seeded } from './seeded'
import { looksLikeReading, readingMistake, readingOptions, typedVerdict, verdictAnswer } from './readings'
import { kanaWays } from './kanaInput'
import { allKanji, kanjiReadings } from '../data/kanjiData'
import { WORD_SOURCE } from '../data/kanjiSource'
import type { KanjiReading, ReadingPart } from '../types'
// its own source, for the check at the end
import source from './readings.test.ts?raw'

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
    expect(readingMistake('でか', 'てか', [], none)).toEqual({ kind: 'voicing' })
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
      const opts = readingOptions(word, none, ['ざ', 'ほ', 'ら', 'へ'], seeded(seed))
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
    const word = { reading: 'ぬ', readings: ['ぬ'], homographs: [], split: [] }
    expect(readingOptions(word, none, ['ぬ', 'ほ', 'ら'], seeded()).sort()).toEqual(['ぬう', 'ほ', 'ら'].sort())
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
    const word = { reading: 'みょう', readings: ['みょう'], homographs: [], split: [] }
    for (let seed = 1; seed < 30; seed++) {
      for (const reading of readingOptions(word, none, [], seeded(seed))) expect(reading).not.toMatch(/^み[^ょ]/)
    }
  })
})


describe('looksLikeReading', () => {
  it('takes kana a reading could be', () => {
    for (const s of ['かっこう', 'みゅう', 'ええい', 'ねえ', 'さんぽ', 'しゃっか']) expect(looksLikeReading(s), s).toBe(true)
  })

  it('turns down what a bounced key gives', () => {
    for (const s of ['っご', 'がっっこう', 'きゅうう', 'こおお', 'かっ', 'かっな', 'んか', 'ゃく', 'かゃ', '']) expect(looksLikeReading(s), s).toBe(false)
  })
})

describe('typedVerdict', () => {
  // made up words of one, two, three and five kana. The two kana word also accepts ろお, the five
  // kana one has an ん before a y and a homograph
  type Word = { reading: string; readings: string[]; homographs: string[]; split: ReadingPart[] }
  const ONE: Word = { reading: 'ね', readings: ['ね'], homographs: [], split: [] }
  const TWO = { reading: 'さわ', readings: ['さわ', 'ろお'], homographs: [], split: [] }
  const FIVE = { reading: 'きんようか', readings: ['きんようか'], homographs: ['きにょうか'], split: [] }
  const THREE = { reading: 'きゅうか', readings: ['きゅうか'], homographs: [], split: [] }
  const TWO_G = { reading: 'げげ', readings: ['げげ'], homographs: [], split: [] }
  const THREE_KANA = { reading: 'てぬほ', readings: ['てぬほ'], homographs: [], split: [] }
  const ASANENI = { reading: 'あさねに', readings: ['あさねに', 'あさね'], homographs: ['もとね'], split: SPLIT }
  const KNOWN = new Set(['るるる', 'もと', 'へ'])
  const judge = (word: Word, typed: string, withSlip = false, isKnown = (k: string) => KNOWN.has(k)) =>
    typedVerdict(typed, word, readingsOf, isKnown, withSlip)
  const wrong = (kana: string, more: object = {}) => ({ result: 'wrong', kana, given: '', mistake: null, typo: false, ...more })

  it('takes every accepted reading, in romaji or kana', () => {
    expect(judge(ASANENI, 'asaneni')).toEqual({ result: 'right', kana: 'あさねに' })
    expect(judge(ASANENI, 'asane')).toEqual({ result: 'right', kana: 'あさね' })
    expect(judge(ASANENI, ' ASANENI. ')).toEqual({ result: 'right', kana: 'あさねに' })
    expect(judge(ASANENI, 'アサネニ')).toEqual({ result: 'right', kana: 'あさねに' })
    expect(judge(TWO, 'roo')).toEqual({ result: 'right', kana: 'ろお' })
  })

  it('reads an n before y both ways and takes the one that is right ', () => {
    expect(judge(FIVE, 'kinyouka')).toEqual({ result: 'right', kana: 'きんようか' })
    expect(judge(FIVE, "kin'youka")).toEqual({ result: 'right', kana: 'きんようか' })
    expect(judge(FIVE, 'kin’youka')).toEqual({ result: 'right', kana: 'きんようか' })
  })

  it('tells a homograph apart, it is not wrong', () => {
    expect(judge(ASANENI, 'motone')).toEqual({ result: 'homograph', kana: 'もとね' })
  })

  it('does not judge kanji, it asks for hiragana', () => {
    expect(judge(ONE, '日')).toEqual({ result: 'kanji' })
  })

  it('names a near miss against every accepted reading, before it could be a slip', () => {
    expect(judge(ASANENI, 'asaaneni')).toEqual(wrong('あさあねに', { mistake: { kind: 'long-vowel' } }))
    expect(judge(ASANENI, 'motoneni')).toMatchObject({ result: 'wrong', mistake: { kind: 'other-reading', kanji: 'X' } })
    // ろお is accepted but not shown first: ろう is the long vowel held with another kana
    expect(judge(TWO, 'rou')).toEqual(wrong('ろう', { mistake: { kind: 'vowel-kana' } }))
  })

  it('names nothing for kana no reading could be, a bounced key is a slip ', () => {
    expect(judge(FIVE, 'kkinyouka')).toEqual({ result: 'slip' })
    expect(judge(THREE, 'kyuuuka')).toEqual({ result: 'slip' })
    // っご is no reading, so no small っ mistake; two kana are too short for a slip
    expect(judge(TWO_G, 'ggege')).toEqual(wrong('っげげ'))
    // a small っ where one could be is still named
    expect(judge(FIVE, 'kinyoukka')).toEqual(wrong('きんようっか', { mistake: { kind: 'small-tsu' } }))
  })

  it('never lets clean kana pass as a slip for a reading of one or two kana (KR23)', () => {
    expect(judge(ONE, 'nu')).toEqual(wrong('ぬ'))
    expect(judge(ONE, 'nne')).toEqual(wrong('んね'))
    expect(judge(TWO, 'sawa'.replace('w', 'q'))).toEqual({ result: 'slip' })  // さqあ has a letter left
    expect(judge(TWO, 'sara')).toEqual(wrong('さら'))
  })

  it('lets clean kana one key off pass as a slip from three kana on', () => {
    expect(judge(THREE_KANA, 'tenoho')).toEqual({ result: 'slip' })
    expect(judge(TWO, 'sawo')).toEqual(wrong('さを'))
  })

  it('counts a second clean slip as a miss, only letters left over make it a typo (KR23)', () => {
    expect(judge(FIVE, 'kinyouko')).toEqual({ result: 'slip' })
    expect(judge(FIVE, 'kinyouko', true)).toEqual(wrong('きにょうこ'))
    expect(judge(FIVE, 'kinyoukq')).toEqual({ result: 'slip' })
    expect(judge(FIVE, 'kinyoukq', true)).toEqual(wrong('きにょうkq', { typo: true }))
    expect(judge(FIVE, 'kinyuoka')).toEqual({ result: 'slip' })
  })

  it('takes a known reading one keystroke off for a mix-up, not a slip', () => {
    expect(judge(ASANENI, 'asanemi', false, k => k === 'あさねみ')).toEqual(wrong('あさねみ', { given: 'あさねみ' }))
  })

  it('stores what was typed only when it is a known reading', () => {
    expect(judge(ASANENI, 'rururu')).toEqual(wrong('るるる', { given: 'るるる' }))
    expect(judge(ONE, 'he')).toEqual(wrong('へ', { given: 'へ' }))
    expect(judge(ASANENI, 'kokoko')).toEqual(wrong('こここ'))
  })
})

describe('verdictAnswer', () => {
  it('counts a right and a wrong reading, a typo holds the box', () => {
    expect(verdictAnswer({ result: 'right', kana: 'ねこう' })).toEqual({ correct: true, given: 'ねこう' })
    const miss = verdictAnswer({ result: 'wrong', kana: 'ねこ', given: 'ねこ', mistake: { kind: 'long-vowel' }, typo: false })
    expect(miss).toEqual({ correct: false, given: 'ねこ', typo: false, mistake: 'long-vowel' })
    const typo = verdictAnswer({ result: 'wrong', kana: 'ねこく', given: '', mistake: null, typo: true })
    expect(typo).toEqual({ correct: false, given: '', typo: true, mistake: undefined })
  })

  it('records nothing for a slip, a homograph or kanji in the input, the card asks again', () => {
    expect(verdictAnswer({ result: 'slip' })).toBeNull()
    expect(verdictAnswer({ result: 'homograph', kana: 'ねこう' })).toBeNull()
    expect(verdictAnswer({ result: 'kanji' })).toBeNull()
  })
})

describe('the fixtures of this file', () => {
  // reads its own source, so a fixture added later is checked without a list to keep up
  it('are no reading of the course, in kana or in romaji', () => {
    const real = new Set<string>()
    for (const w of Object.values(WORD_SOURCE)) [w.reading, ...w.readings].forEach(r => real.add(r))
    for (const k of allKanji()) kanjiReadings(k.kanji).forEach(r => real.add(r.reading))
    const literals = [...source.matchAll(/'([^'\n]+)'/g)].map(m => m[1])
    const kana = literals.filter(s => /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(s))
    const romaji = literals.filter(s => /^[a-z']+$/.test(s) && s.length > 1)
    expect(kana.length).toBeGreaterThan(20)
    expect(kana.filter(s => real.has(s))).toEqual([])
    expect(romaji.filter(s => kanaWays(s).some(k => real.has(k)))).toEqual([])
  })
})
