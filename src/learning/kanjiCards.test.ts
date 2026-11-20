import { describe, it, expect } from 'vitest'
import { seeded } from './seeded'
import {
  itemInfo, itemOrder, makeCard, optionText, spellDiff, storedAnswer, typedReadings, wordReadingMistake, wordTypedVerdict, PLAN_COURSE,
} from './kanjiCards'
import { toKana } from './kanaInput'
import { looksLikeReading } from './readings'
import { acceptedRomaji } from './romaji'
import { allPairs } from '../data/kana'
import type { CardContext } from './kanjiCards'
import { planKanji } from './kanjiPlan'
import { orderKanjiSession } from './kanjiSession'
import { applyKanjiAnswer, newKanjiEntry } from './kanjiStats'
import {
  allKanji, courseWords, groupPractice, homeWords, kanjiEntry, kanjiReadings, kanjiLookalikes, ownWords, practicedWords, sameForm,
  tooClose, wordById, wordGroups,
} from '../data/kanjiData'
import { groupCardId, kanjiOfId } from '../kanjiKeys'
import type { KanjiCard, KanjiStatsMap, WordQuestionType } from '../types'

// Everything here runs over the course data, no reading or meaning is typed in.
const NOW = 1_800_000_000_000
const KANJI = allKanji()
// course words and practiced group words, every card test runs over both
const WORDS = practicedWords()
const COURSE_WORDS = courseWords()
// homographs in the data with kana a romaji keyboard can't give (ー, ぃ, ぢゅ), the test counts them so a data update that changes this shows up
const KANA_ONLY_HOMOGRAPHS = 14

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
    expect(PLAN_COURSE.words.filter(w => !w.group).map(w => w.id)).toEqual(COURSE_WORDS.map(w => w.id))
    for (const k of KANJI) {
      const own = PLAN_COURSE.words.filter(w => w.home === k.id && !w.group)
      expect(own.map(w => w.id)).toEqual(ownWords(k.kanji).map(w => w.id))
      expect(own.map(w => w.first)).toEqual(own.map((_, i) => i === 0))
    }
  })

  it('has every group with its practiced words on the counter, those words among its words too', () => {
    expect(PLAN_COURSE.groups.map(g => g.id)).toEqual(wordGroups().map(g => g.id))
    for (const g of wordGroups()) {
      const plan = PLAN_COURSE.groups.find(x => x.id === g.id)!
      expect(plan.home).toBe(`k:${g.counter}`)
      expect(plan.words.map(w => w.id)).toEqual(groupPractice(g).map(w => w.id))
      for (const w of plan.words) {
        expect(w).toMatchObject({ home: plan.home, first: false, group: g.id })
        expect(PLAN_COURSE.words).toContain(w)
      }
    }
    expect(PLAN_COURSE.words.map(w => w.id)).toEqual(practicedWords().map(w => w.id))
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

  it('put a kanji at its course position and its words right after it, in teaching order, then its group words', () => {
    const ids = KANJI.flatMap(k => [k.id, ...homeWords(k.kanji).map(w => w.id)])
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
    expect(makeCard({ id: w.id }, { ...nothing, stats }).type).toBe('read-type')
    expect(makeCard({ id: w.id }, { ...nothing, stats: {} }).type).toMatch(/^(read-choice|word-meaning)$/)
    expect(makeCard({ id: w.id, type: 'intro', needs: 'k:x' }, nothing)).toEqual({
      id: w.id, home: w.home, type: 'intro', options: [], answer: w.form, needs: 'k:x',
    })
  })

  it('asks a typed reading without options, the reading shown first is the answer', () => {
    for (const w of WORDS) expect(makeCard({ id: w.id, type: 'read-type' }, everything)).toEqual({ id: w.id, home: w.home, type: 'read-type', options: [], answer: w.reading })
  })

  it('keeps the type of a re-ask, typed included', () => {
    const w = WORDS[0]
    const stats: KanjiStatsMap = { [w.id]: { ...newKanjiEntry(w.id), correct: 1, box: 0 } }
    expect(makeCard({ id: w.id, type: 'read-type' }, { ...nothing, stats }).type).toBe('read-type')
  })
})

// Hepburn romaji for hiragana, built from the kana table: what a learner types for a
// reading. Null for kana the table lacks (ー, ぃ, ぢゅ), a Japanese keyboard sends those as kana.
// `n` says how ん is typed: 'auto' as n' before a vowel or y and n elsewhere, or always as
// n, nn or n' (most people leave the apostrophe out, some double every n)
type NStyle = 'auto' | 'n' | 'nn' | "n'"
const HIRAGANA = allPairs().filter(p => p.script === 'hiragana')
function romajiOf(kana: string, n: NStyle = 'auto'): string | null {
  let out = ''
  for (let i = 0; i < kana.length;) {
    if (kana[i] === 'っ') {
      const rest = romajiOf(kana.slice(i + 1), n)
      return rest && out + rest[0] + rest
    }
    if (kana[i] === 'ん') {
      const next = romajiOf(kana.slice(i + 1, i + 2)) ?? ''
      out += n === 'auto' ? (/^[aeiouy]/.test(next) ? "n'" : 'n') : n
      i++
      continue
    }
    const p = HIRAGANA.find(x => x.kana === kana.slice(i, i + 2)) ?? HIRAGANA.find(x => x.kana === kana[i])
    if (!p) return null
    out += acceptedRomaji(p.kana, p.romaji).find(r => toKana(r) === p.kana)
    i += p.kana.length
  }
  return out
}

describe('typedReadings', () => {
  it('takes only the reading of the table for a group word, the rest of its entry asks again', () => {
    const withOthers = WORDS.filter(w => w.group && w.readings.length > 1)
    expect(withOthers.length).toBeGreaterThan(0)
    for (const w of WORDS.filter(w => w.group)) {
      const { right, again } = typedReadings(w)
      expect(right, w.id).toEqual([w.reading])
      for (const r of w.readings.filter(r => r !== w.reading)) expect(again, w.id).toContain(r)
    }
  })

  it('asks again for the reading of a twin written the same way, also on a course word (KR78)', () => {
    const twinned = WORDS.filter(w => sameForm(w).length)
    expect(twinned.some(w => !w.group)).toBe(true)
    for (const w of twinned) {
      const { right, again } = typedReadings(w)
      expect(right, w.id).toContain(w.reading)
      for (const t of sameForm(w)) {
        if (t.reading === w.reading) continue
        expect(right, w.id).not.toContain(t.reading)
        expect(again, w.id).toContain(t.reading)
      }
    }
  })

  it('keeps every reading of a course word without a twin', () => {
    for (const w of WORDS.filter(w => !w.group && !sameForm(w).length)) expect(typedReadings(w).right).toEqual(w.readings)
  })
})

describe('wordTypedVerdict over the practiced words', () => {
  it('takes every reading it accepts in kana and in romaji, ん typed as n, nn or n\'', () => {
    let nBeforeVowel = 0
    for (const w of WORDS) {
      for (const r of typedReadings(w).right) {
        expect(wordTypedVerdict(w.id, r, false)).toEqual({ result: 'right', kana: r })
        expect(looksLikeReading(r), r).toBe(true)
        for (const n of ['auto', 'n', 'nn', "n'"] as const) {
          const typed = romajiOf(r, n)!
          expect(wordTypedVerdict(w.id, typed, false), `${w.id} ${typed}`).toEqual({ result: 'right', kana: r })
        }
        if (romajiOf(r) !== romajiOf(r, 'n')) nBeforeVowel++
      }
    }
    // the data has ん before a vowel or y, so the plain n and the nn there are really checked
    expect(nBeforeVowel).toBeGreaterThan(0)
  })

  it('asks again for a reading it does not take, without counting', () => {
    let typedInRomaji = 0
    let kanaOnly = 0
    for (const w of WORDS) {
      for (const h of typedReadings(w).again) {
        expect(wordTypedVerdict(w.id, h, false), `${w.id} ${h}`).toEqual({ result: 'homograph', kana: h })
        const typed = romajiOf(h)
        if (!typed) {
          kanaOnly++
          continue
        }
        expect(wordTypedVerdict(w.id, typed, false), `${w.id} ${typed}`).toEqual({ result: 'homograph', kana: h })
        typedInRomaji++
      }
    }
    expect(typedInRomaji).toBeGreaterThan(0)
    expect(kanaOnly).toBe(KANA_ONLY_HOMOGRAPHS)
  })

  it('lets one slip through, then counts it as a typo with nothing stored', () => {
    for (const w of WORDS) {
      const typed = romajiOf(w.reading)!
      const oneOff = typed[0] + 'q' + typed.slice(1)
      expect(wordTypedVerdict(w.id, oneOff, false), `${w.id} ${oneOff}`).toEqual({ result: 'slip' })
      expect(wordTypedVerdict(w.id, oneOff, true)).toMatchObject({ result: 'wrong', given: '', typo: true })
    }
  })

  it('stores the reading of another practiced word as given', () => {
    for (const w of WORDS) {
      const { right, again } = typedReadings(w)
      const other = WORDS.find(o => !right.includes(o.reading) && !again.includes(o.reading))!
      const v = wordTypedVerdict(w.id, romajiOf(other.reading)!, false)
      expect(v, w.id).toMatchObject({ result: 'wrong', given: other.reading, typo: false })
    }
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

describe('word groups in cards and sessions', () => {
  it('makes the group card an intro on the counter, with nothing to answer', () => {
    for (const g of wordGroups()) {
      const id = groupCardId(g.id)
      expect(makeCard({ id, type: 'intro' }, nothing)).toEqual({ id, home: g.counter, type: 'intro', options: [], answer: '' })
      expect(itemInfo(id)).toBeNull()
    }
  })

  it('keeps the place behind the group card on the intro of a group word', () => {
    const g = wordGroups()[0]
    const w = groupPractice(g)[0]
    expect(makeCard({ id: w.id, type: 'intro', after: groupCardId(g.id) }, nothing).after).toBe(groupCardId(g.id))
  })

  // a learner who does one smart session of 20 a day and answers every card right: the last
  // kanji and its words come around day 145, the run goes on a while longer to be sure
  const SIMULATED_DAYS = 200
  function everyDay(days: number) {
    const stats: KanjiStatsMap = {}
    const opened: Array<{ group: string; day: number }> = []
    for (let day = 1; day <= days; day++) {
      let now = NOW + (day - 1) * 24 * 60 * 60 * 1000
      const plan = planKanji(stats, [], PLAN_COURSE, 20, now, 3)
      if (plan.group) opened.push({ group: plan.group.id, day })
      const cards = orderKanjiSession(plan, seeded(day))
      for (const [i, c] of cards.entries()) {
        if (c.type === 'intro') {
          if (c.id === groupCardId(plan.group?.id ?? '')) {
            // the table comes before every card of its words
            for (const id of plan.group!.words) expect(cards.findIndex(x => x.id === id)).toBeGreaterThan(i)
          }
          continue
        }
        const type = c.type ?? (kanjiOfId(c.id) ? 'meaning' : 'read-choice')
        stats[c.id] = applyKanjiAnswer(stats[c.id], { id: c.id, type, correct: true, given: '', ms: 1000 }, now)
        now += 10_000
      }
    }
    return { stats, opened }
  }

  it('opens every group once, after its counter was reviewed on a later day, and brings all its words', () => {
    // long enough for the last kanji and all its words at this pace, with room to spare
    const { stats, opened } = everyDay(SIMULATED_DAYS)
    expect(opened.map(o => o.group).sort()).toEqual(wordGroups().map(g => g.id).sort())
    for (const g of wordGroups()) {
      for (const w of groupPractice(g)) expect(stats[w.id]?.correct, w.id).toBeGreaterThan(0)
    }
  })
})
