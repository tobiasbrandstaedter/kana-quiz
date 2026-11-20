import { describe, it, expect } from 'vitest'
import { WORD_SOURCE } from './kanjiSource'
import { allKanji, ownWords, wordById, wordGroups } from './kanjiData'

const courseWords = allKanji().flatMap(k => ownWords(k.kanji))
const groupWords = wordGroups()
  .flatMap(g => [...g.members.map(m => m.word), ...(g.question ? [g.question] : [])])
  .map(id => wordById(id)!)

describe('homographs', () => {
  it('are there for course words and group members alike', () => {
    for (const w of [...courseWords, ...groupWords]) expect(Array.isArray(w.homographs), w.id).toBe(true)
  })

  it('never repeat the word\'s own readings or themselves', () => {
    for (const w of Object.values(WORD_SOURCE)) {
      for (const r of w.homographs) expect(w.readings, `${w.form} ${r}`).not.toContain(r)
      expect(new Set(w.homographs).size, w.form).toBe(w.homographs.length)
    }
  })

  it('hold what other entries of the same form give, where the data has two of them', () => {
    const words = Object.values(WORD_SOURCE)
    const pairs = words.flatMap(a => words.filter(b => b.form === a.form && b.jmdict !== a.jmdict).map(b => [a, b]))
    for (const [a, b] of pairs)
      for (const r of b.readings.filter(r => !a.readings.includes(r))) expect(a.homographs, `${a.form} ${r}`).toContain(r)
  })

  it('only contain hiragana', () => {
    for (const w of Object.values(WORD_SOURCE))
      for (const r of w.homographs) expect(r, w.form).toMatch(/^[\p{Script=Hiragana}ー]+$/u)
  })
})
