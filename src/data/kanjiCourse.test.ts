import { describe, it, expect } from 'vitest'
import { CLOSE_MEANINGS, KANJI_LOOKALIKES, KANJI_SETS, WORD_GROUPS } from './kanjiCourse'
import { GROUP_SOURCE, KANJI_SOURCE, WORD_SOURCE } from './kanjiSource'
import { homeKanji, ownWords, wordById, wordGroups } from './kanjiData'

// Rules of docs/kanji-requirements.md over the hand written course and the generated data.
// The KR ids are in the test names.

const kanjiList = KANJI_SETS.flatMap(s => s.kanji)
const order = kanjiList.map(k => k.kanji)
const position = (k: string) => order.indexOf(k)
const setOf = (k: string) => KANJI_SETS.find(s => s.kanji.some(e => e.kanji === k))
const courseWords = kanjiList.flatMap(k => k.words.map(w => ({ ...w, owner: k.kanji })))
// every course word next to its merged entry. kanjiData throws on import when the
// script has no data for a word, with a message that says to rerun it.
const merged = kanjiList.flatMap(k => ownWords(k.kanji).map((entry, i) => ({ course: k.words[i], entry, first: i === 0 })))

const isKana = (ch: string) => /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(ch)
const DASHES = /[–—]/

describe('kanji sets', () => {
  it('holds no kanji twice and only kanji of the set (KD1)', () => {
    expect(new Set(order).size).toBe(order.length)
    for (const k of order) expect(KANJI_SOURCE[k], k).toBeDefined()
  })

  it('covers every kanji of the former level 4 plus 曜 (KD1)', () => {
    expect([...order].sort()).toEqual(Object.keys(KANJI_SOURCE).sort())
  })

  it('has 4 to 8 kanji per set, a title and a unique id (KR6)', () => {
    expect(new Set(KANJI_SETS.map(s => s.id)).size).toBe(KANJI_SETS.length)
    for (const s of KANJI_SETS) {
      expect(s.title.trim(), s.id).not.toBe('')
      expect(s.kanji.length, s.id).toBeGreaterThanOrEqual(4)
      expect(s.kanji.length, s.id).toBeLessThanOrEqual(8)
    }
  })

  it('puts 曜 in one set with 週 (KR7)', () => {
    expect(setOf('曜')).toBeDefined()
    expect(setOf('曜')).toBe(setOf('週'))
  })
})

describe('kanji', () => {
  it('takes its keyword from the source meanings', () => {
    for (const k of kanjiList) expect(KANJI_SOURCE[k.kanji].meanings, k.kanji).toContain(k.keyword)
  })

  it('names as parts only earlier kanji that KanjiVG confirms (KR8)', () => {
    for (const k of kanjiList) {
      for (const p of k.parts ?? []) {
        expect(position(p), `${p} in ${k.kanji}`).toBeGreaterThanOrEqual(0)
        expect(position(p), `${p} before ${k.kanji}`).toBeLessThan(position(k.kanji))
        expect(KANJI_SOURCE[k.kanji].parts, `${p} in ${k.kanji}`).toContain(p)
      }
    }
  })

  it('owns 1 to 4 words (KR2)', () => {
    for (const k of kanjiList) {
      expect(k.words.length, k.kanji).toBeGreaterThanOrEqual(1)
      expect(k.words.length, k.kanji).toBeLessThanOrEqual(4)
    }
  })

  it('has a reading in its picked words for every reading two N5 words share (KR2)', () => {
    // course words and the group words that get practiced (三 read みっ lives in 三つ and 三日)
    const practiced = wordGroups()
      .flatMap(g => [...g.members.filter(m => m.practiced).map(m => m.word), ...(g.question ? [g.question] : [])])
      .map(id => wordById(id)!)
    const parts = [...merged.map(m => m.entry), ...practiced].flatMap(w => w.split)
    for (const k of kanjiList) {
      const shown = parts.filter(p => p.text === k.kanji).map(p => p.reading)
      for (const r of KANJI_SOURCE[k.kanji].n5Readings) expect(shown, `${k.kanji} read ${r}`).toContain(r)
    }
  })

  it('has a one line hook without dashes (KR62)', () => {
    for (const k of kanjiList) {
      expect(k.hook.trim(), k.kanji).not.toBe('')
      expect(k.hook, k.kanji).not.toMatch(/\n/)
      expect(k.hook, k.kanji).not.toMatch(DASHES)
    }
  })
})

describe('words', () => {
  it('are JMdict entries with that form, the script has data for each (KR61)', () => {
    for (const m of merged) {
      expect(m.entry.form).toBe(m.course.form)
      expect(m.entry.jmdict).toBe(m.course.jmdict)
    }
  })

  it('are common and written with kanji of the course and kana only (KR1)', () => {
    for (const m of merged) {
      expect(m.entry.common, m.course.form).toBe(true)
      for (const ch of m.course.form) expect(isKana(ch) || order.includes(ch), `${ch} in ${m.course.form}`).toBe(true)
    }
  })

  it('are in the N5 list or say why, at most 40 say why (KR1)', () => {
    for (const m of merged) {
      if (m.entry.n5) continue
      expect(m.course.why?.trim(), `${m.course.form} is not in the N5 list`).toBeTruthy()
    }
    expect(merged.filter(m => !m.entry.n5).length).toBeLessThanOrEqual(40)
  })

  it('are listed under their home kanji (KR3)', () => {
    for (const w of courseWords) expect(homeKanji(w.form), w.form).toBe(w.owner)
  })

  it('never start a kanji with a special reading (KR4)', () => {
    for (const m of merged.filter(m => m.first)) expect(m.entry.special, m.course.form).toBe(false)
  })

  it('give a kanji only a meaning out of its source meanings (KR13)', () => {
    for (const w of courseWords) {
      for (const [k, meaning] of Object.entries(w.meanings ?? {})) {
        expect(w.form, `${k} in ${w.form}`).toContain(k)
        expect(KANJI_SOURCE[k].meanings, `${k} in ${w.form}`).toContain(meaning)
      }
    }
  })

  it('have a gloss and a why without dashes', () => {
    for (const w of courseWords) {
      expect(w.gloss.trim(), w.form).not.toBe('')
      expect(w.gloss, w.form).not.toMatch(DASHES)
      if (w.why !== undefined) expect(w.why, w.form).not.toMatch(DASHES)
    }
  })

  it('are listed once among the course words and once among all group words', () => {
    // a group member may be a course word too (百 heading the hundreds), not twice either side
    const twice = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(twice(merged.map(m => m.entry.id))).toEqual([])
    expect(twice(Object.values(GROUP_SOURCE).flatMap(g => [...g.members.map(m => m.word), ...(g.question ? [g.question] : [])]))).toEqual([])
  })
})

describe('word groups', () => {
  it('have a course kanji as counter and a unique id (KR73)', () => {
    expect(new Set(WORD_GROUPS.map(g => g.id)).size).toBe(WORD_GROUPS.length)
    for (const g of WORD_GROUPS) expect(order, g.id).toContain(g.counter)
  })

  it('only have members JMdict has (KR74)', () => {
    for (const g of WORD_GROUPS) {
      const src = GROUP_SOURCE[g.id]
      expect(src.members.length, `${g.id}: the script left members out, see its output`).toBe(g.members.length)
      expect(src.question !== null, g.id).toBe(g.question !== undefined)
      for (const m of src.members) expect(WORD_SOURCE[m.word], m.word).toBeDefined()
    }
  })

  it('make 曜 the counter of the weekday group (KR7)', () => {
    expect(wordGroups().some(g => g.counter === '曜')).toBe(true)
  })

  it('have a title without dashes', () => {
    for (const g of WORD_GROUPS) {
      expect(g.title.trim(), g.id).not.toBe('')
      expect(g.title, g.id).not.toMatch(DASHES)
    }
  })
})

describe('lookalikes and close meanings', () => {
  it('group only course kanji, with a one line hint without dashes (KR62)', () => {
    for (const g of KANJI_LOOKALIKES) {
      expect(g.kanji.length).toBeGreaterThanOrEqual(2)
      for (const k of g.kanji) expect(order, k).toContain(k)
      expect(g.hint.trim(), g.kanji.join('')).not.toBe('')
      expect(g.hint, g.kanji.join('')).not.toMatch(/\n/)
      expect(g.hint, g.kanji.join('')).not.toMatch(DASHES)
    }
  })

  it('pair only keywords or glosses of the course (KR15)', () => {
    const known = new Set([...kanjiList.map(k => k.keyword), ...courseWords.map(w => w.gloss)])
    for (const [a, b] of CLOSE_MEANINGS) {
      expect(known.has(a), a).toBe(true)
      expect(known.has(b), b).toBe(true)
    }
  })
})
