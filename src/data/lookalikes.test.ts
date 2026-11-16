import { describe, it, expect } from 'vitest'
import { LOOKALIKES, lookalikesOf, lookalikeHint } from './lookalikes'
import { allPairs } from './kana'

describe('lookalikes', () => {
  it('only lists kana that exist in the tables', () => {
    const known = new Set(allPairs().map(p => p.kana))
    for (const g of LOOKALIKES)
      for (const k of g.kana) expect(known.has(k), k).toBe(true)
  })

  it('returns the other members of the group', () => {
    expect(lookalikesOf('ぬ')).toEqual(['め'])
    expect(lookalikesOf('ね')).toEqual(['れ', 'わ'])
    expect(lookalikesOf('ん')).toEqual([])
  })

  it('merges the groups of a kana that is in more than one', () => {
    expect(lookalikesOf('は')).toEqual(['ほ', 'ま', 'け'])
    expect(lookalikesOf('コ')).toEqual(['ユ', 'ロ'])
  })

  it('finds a hint for a pair in the same group', () => {
    expect(lookalikeHint('シ', 'ツ')).toContain('シ')
    expect(lookalikeHint('シ', 'ぬ')).toBeNull()
  })
})
