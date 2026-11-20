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
    expect(toKana('si')).toBe('し')
    expect(toKana('tu')).toBe('つ')
    expect(toKana('hu')).toBe('ふ')
    expect(toKana('ti')).toBe('ち')
    expect(toKana('zya')).toBe('じゃ')
    expect(toKana('jyo')).toBe('じょ')
    expect(toKana('tyu')).toBe('ちゅ')
    expect(toKana('di')).toBe('ぢ')
    expect(toKana('dzu')).toBe('づ')
  })

  it('writes long vowels as typed', () => {
    expect(toKana('kou')).toBe('こう')
    expect(toKana('koo')).toBe('こお')
    expect(toKana('kei')).toBe('けい')
    expect(toKana('kee')).toBe('けえ')
    expect(toKana('shuu')).toBe('しゅう')
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
    expect(toKana('kan')).toBe('かん')
    expect(toKana('kann')).toBe('かん')
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

  it('reads an n before a vowel or y as ん on request', () => {
    expect(toKana('kanya', { nAlone: true })).toBe('かんや')
    expect(toKana('kana', { nAlone: true })).toBe('かんあ')
    expect(kanaWays('kanyou')).toEqual(['かにょう', 'かんよう'])
    expect(kanaWays('kanta')).toEqual(['かんた'])
  })

  it('keeps a trailing n a letter for the preview', () => {
    expect(toKana('kan', { trailingN: false })).toBe('かn')
    expect(toKana('kann', { trailingN: false })).toBe('かん')
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
    expect(cleanTyped('ｋａ')).toBe('ka')
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
    expect(previewParts('kakpu')).toEqual([{ text: 'か', pending: false }, { text: 'k', pending: true }, { text: 'ぷ', pending: false }])
    expect(previewParts('kan')).toEqual([{ text: 'か', pending: false }, { text: 'n', pending: true }])
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
    expect(isRomajiSlip('sk', ['し'])).toBe(true)
    expect(isRomajiSlip('kanyoi', ['かんよう'])).toBe(true)
  })

  it('is no slip when right, far off, or typed in kana', () => {
    expect(isRomajiSlip('kakkou', ['かっこう'])).toBe(false)
    expect(isRomajiSlip('nemu', ['かっこう'])).toBe(false)
    expect(isRomajiSlip('かっこお', ['かっこう'])).toBe(false)
  })
})
