import { describe, it, expect } from 'vitest'
import { kanaStrokes } from './strokeGlyphs'
import { STROKES } from './strokes'
import { allPairs } from './kana'

describe('kanaStrokes', () => {
  it('lays out a single kana in one cell', () => {
    const s = kanaStrokes('あ')!
    expect(s.width).toBe(109)
    expect(s.strokes.map(x => x.d)).toEqual(STROKES['あ'].paths)
    expect(s.strokes.every(x => x.dx === 0)).toBe(true)
  })

  it('puts the small kana of a combo after the base kana', () => {
    const s = kanaStrokes('きゃ')!
    expect(s.width).toBeGreaterThan(109)
    expect(s.strokes).toHaveLength(STROKES['き'].paths.length + STROKES['ゃ'].paths.length)
    expect(s.strokes[0].dx).toBe(0)
    expect(s.strokes[s.strokes.length - 1].dx).toBeGreaterThan(0)
  })

  it('has stroke data for every kana in the table', () => {
    expect(allPairs().filter(p => !kanaStrokes(p.kana)).map(p => p.kana)).toEqual([])
  })

  it('returns null for unknown glyphs', () => {
    expect(kanaStrokes('x')).toBeNull()
    expect(kanaStrokes('')).toBeNull()
  })
})
