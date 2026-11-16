import { describe, it, expect } from 'vitest'
import { pickDistractors } from './distractors'
import { allPairs, pairFor, kanaInfo } from '../data/kana'

const FULL = allPairs()
const fixedRng = () => 0.5

describe('pickDistractors', () => {
  it('puts personal confusions and lookalikes first', () => {
    const picked = pickDistractors(pairFor('ぬ')!, FULL, ['ね'], fixedRng)
    expect(picked.slice(0, 2)).toEqual(['ね', 'め'])
    expect(picked).toHaveLength(3)
  })

  it('fills from the same row or vowel, same script only', () => {
    const picked = pickDistractors(pairFor('か')!, FULL, [], fixedRng)
    expect(picked).toHaveLength(3)
    for (const k of picked) {
      const i = kanaInfo(k)!
      expect(i.pair.script).toBe('hiragana')
      expect(i.colId === 'ka' || i.vowel === 'a').toBe(true)
    }
  })

  it('never repeats or includes the answer', () => {
    const picked = pickDistractors(pairFor('シ')!, FULL, ['ツ', 'ツ', 'シ'], fixedRng)
    expect(new Set(picked).size).toBe(3)
    expect(picked).not.toContain('シ')
  })

  it('ignores preferred kana that are not in the pool', () => {
    const picked = pickDistractors(pairFor('ぬ')!, FULL, ['ヌ'], fixedRng)
    expect(picked).not.toContain('ヌ')
  })

  it('falls back to other scripts for tiny pools', () => {
    const pool = [pairFor('あ')!, pairFor('ア')!, pairFor('イ')!, pairFor('ウ')!]
    const picked = pickDistractors(pairFor('あ')!, pool, [], fixedRng)
    expect(picked.sort()).toEqual(['ア', 'イ', 'ウ'])
  })

  it('fills from known kana before unknown ones, lookalikes regardless', () => {
    const known = new Set(['あ', 'い', 'う', 'え', 'か', 'き'])
    const picked = pickDistractors(pairFor('あ')!, FULL, [], fixedRng, known)
    expect(picked[0]).toBe('お')
    expect(picked.slice(1).every(k => known.has(k))).toBe(true)
  })
})
