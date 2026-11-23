import { describe, it, expect } from 'vitest'
import { cleanTyped, hasKanji, isAllKana, isRomajiSlip, kanaWays, previewParts, toKana } from './kanaInput'
import { allPairs } from '../data/kana'
import { acceptedRomaji } from './romaji'

// Syllables only: romaji and kana as such, no reading of a real word.

describe('toKana', () => {
  it('turns every spelling the kana quiz accepts into its hiragana', () => {
    for (const p of allPairs()) {
      if (p.script !== 'hiragana' || p.kana === 'ん') continue
      for (const r of acceptedRomaji(p.kana, p.romaji)) {
        // ji and zu give じ and ず, the usual ones; ぢ and づ have di, du, dji, dzu
        const want = r === 'ji' ? 'じ' : r === 'zu' ? 'ず' : p.kana
        expect(toKana(r), r).toBe(want)
      }
    }
  })

  it('takes the spellings of romaji.ts', () => {
    expect(toKana('sire')).toBe('しれ')
    expect(toKana('tu')).toBe('つ')
    expect(toKana('hura')).toBe('ふら')
    expect(toKana('tiru')).toBe('ちる')
    expect(toKana('zya')).toBe('じゃ')
    expect(toKana('jyo')).toBe('じょ')
    expect(toKana('tyu')).toBe('ちゅ')
    expect(toKana('di')).toBe('ぢ')
    expect(toKana('dzu')).toBe('づ')
  })

  it('writes long vowels as typed', () => {
    expect(toKana('mekou')).toBe('めこう')
    expect(toKana('mekoo')).toBe('めこお')
    expect(toKana('kei')).toBe('けい')
    expect(toKana('kee')).toBe('けえ')
    expect(toKana('shuure')).toBe('しゅうれ')
  })

  it('makes a doubled consonant a small っ', () => {
    expect(toKana('kakko')).toBe('かっこ')
    expect(toKana('happa')).toBe('はっぱ')
    expect(toKana('kocchi')).toBe('こっち')
    expect(toKana('kotchi')).toBe('こっち')
    expect(toKana('mattsu')).toBe('まっつ')
  })

  it('gives ん for nn, n\', an n before a consonant or kana and at the end', () => {
    expect(toKana('kanna')).toBe('かんな')
    expect(toKana('kannna')).toBe('かんな')
    expect(toKana('kanta')).toBe('かんた')
    expect(toKana('ran')).toBe('らん')
    expect(toKana('rann')).toBe('らん')
    expect(toKana("kan'a")).toBe('かんあ')
    expect(toKana('kana')).toBe('かな')
    expect(toKana('kanya')).toBe('かにゃ')
    expect(toKana("kan'ya")).toBe('かんや')
    expect(toKana('kanた')).toBe('かんた')
  })

  it('makes an m before b, p or m ん', () => {
    expect(toKana('samba')).toBe('さんば')
    expect(toKana('sampo')).toBe('さんぽ')
    expect(toKana('kamma')).toBe('かんま')
    expect(toKana('kama')).toBe('かま')
  })

  it('gives every way to read an n before a vowel or y, the plain one first', () => {
    expect(kanaWays('kanyou')).toEqual(['かにょう', 'かんよう'])
    expect(kanaWays('kanta')).toEqual(['かんた'])
    // each such n on its own: the first one starts a syllable, the second is ん
    expect(kanaWays('nanyo')).toEqual(['なにょ', 'なんよ'])
    expect(kanaWays('kanina')).toEqual(['かにな', 'かんいな', 'かにんあ', 'かんいんあ'])
    // n' decides it already
    expect(kanaWays("kan'ya")).toEqual(['かんや'])
    // nn before a vowel or y keeps the second n for the syllable, or is ん alone
    expect(kanaWays('monnite')).toEqual(['もんにて', 'もんいて'])
    expect(kanaWays('kinnyou')).toEqual(['きんにょう', 'きんよう'])
    expect(kanaWays('kannta')).toEqual(['かんた'])
  })

  it('reads a final n or nn as ん', () => {
    expect(toKana('ran')).toBe('らん')
    expect(toKana('rann')).toBe('らん')
  })

  it('leaves letters that make no kana as typed', () => {
    expect(toKana('kak')).toBe('かk')
    expect(toKana('ky')).toBe('ky')
    expect(toKana('kakpu')).toBe('かkぷ')
  })

  it('lets kana through and turns katakana into hiragana', () => {
    expect(toKana('かっこう')).toBe('かっこう')
    expect(toKana('カッコウ')).toBe('かっこう')
    expect(toKana('ｶｯｺｳ')).toBe('かっこう')
    expect(toKana('かta')).toBe('かた')
  })
})

describe('cleanTyped', () => {
  it('drops what is no letter, apostrophe or kana, and makes the curly apostrophe plain', () => {
    expect(cleanTyped(' KA ta. ')).toBe('kata')
    expect(cleanTyped('ｒａ')).toBe('ra')
    expect(cleanTyped('ka3t,ö!')).toBe('kat')
    expect(cleanTyped('kan’a')).toBe("kan'a")
    expect(toKana('kan’a')).toBe('かんあ')
    expect(cleanTyped('カタ')).toBe('かた')
  })

  it('tells kanji in the input', () => {
    expect(hasKanji('か日')).toBe(true)
    expect(hasKanji('かta')).toBe(false)
  })
})

describe('previewParts and isAllKana', () => {
  it('split kana so far from letters left', () => {
    expect(previewParts('rakpu')).toEqual([{ text: 'ら', pending: false }, { text: 'k', pending: true }, { text: 'ぷ', pending: false }])
    // a final n shows as the ん that Check would send
    expect(previewParts('san')).toEqual([{ text: 'さん', pending: false }])
    expect(previewParts('sana')).toEqual([{ text: 'さな', pending: false }])
    expect(previewParts('sank')).toEqual([{ text: 'さん', pending: false }, { text: 'k', pending: true }])
    expect(previewParts('')).toEqual([])
    expect(isAllKana('かっこう')).toBe(true)
    expect(isAllKana('かn')).toBe(false)
    expect(isAllKana('')).toBe(false)
  })
})

describe('isRomajiSlip', () => {
  it('finds one letter swapped, dropped or added, and two neighbours swapped', () => {
    expect(isRomajiSlip('kakkpu', ['かっこう'])).toBe(true)
    expect(isRomajiSlip('kakou', ['かっこう'])).toBe(true)
    expect(isRomajiSlip('kakkoou', ['かっこう'])).toBe(true)
    expect(isRomajiSlip('kskkou', ['かっこう'])).toBe(true)
    expect(isRomajiSlip('kakkuo', ['かっこう'])).toBe(true)
    expect(isRomajiSlip('kakpu', ['かっこう'])).toBe(false)  // two off
  })

  it('measures against every accepted spelling, n both ways', () => {
    expect(isRomajiSlip('skre', ['しれ'])).toBe(true)
    expect(isRomajiSlip('kanyoi', ['かんよう'])).toBe(true)
  })

  it('is no slip when right, far off, or typed in kana', () => {
    expect(isRomajiSlip('kakkou', ['かっこう'])).toBe(false)
    expect(isRomajiSlip('nemu', ['かっこう'])).toBe(false)
    expect(isRomajiSlip('かっこお', ['かっこう'])).toBe(false)
  })
})
