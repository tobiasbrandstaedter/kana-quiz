import { describe, it, expect } from 'vitest'
import { isIrregular, numberPart } from './groupMarks'
import { allKanji, ownWords, wordById, wordGroups } from '../data/kanjiData'

// made up: A and B are number kanji, C a counter, 㐀 a leading kanji with no counter in the form
const OWN = new Map([['A', 'ぬぬ'], ['B', 'ほほ'], ['㐀', 'ゆゆ']])
const tails = (tail: string) => tail === 'C' ? ['るる', 'れれ'] : []
const mark = (form: string, reading: string, counter = 'C') => isIrregular(form, reading, counter, OWN, tails)

describe('numberPart', () => {
  it('takes what comes before the counter, else the leading kanji', () => {
    expect(numberPart('ABC', 'C')).toBe('AB')
    expect(numberPart('㐀つ', '')).toBe('㐀')
    expect(numberPart('㐀つ', 'C')).toBe('㐀')
  })
})

describe('isIrregular', () => {
  it('is regular for the own readings followed by any reading of the tail', () => {
    expect(mark('AC', 'ぬぬるる')).toBe(false)
    expect(mark('ABC', 'ぬぬほほれれ')).toBe(false)
  })

  it('is irregular when no tail reading fits', () => {
    expect(mark('AC', 'ぬるる')).toBe(true)
    expect(mark('AC', 'ぬぬろろ')).toBe(true)
  })

  it('reads a kana tail as it is, katakana as hiragana', () => {
    expect(mark('㐀つ', 'ゆゆつ', '')).toBe(false)
    expect(mark('㐀ツ', 'ゆゆつ', '')).toBe(false)
    expect(mark('㐀つ', 'ゆつ', '')).toBe(true)
  })

  it('takes the number alone when nothing follows it', () => {
    expect(mark('㐀', 'ゆゆ', '')).toBe(false)
    expect(mark('㐀', 'ゆ', '')).toBe(true)
  })

  it('is null when a kanji of the number has no own reading', () => {
    expect(mark('AXC', 'ぬぬるる')).toBeNull()
  })
})

describe('the marks in the generated data (KR74)', () => {
  it('come out the same when computed again', () => {
    // a kanji read as a word of its own in the course
    const own = new Map<string, string>()
    for (const k of allKanji()) {
      const w = ownWords(k.kanji).find(x => x.form === k.kanji)
      if (w) own.set(k.kanji, w.reading)
    }
    // The script reads the tail with its common JMdict readings, which the generated data
    // doesn't carry. The regular members of a group imply them, so they stand in here: that
    // still checks that every regular member reads as the own readings plus a tail and no
    // irregular member does.
    let regular = 0
    let irregular = 0
    for (const g of wordGroups().filter(x => x.practice === 'irregular')) {
      const members = g.members.map(m => ({ ...m, w: wordById(m.word)! }))
      const implied = new Map<string, Set<string>>()
      for (const m of members.filter(x => !x.irregular)) {
        const head = numberPart(m.w.form, g.counter)
        const h = [...head].map(ch => own.get(ch) ?? '').join('')
        if (!m.w.reading.startsWith(h)) continue
        const tail = m.w.form.slice(head.length)
        implied.set(tail, (implied.get(tail) ?? new Set()).add(m.w.reading.slice(h.length)))
      }
      for (const m of members) {
        const again = isIrregular(m.w.form, m.w.reading, g.counter, own, t => [...(implied.get(t) ?? [])])
        expect(again, `${g.id} ${m.word}`).toBe(m.irregular)
        if (m.irregular) irregular++
        else regular++
      }
    }
    expect(irregular).toBeGreaterThan(0)
    expect(regular).toBeGreaterThan(0)
  })
})
