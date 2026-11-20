import { describe, it, expect } from 'vitest'
import { KANJI_SOURCE } from './kanjiSource'
import {
  allKanji, courseEntries, courseWords, groupOf, homeKanji, KANJI_DATA_DATE, KANJI_SOURCES, kanjiEntry, kanjiLookalikeHint, kanjiLookalikes,
  kanjiReadings, kanjiSets, kanjiStrokes, kanjiWithReading, ownWords, sameForm, tooClose, wordById, wordGroups, wordId, wordsWith,
} from './kanjiData'
import { CLOSE_MEANINGS, KANJI_LOOKALIKES, WORD_GROUPS } from './kanjiCourse'

// Examples come from the data itself, nothing here is typed from a dictionary.
const first = allKanji()[0]

describe('kanji entries', () => {
  it('come in set order with their position', () => {
    expect(allKanji().map(k => k.kanji)).toEqual(kanjiSets().flatMap(s => s.kanji))
    allKanji().forEach((k, i) => expect(k.order).toBe(i))
  })

  it('carry id, set and source facts', () => {
    const k = kanjiEntry(first.kanji)!
    expect(k.id).toBe(`k:${first.kanji}`)
    expect(k.set).toBe(kanjiSets()[0].id)
    expect(k.meanings).toEqual(KANJI_SOURCE[first.kanji].meanings)
    expect(k.strokeCount).toBe(KANJI_SOURCE[first.kanji].strokes)
    expect(kanjiEntry('あ')).toBeNull()
  })

  it('give the entries of the course kanji asked for, in that order, nothing for the rest', () => {
    const [a, b] = allKanji()
    expect(courseEntries([b.kanji, 'あ', a.kanji])).toEqual([b, a])
  })
})

describe('words', () => {
  it('are found by an id of form and shown reading', () => {
    for (const k of allKanji()) {
      for (const id of k.words) {
        const w = wordById(id)!
        expect(w.id).toBe(wordId(w.form, w.reading))
        expect(w.readings).toContain(w.reading)
      }
    }
    expect(wordById('w:nothing:here')).toBeNull()
  })

  it('list a kanji its own words first word first', () => {
    for (const k of allKanji()) expect(ownWords(k.kanji).map(w => w.id)).toEqual(k.words)
    expect(ownWords('あ')).toEqual([])
  })

  it('find every course word that contains a kanji', () => {
    for (const k of allKanji()) {
      const found = wordsWith(k.kanji)
      for (const w of found) expect(w.form).toContain(k.kanji)
      for (const own of k.words) expect(found.map(w => w.id)).toContain(own)
    }
  })

  it('are all listed as course words, by home kanji and teaching order', () => {
    expect(courseWords().map(w => w.id)).toEqual(allKanji().flatMap(k => k.words))
    for (const w of courseWords()) expect(w.group).toBeNull()
  })

  it('know the other course words written the same way', () => {
    for (const w of courseWords()) {
      const twins = sameForm(w)
      expect(twins.map(t => t.id)).toEqual(courseWords().filter(o => o.form === w.form && o.id !== w.id).map(o => o.id))
      expect(twins).not.toContain(w)
    }
  })

  it('belong to the kanji of theirs that comes last', () => {
    for (const k of allKanji()) {
      for (const w of ownWords(k.kanji)) {
        const home = homeKanji(w.form)!
        expect(w.home).toBe(home)
        expect(w.kanji).toContain(home)
        for (const other of w.kanji) expect(kanjiEntry(other)!.order).toBeLessThanOrEqual(kanjiEntry(home)!.order)
      }
    }
    expect(homeKanji('あいう')).toBeNull()
  })

  it('split their reading over the form', () => {
    for (const k of allKanji()) {
      for (const w of ownWords(k.kanji)) {
        if (w.split.length === 0) continue
        expect(w.split.map(p => p.text).join('')).toBe(w.form)
        expect(w.special).toBe(w.split.some(p => [...p.text].filter(ch => /\p{Script=Han}/u.test(ch)).length > 1))
      }
    }
  })
})

describe('kanji readings', () => {
  it('come from the words and practiced group words that contain the kanji, each reading once', () => {
    for (const k of allKanji()) {
      const readings = kanjiReadings(k.kanji)
      expect(new Set(readings.map(r => r.reading)).size).toBe(readings.length)
      for (const r of readings) {
        const part = wordById(r.word)!.split.find(p => p.text === k.kanji && p.reading === r.reading)
        expect(part, `${k.kanji} ${r.reading}`).toBeDefined()
        expect(r.kind).toBe(part!.kind)
      }
    }
  })

  it('include what the practiced group words show', () => {
    for (const g of wordGroups()) {
      const ids = [...g.members.filter(m => m.practiced).map(m => m.word), ...(g.question ? [g.question] : [])]
      for (const id of ids)
        for (const p of wordById(id)!.split)
          if (kanjiEntry(p.text)) expect(kanjiReadings(p.text).map(r => r.reading), `${p.text} in ${id}`).toContain(p.reading)
    }
  })

  it('find the kanji that share a reading, in course order', () => {
    const all = allKanji().map(k => k.kanji)
    for (const k of allKanji()) {
      for (const r of kanjiReadings(k.kanji)) {
        const found = kanjiWithReading(r.reading)
        expect(found).toContain(k.kanji)
        for (const other of found) expect(kanjiReadings(other).map(x => x.reading)).toContain(r.reading)
        expect(found).toEqual(all.filter(x => found.includes(x)))
      }
    }
    expect(kanjiWithReading('')).toEqual([])
  })

  it('label a reading on or kun when it is exactly one of the two in the source', () => {
    const readings = allKanji().flatMap(k => kanjiReadings(k.kanji).map(r => ({ k: k.kanji, ...r })))
    expect(readings.some(r => r.kind)).toBe(true)
    for (const r of readings) {
      const on = KANJI_SOURCE[r.k].on.includes(r.reading)
      const kun = KANJI_SOURCE[r.k].kun.map(x => x.split('.')[0]).includes(r.reading)
      if (on) expect(r.kind, `${r.k} ${r.reading}`).toBe('on')
      else if (kun) expect(r.kind, `${r.k} ${r.reading}`).toBe('kun')
    }
  })
})

describe('lookalikes and close meanings', () => {
  it('give the other kanji of a group and its hint', () => {
    for (const g of KANJI_LOOKALIKES) {
      for (const k of g.kanji) {
        for (const other of g.kanji.filter(o => o !== k)) {
          expect(kanjiLookalikes(k)).toContain(other)
          expect(kanjiLookalikeHint(k, other)).not.toBeNull()
        }
        expect(kanjiLookalikes(k)).not.toContain(k)
      }
    }
    expect(kanjiLookalikes('あ')).toEqual([])
    expect(kanjiLookalikeHint('あ', 'い')).toBeNull()
  })

  it('treat a close pair the same in both directions', () => {
    for (const [a, b] of CLOSE_MEANINGS) {
      expect(tooClose(a, b)).toBe(true)
      expect(tooClose(b, a)).toBe(true)
    }
    expect(tooClose(first.keyword, first.keyword + 'x')).toBe(false)
  })
})

// Skipped while kanjiCourse.ts has no groups yet, runs as soon as the first one is in.
describe.skipIf(WORD_GROUPS.length === 0)('word groups', () => {
  it('merge every member and question word of the course, in table order', () => {
    expect(wordGroups().map(g => g.id)).toEqual(WORD_GROUPS.map(g => g.id))
    WORD_GROUPS.forEach((course, i) => {
      const g = wordGroups()[i]
      expect(g.counter).toBe(course.counter)
      expect(g.members.map(m => wordById(m.word)?.form), g.id).toEqual(course.members.map(m => m.form))
      expect(g.members.map(m => wordById(m.word)?.jmdict), g.id).toEqual(course.members.map(m => m.jmdict))
      if (course.question) expect(wordById(g.question ?? '')?.form, g.id).toBe(course.question.form)
      else expect(g.question, g.id).toBeNull()
    })
  })

  it('practice every irregular member, one regular member and the question word, or all without marks (KR75)', () => {
    // a member that is also a course word is practiced as that and not again in the group
    const isCourseWord = (id: string) => wordById(id)!.group === null
    for (const g of wordGroups()) {
      const own = g.members.filter(m => !isCourseWord(m.word))
      for (const m of g.members.filter(m => isCourseWord(m.word))) expect(m.practiced, m.word).toBe(false)
      const practiced = own.filter(m => m.practiced)
      if (g.practice === 'all') {
        expect(practiced.length, g.id).toBe(own.length)
        expect(g.members.filter(m => m.irregular).map(m => m.word), `${g.id} is practiced in full, no marks`).toEqual([])
        continue
      }
      for (const m of own.filter(m => m.irregular)) expect(m.practiced, m.word).toBe(true)
      const regular = own.filter(m => !m.irregular)
      expect(practiced.filter(m => !m.irregular).map(m => m.word), g.id).toEqual(regular.slice(0, 1).map(m => m.word))
      // the question word is always practiced, it sits next to the members
      if (g.question) expect(wordById(g.question), g.id).not.toBeNull()
    }
  })

  it('make members a word of the group, home on the counter, unless they are course words', () => {
    for (const g of wordGroups()) {
      for (const id of [...g.members.map(m => m.word), ...(g.question ? [g.question] : [])]) {
        const w = wordById(id)!
        if (w.group === null) continue
        expect(w.group).toBe(g.id)
        expect(w.home).toBe(g.counter)
        expect(w.gloss).toBe(w.glosses[0])
      }
    }
  })
})

describe('group lookup', () => {
  it('finds a group by its counter kanji', () => {
    for (const g of wordGroups()) expect(groupOf(g.counter)).toBe(g)
    expect(groupOf('あ')).toBeNull()
  })
})

describe('strokes and sources', () => {
  it('give every kanji of the set as a single glyph, as many strokes as KANJIDIC2 counts', () => {
    for (const [k, src] of Object.entries(KANJI_SOURCE)) {
      const s = kanjiStrokes(k)!
      expect(s.width).toBe(109)
      expect(s.strokes.length, k).toBe(src.strokes)
      for (const st of s.strokes) expect(st.dx).toBe(0)
    }
    expect(kanjiStrokes('あ')).toBeNull()
  })

  it('name every source with version, link and licence (KR63)', () => {
    expect(KANJI_DATA_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(KANJI_SOURCES.map(s => s.name)).toEqual(expect.arrayContaining(['KANJIDIC2', 'JMdict', 'JmdictFurigana', 'KanjiVG']))
    for (const s of KANJI_SOURCES) {
      expect(s.version).not.toBe('')
      expect(s.url).toMatch(/^https:\/\//)
      expect(s.licenceUrl).toMatch(/^https:\/\//)
      expect(s.licence).toMatch(/CC BY/)
    }
  })
})
