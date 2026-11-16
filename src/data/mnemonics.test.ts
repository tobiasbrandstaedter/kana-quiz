import { describe, it, expect } from 'vitest'
import { mnemonicFor } from './mnemonics'
import { HIRAGANA, KATAKANA, allPairs } from './kana'

describe('mnemonicFor', () => {
  it('has a line for every basic kana', () => {
    const main = [HIRAGANA, KATAKANA].flatMap(t => t.main.flatMap(c => c.kana))
    expect(main.filter(k => !mnemonicFor(k))).toEqual([])
  })

  it('builds dakuten and combinations from the base kana', () => {
    expect(mnemonicFor('が')).toBe('か (ka) plus marks: the two ticks make the sound voiced, ga')
    expect(mnemonicFor('パ')).toBe('ハ (ha) plus marks: the little circle turns h into p, pa')
    expect(mnemonicFor('きゃ')).toBe('き (ki) with a small ゃ glides together: kya')
  })

  it('covers the whole table', () => {
    expect(allPairs().filter(p => !mnemonicFor(p.kana))).toEqual([])
  })
})
