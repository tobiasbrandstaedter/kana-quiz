import { describe, it, expect } from 'vitest'
import { seeded } from './seeded'
import { itemInfo, itemOrder, makeCard, optionText, spellDiff, storedAnswer, wordReadingMistake, PLAN_COURSE } from './kanjiCards'
import type { CardContext } from './kanjiCards'
import { orderKanjiSession, planKanji } from './kanjiPlan'
import { newKanjiEntry } from './kanjiStats'
import { allKanji, courseWords, kanjiEntry, kanjiReadings, kanjiLookalikes, ownWords, tooClose, wordById } from '../data/kanjiData'
import { kanjiOfId } from '../kanjiKeys'
import type { KanjiCard, KanjiStatsMap, WordQuestionType } from '../types'

// Everything here runs over the course data, no reading or meaning is typed in.
const NOW = 1_800_000_000_000
const KANJI = allKanji()
const WORDS = courseWords()

// a learner who has met every kanji and word
const everything: CardContext = {
  stats: {}, mode: 'mixed',
  knownKanji: new Set(KANJI.map(k => k.kanji)), knownWords: new Set(WORDS.map(w => w.id)),
}
// one who has met nothing yet
const nothing: CardContext = { stats: {}, mode: 'mixed', knownKanji: new Set(), knownWords: new Set() }

describe('PLAN_COURSE', () => {
  it('has every kanji and course word, each word on its home kanji, the first word marked', () => {
    expect(PLAN_COURSE.kanji).toEqual(KANJI.map(k => k.id))
    expect(PLAN_COURSE.words.map(w => w.id)).toEqual(WORDS.map(w => w.id))
    for (const k of KANJI) {
      const own = PLAN_COURSE.words.filter(w => w.home === k.id)
      expect(own.map(w => w.id)).toEqual(ownWords(k.kanji).map(w => w.id))
      expect(own.map(w => w.first)).toEqual(own.map((_, i) => i === 0))
    }
  })
})

describe('itemInfo and itemOrder', () => {
  it('describe kanji and words, null for an id the course lacks', () => {
    const k = KANJI[0]
    expect(itemInfo(k.id)).toEqual({ id: k.id, kind: 'kanji', text: k.kanji, meaning: k.keyword, reading: '', home: k.kanji })
    const w = WORDS[WORDS.length - 1]
    expect(itemInfo(w.id)).toEqual({ id: w.id, kind: 'word', text: w.form, meaning: w.gloss, reading: w.reading, home: w.home })
    expect(itemInfo('w:nothing:here')).toBeNull()
    expect(itemInfo('k:あ')).toBeNull()
  })

  it('put a kanji at its course position and its words right after it, in teaching order', () => {
    const ids = KANJI.flatMap(k => [k.id, ...k.words])
    const orders = ids.map(itemOrder)
    expect([...orders].sort((a, b) => a - b)).toEqual(orders)
    expect(new Set(orders).size).toBe(orders.length)
  })
})

describe('makeCard for kanji', () => {
  it('asks a kanji with three other course kanji, never one too close in meaning', () => {
    for (const ctx of [everything, nothing]) {
      for (const k of KANJI) {
        for (const type of ['meaning', 'recognize'] as const) {
          const card = makeCard({ id: k.id, type }, ctx, seeded())
          expect(card).toMatchObject({ id: k.id, home: k.kanji, type, answer: k.kanji })
          expect(new Set(card.options).size).toBe(4)
          for (const o of card.options) expect(kanjiEntry(o), o).not.toBeNull()
        }
      }
    }
  })

  it('gives an intro card, and a type by the box when the plan names none', () => {
    const k = KANJI[0]
    expect(makeCard({ id: k.id, type: 'intro' }, nothing)).toEqual({ id: k.id, home: k.kanji, type: 'intro', options: [], answer: k.kanji })
    expect(makeCard({ id: k.id }, nothing).type).toBe('meaning')
    const stats: KanjiStatsMap = { [k.id]: { ...newKanjiEntry(k.id), correct: 1, box: 2 } }
    expect(makeCard({ id: k.id }, { ...nothing, stats }).type).toBe('recognize')
  })

  it('puts the lookalikes of a kanji among its options', () => {
    const k = KANJI.find(x => kanjiLookalikes(x.kanji).length)!
    const card = makeCard({ id: k.id, type: 'recognize' }, everything, seeded())
    expect(card.options.some(o => kanjiLookalikes(k.kanji).includes(o))).toBe(true)
  })
})

describe('makeCard for words', () => {
  const TYPES: WordQuestionType[] = ['word-meaning', 'read-choice', 'spell']

  it('has the answer among four different options for every word and type', () => {
    for (const ctx of [everything, nothing]) {
      for (const w of WORDS) {
        for (const type of TYPES) {
          const card = makeCard({ id: w.id, type }, ctx, seeded())
          expect(card.home, w.id).toBe(w.home)
          expect(card.options, `${w.id} ${type}`).toContain(card.answer)
          expect(new Set(card.options).size, `${w.id} ${type}`).toBe(4)
        }
      }
    }
  })

  it('never offers an accepted reading or a reading of another word with the same form (KR17)', () => {
    for (const w of WORDS) {
      for (let seed = 1; seed < 4; seed++) {
        const card = makeCard({ id: w.id, type: 'read-choice' }, everything, seeded(seed))
        expect(card.answer).toBe(w.reading)
        for (const o of card.options.filter(o => o !== card.answer)) {
          expect(w.readings, w.id).not.toContain(o)
          expect(w.homographs, w.id).not.toContain(o)
        }
      }
    }
  })

  it('never offers a meaning too close to the right one or among its source glosses (KR72)', () => {
    for (const w of WORDS) {
      const card = makeCard({ id: w.id, type: 'word-meaning' }, everything, seeded())
      expect(card.answer).toBe(w.id)
      const sources = w.glosses.flatMap(g => g.split(';').map(x => x.trim()))
      const glosses = card.options.map(id => wordById(id)!.gloss)
      expect(new Set(glosses).size).toBe(4)
      for (const g of glosses.filter(g => g !== w.gloss)) {
        expect(tooClose(g, w.gloss), `${w.id} ${g}`).toBe(false)
        expect(sources, `${w.id} ${g}`).not.toContain(g)
      }
    }
  })

  it('makes wrong forms that differ in one kanji and are no other word with that reading (KR18)', () => {
    for (const w of WORDS) {
      const card = makeCard({ id: w.id, type: 'spell' }, everything, seeded())
      expect(card.answer).toBe(w.form)
      for (const form of card.options.filter(o => o !== w.form)) {
        expect(spellDiff(w.form, form), `${w.id} ${form}`).not.toBeNull()
        expect(WORDS.some(o => o.form === form && o.readings.includes(w.reading)), `${w.id} ${form}`).toBe(false)
      }
    }
  })

  it('asks a word by its box in mixed mode and keeps the plan\'s intro and needs', () => {
    const w = WORDS[0]
    const stats: KanjiStatsMap = { [w.id]: { ...newKanjiEntry(w.id), correct: 1, box: 2 } }
    expect(makeCard({ id: w.id }, { ...nothing, stats }).type).toBe('read-choice')
    expect(makeCard({ id: w.id, type: 'intro', needs: 'k:x' }, nothing)).toEqual({
      id: w.id, home: w.home, type: 'intro', options: [], answer: w.form, needs: 'k:x',
    })
  })
})

describe('what an option means per question type', () => {
  const k = KANJI[0]
  const w = WORDS[0]
  const card = (type: KanjiCard['type'], id = w.id): KanjiCard => ({ id, home: k.kanji, type, options: [], answer: '' })

  it('shows keywords for kanji, glosses for word ids, and the rest as it is', () => {
    expect(optionText(card('meaning', k.id), k.kanji)).toBe(k.keyword)
    expect(optionText(card('recognize', k.id), k.kanji)).toBe(k.kanji)
    expect(optionText(card('word-meaning'), w.id)).toBe(w.gloss)
    expect(optionText(card('read-choice'), w.reading)).toBe(w.reading)
    expect(optionText(card('spell'), w.form)).toBe(w.form)
  })

  it('stores a kanji as its item id, everything else as picked, nothing for "Don\'t know"', () => {
    expect(storedAnswer(card('meaning', k.id), k.kanji)).toBe(k.id)
    expect(storedAnswer(card('recognize', k.id), k.kanji)).toBe(k.id)
    expect(storedAnswer(card('word-meaning'), w.id)).toBe(w.id)
    expect(storedAnswer(card('read-choice'), w.reading)).toBe(w.reading)
    expect(storedAnswer(card('spell'), w.form)).toBe(w.form)
    expect(storedAnswer(card('spell'), null)).toBe('')
  })

  it('finds the one kanji a wrong form swapped', () => {
    const [a, b, c] = KANJI.map(x => x.kanji)
    expect(spellDiff(a + b, a + c)).toEqual({ right: b, given: c })
    expect(spellDiff(a + b, c + a)).toBeNull()
    expect(spellDiff(a, a + b)).toBeNull()
    // a kana that differs is no swapped kanji
    expect(spellDiff(a + 'い', a + 'う')).toBeNull()
  })
})

describe('wordReadingMistake', () => {
  it('names another reading of a kanji with the word it comes from', () => {
    let found = 0
    for (const w of WORDS) {
      for (const part of w.split) {
        for (const r of kanjiReadings(part.text)) {
          if (r.reading === part.reading) continue
          const given = w.split.map(p => p === part ? r.reading : p.reading).join('')
          const m = wordReadingMistake(w.id, given)
          if (m?.kind !== 'other-reading') continue
          expect(m).toEqual({ kind: 'other-reading', kanji: part.text, reading: r.reading, right: part.reading, word: r.word })
          found++
        }
      }
    }
    expect(found).toBeGreaterThan(0)
    expect(wordReadingMistake('w:nothing:here', 'x')).toBeNull()
  })

  it('has no name for a reading another word gives the same form', () => {
    const withHomographs = WORDS.filter(w => w.homographs.length)
    expect(withHomographs.length).toBeGreaterThan(0)
    for (const w of withHomographs) for (const h of w.homographs) expect(wordReadingMistake(w.id, h), `${w.id} ${h}`).toBeNull()
  })
})

describe('the first session of a new learner (KR14)', () => {
  for (const size of [10, 20]) {
    it(`fills a session of ${size} with whole kanji and first word packages, nothing untaught`, () => {
      const plan = planKanji({}, [], PLAN_COURSE, size, NOW, 3)
      const cards = orderKanjiSession(plan, seeded())
      expect(cards).toHaveLength(Math.min(3, Math.floor(size / 6)) * 6)
      const introduced = new Set<string>()
      for (const [i, c] of cards.entries()) {
        if (c.type === 'intro') {
          // a word intro comes after a question of its kanji
          if (c.needs) expect(cards.slice(0, i).some(x => x.id === c.needs && x.type !== 'intro')).toBe(true)
          introduced.add(c.id)
          continue
        }
        expect(introduced.has(c.id), c.id).toBe(true)
        const w = wordById(c.id)
        if (w) for (const k of w.kanji) expect(introduced.has(`k:${k}`), `${c.id} needs ${k}`).toBe(true)
      }
      for (const id of plan.fresh) expect(plan.firstWords[id]).toBe(KANJI.find(k => k.id === id)!.words[0])
      expect(cards.filter(c => kanjiOfId(c.id)).length).toBe(plan.fresh.length * 3)
    })
  }
})
