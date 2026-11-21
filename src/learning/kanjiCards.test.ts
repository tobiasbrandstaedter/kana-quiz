import { describe, it, expect } from 'vitest'
import { seeded } from './seeded'
import {
  introLookalikes, itemInfo, itemOrder, makeCard, metSoFar, missExplanation, optionText, spellDiff, storedAnswer, twinTable, typedReadings, unlikePrevious,
  wordReadingMistake, wordTypedVerdict, writeCue, PATTERN_COURSE, PLAN_COURSE,
} from './kanjiCards'
import { toKana } from './kanaInput'
import { looksLikeReading } from './readings'
import { acceptedRomaji } from './romaji'
import { allPairs } from '../data/kana'
import type { CardContext } from './kanjiCards'
import { MAX_KANJI_LEARNING, planKanji } from './kanjiPlan'
import { orderKanjiSession, readyCard, reaskCards } from './kanjiSession'
import { holdsBox, noteResult } from './kanjiQuiz'
import type { RoundResults } from './kanjiQuiz'
import { applyKanjiAnswer, newKanjiEntry } from './kanjiStats'
import {
  allKanji, courseWords, groupById, groupPractice, homeWords, kanjiEntry, kanjiLookalikeHint, kanjiReadings, kanjiLookalikes, ownWords, practicedWords, sameForm,
  tooClose, wordById, wordGroups,
} from '../data/kanjiData'
import { cardGroup, groupCardId, kanjiOfId } from '../kanjiKeys'
import type { KanjiAnswerRecord, KanjiCard, KanjiEntry, KanjiStatsMap, WordQuestionType } from '../types'
import { DAY, NOW } from './kanjiFixtures'

// Everything here runs over the course data, no reading or meaning is typed in.
const KANJI = allKanji()
// course words and practiced group words, every card test runs over both
const WORDS = practicedWords()
const COURSE_WORDS = courseWords()

// a learner who has met every kanji and word
const everything: CardContext = {
  stats: {}, mode: 'mixed',
  knownKanji: new Set(KANJI.map(k => k.kanji)), knownWords: new Set(WORDS.map(w => w.id)),
}
// one who has met nothing yet
const nothing: CardContext = { stats: {}, mode: 'mixed', knownKanji: new Set(), knownWords: new Set() }

describe('PATTERN_COURSE', () => {
  it('names items, puts a word into the set of its home kanji, finds the lookalikes and their hint', () => {
    const k = KANJI.find(x => kanjiLookalikes(x.kanji).length)!
    const other = kanjiLookalikes(k.kanji)[0]
    expect(PATTERN_COURSE.text(k.id)).toBe(k.kanji)
    expect(PATTERN_COURSE.text('w:none')).toBeNull()
    expect(PATTERN_COURSE.lookalikes(k.id)).toContain(`k:${other}`)
    expect(PATTERN_COURSE.hint(k.id, `k:${other}`)).toBeTruthy()
    for (const w of WORDS) expect(PATTERN_COURSE.setOf(w.id)?.id).toBe(kanjiEntry(w.home)!.set)
    expect(PATTERN_COURSE.setOf(k.id)?.id).toBe(k.set)
  })

  it('lists the practiced words that have a kanji and tells which kanji a wrong form swapped', () => {
    for (const k of KANJI) expect(PATTERN_COURSE.wordsWith(k.id)).toEqual(WORDS.filter(w => w.kanji.includes(k.kanji)).map(w => w.id))
    const w = WORDS.find(x => x.kanji.length === 2)!
    const swapped = KANJI.find(x => !w.kanji.includes(x.kanji))!.kanji
    const form = w.form.replace(w.kanji[0], swapped)
    expect(PATTERN_COURSE.swap(w.id, form)).toEqual([`k:${w.kanji[0]}`, `k:${swapped}`])
    expect(PATTERN_COURSE.swap(w.id, w.form)).toBeNull()
  })
})

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
  it('asks a kanji with three other course kanji', () => {
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

  it('never offers a kanji whose keyword could be right too (KR15)', () => {
    // two kanji clash when a keyword is a source meaning of the other or the pair is kept as too close
    const clash = (a: KanjiEntry, b: KanjiEntry) => a.meanings.includes(b.keyword) || b.meanings.includes(a.keyword) || tooClose(a.keyword, b.keyword)
    // the rule has work to do: some kanji have a clashing one in their own set, where options come from first
    expect(KANJI.filter(k => KANJI.some(o => o !== k && o.set === k.set && clash(k, o))).length).toBeGreaterThan(0)
    for (const ctx of [everything, nothing]) {
      for (const k of KANJI) {
        for (let seed = 1; seed <= 5; seed++) {
          const card = makeCard({ id: k.id, type: 'meaning' }, ctx, seeded(seed))
          for (const o of card.options.filter(o => o !== k.kanji)) expect(clash(k, kanjiEntry(o)!), `${k.kanji} ${o}`).toBe(false)
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

  it('puts a kanji the learner picked for this one among its options, lookalike or not (KR16)', () => {
    const k = KANJI.find(x => !kanjiLookalikes(x.kanji).length)!
    // far off in the course, so nothing but the stored confusion brings it in
    const far = [...KANJI].reverse().find(o => o.set !== k.set && !k.meanings.includes(o.keyword) && !o.meanings.includes(k.keyword) && !tooClose(k.keyword, o.keyword))!
    const stats: KanjiStatsMap = { [k.id]: { ...newKanjiEntry(k.id), correct: 1, incorrect: 2, confusions: { [far.id]: 2 } } }
    for (let seed = 1; seed <= 5; seed++) {
      for (const type of ['meaning', 'recognize'] as const) {
        expect(makeCard({ id: k.id, type }, { ...everything, stats }, seeded(seed)).options).toContain(far.kanji)
      }
      expect(makeCard({ id: k.id, type: 'meaning' }, { ...everything, stats: {} }, seeded(seed)).options).not.toContain(far.kanji)
    }
    // a word with that kanji gets the confused one swapped in as a wrong form
    const w = WORDS.find(x => x.kanji.length === 1 && x.kanji[0] === k.kanji)!
    expect(makeCard({ id: w.id, type: 'spell' }, { ...everything, stats }, seeded()).options).toContain(w.form.replace(k.kanji, far.kanji))
  })

  it('gives a write card only when the plan names it, never from the mode alone (KR26)', () => {
    const k = KANJI[0]
    expect(makeCard({ id: k.id, type: 'write' }, nothing)).toEqual({ id: k.id, home: k.kanji, type: 'write', options: [], answer: k.kanji })
    // smart practice and pattern cards leave the type open, the mode Write then asks as Mixed does
    const write = { ...nothing, mode: 'write' as const }
    for (const box of [0, 1, 2, 3, 5]) {
      const stats: KanjiStatsMap = { [k.id]: { ...newKanjiEntry(k.id), correct: 1, box } }
      expect(makeCard({ id: k.id }, { ...write, stats }, seeded()).type).not.toBe('write')
    }
    const w = WORDS[0]
    expect(makeCard({ id: w.id }, write, seeded()).type).not.toBe('write')
  })
})

describe('writeCue', () => {
  it('gives the reading of the first word once that word is met, else nothing', () => {
    for (const k of KANJI) {
      const first = wordById(k.words[0])!
      expect(writeCue(k.kanji, {})).toBeNull()
      const stats = { [first.id]: applyKanjiAnswer(undefined, { id: first.id, type: 'read-choice', correct: true, given: first.reading, ms: 1 }, NOW) }
      expect(writeCue(k.kanji, stats)).toBe(first.reading)
    }
  })

  it('does not count a met word other than the first', () => {
    const k = KANJI.find(x => x.words.length > 1)!
    const other = k.words[1]
    const stats = { [other]: applyKanjiAnswer(undefined, { id: other, type: 'word-meaning', correct: true, given: other, ms: 1 }, NOW) }
    expect(writeCue(k.kanji, stats)).toBeNull()
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
    // a gloss in its parts, compared as wordQuiz does: case and punctuation aside
    const parts = (g: string) => g.split(';').map(x => x.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim())
    // the hand kept list has glosses of practiced words in it, so the rule has work to do
    expect(WORDS.filter(w => WORDS.some(o => tooClose(o.gloss, w.gloss))).length).toBeGreaterThan(0)
    for (const ctx of [everything, nothing]) {
      for (const w of WORDS) {
        for (let seed = 1; seed <= 4; seed++) {
          const card = makeCard({ id: w.id, type: 'word-meaning' }, ctx, seeded(seed))
          expect(card.answer).toBe(w.id)
          const sources = [...parts(w.gloss), ...w.glosses.flatMap(parts)]
          const glosses = card.options.map(id => wordById(id)!.gloss)
          expect(new Set(glosses).size).toBe(4)
          for (const id of card.options.filter(id => id !== w.id)) {
            const o = wordById(id)!
            expect(tooClose(o.gloss, w.gloss), `${w.id} ${o.gloss}`).toBe(false)
            for (const p of parts(o.gloss)) expect(sources, `${w.id} ${o.gloss}`).not.toContain(p)
            for (const p of parts(w.gloss)) expect(o.glosses.flatMap(parts), `${w.id} ${o.gloss}`).not.toContain(p)
          }
        }
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
    // kana the romaji table has no spelling for: ー, a small vowel, a small ゃゅょ after a kana it doesn't combine with
    const noRomaji = (h: string) => /[ーぁぃぅぇぉゎ]/.test(h) ||
      [...h.matchAll(/(.)([ゃゅょ])/g)].some(m => !HIRAGANA.some(p => p.kana === m[1] + m[2]))
    let typedInRomaji = 0
    for (const w of WORDS) {
      for (const h of typedReadings(w).again) {
        expect(wordTypedVerdict(w.id, h, false), `${w.id} ${h}`).toEqual({ result: 'homograph', kana: h })
        const typed = romajiOf(h)
        // skipped only where a Japanese keyboard is the one way to type it
        expect(typed === null, `${w.id} ${h}`).toBe(noRomaji(h))
        if (!typed) continue
        expect(wordTypedVerdict(w.id, typed, false), `${w.id} ${typed}`).toEqual({ result: 'homograph', kana: h })
        typedInRomaji++
      }
    }
    expect(typedInRomaji).toBeGreaterThan(0)
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

describe('what a card shows around the answer', () => {
  it('turns the options round by one when they come in the same order as on the card before', () => {
    const a = makeCard({ id: KANJI[0].id, type: 'meaning' }, everything, seeded())
    const b = { ...a, id: KANJI[1].id }
    const shown = unlikePrevious(b, a)
    expect(shown.options).toEqual([...a.options.slice(1), a.options[0]])
    expect(new Set(shown.options)).toEqual(new Set(a.options))
    // another order, no card before, or no options: as it is
    const other = { ...b, options: [...b.options].reverse() }
    expect(unlikePrevious(other, a)).toBe(other)
    expect(unlikePrevious(b, undefined)).toBe(b)
    const intro = makeCard({ id: KANJI[0].id, type: 'intro' }, nothing)
    expect(unlikePrevious(intro, { ...intro })).toBe(intro)
  })

  it('pairs a wrong kanji with the right one, keywords and the lookalike hint (KR35)', () => {
    const k = KANJI.find(x => kanjiLookalikes(x.kanji).length)!
    const other = kanjiEntry(kanjiLookalikes(k.kanji)[0])!
    for (const type of ['meaning', 'recognize'] as const) {
      const card: KanjiCard = { id: k.id, home: k.kanji, type, options: [k.kanji, other.kanji], answer: k.kanji }
      expect(missExplanation(card, other.kanji)).toEqual({
        yours: { text: other.kanji, meaning: other.keyword },
        right: { text: k.kanji, meaning: k.keyword },
        hint: kanjiLookalikeHint(k.kanji, other.kanji),
      })
      // "Don't know": only the right one
      expect(missExplanation(card, null)).toEqual({ yours: null, right: { text: k.kanji, meaning: k.keyword }, hint: null })
      expect(missExplanation(card, k.kanji)).toBeNull()
    }
    // two kanji in no lookalike group: no hint
    const plain = KANJI.find(x => x !== k && !kanjiLookalikes(x.kanji).includes(k.kanji))!
    const card: KanjiCard = { id: k.id, home: k.kanji, type: 'meaning', options: [], answer: k.kanji }
    expect(missExplanation(card, plain.kanji)?.hint).toBeNull()
  })

  it('names the swapped kanji of a wrong form, nothing for other word cards (KR35)', () => {
    const w = WORDS.find(x => x.kanji.length === 2)!
    const swapped = KANJI.find(x => !w.kanji.includes(x.kanji))!
    const wrong = w.form.replace(w.kanji[0], swapped.kanji)
    const card: KanjiCard = { id: w.id, home: w.home, type: 'spell', options: [w.form, wrong], answer: w.form }
    expect(missExplanation(card, wrong)).toEqual({
      yours: { text: wrong, meaning: swapped.keyword },
      right: { text: w.form, meaning: kanjiEntry(w.kanji[0])!.keyword },
      hint: kanjiLookalikeHint(w.kanji[0], swapped.kanji),
    })
    expect(missExplanation(card, null)).toBeNull()
    expect(missExplanation({ ...card, type: 'read-choice', answer: w.reading }, 'x')).toBeNull()
  })

  it('warns on an intro only about lookalikes the learner has met (KR11)', () => {
    const k = KANJI.find(x => kanjiLookalikes(x.kanji).length > 1) ?? KANJI.find(x => kanjiLookalikes(x.kanji).length)!
    const all = kanjiLookalikes(k.kanji)
    expect(introLookalikes(k.kanji, () => true)).toEqual({ others: all, hint: kanjiLookalikeHint(k.kanji, all[0]) })
    expect(introLookalikes(k.kanji, () => false)).toBeNull()
    const last = all[all.length - 1]
    expect(introLookalikes(k.kanji, x => x === last)).toEqual({ others: [last], hint: kanjiLookalikeHint(k.kanji, last) })
    expect(introLookalikes(KANJI.find(x => !kanjiLookalikes(x.kanji).length)!.kanji, () => true)).toBeNull()
  })

  it('names the table of a twin written alike, by the reading typed (KR78, KR80)', () => {
    let found = 0
    for (const w of WORDS) {
      for (const t of sameForm(w)) {
        if (t.reading === w.reading) continue
        expect(twinTable(w.id, t.reading), `${w.id} ${t.id}`).toBe(t.group ? groupById(t.group)!.title : null)
        if (t.group && !w.group) found++
      }
      expect(twinTable(w.id, w.reading)).toBeNull()
    }
    // the plain number word with a twin in a table is in the data
    expect(found).toBeGreaterThan(0)
  })
})

describe('metSoFar', () => {
  it('takes what was answered and what this session brings, words only when practiced', () => {
    const k = KANJI[0]
    const w = WORDS[0]
    const stats: KanjiStatsMap = {
      [k.id]: { ...newKanjiEntry(k.id), correct: 1 },
      [w.id]: { ...newKanjiEntry(w.id), incorrect: 1 },
      [KANJI[1].id]: newKanjiEntry(KANJI[1].id),
    }
    const met = metSoFar(stats, [KANJI[2].id, WORDS[1].id, groupCardId(wordGroups()[0].id), 'w:nothing:here'])
    expect(met.kanji).toEqual(new Set([k.kanji, KANJI[2].kanji]))
    expect(met.words).toEqual(new Set([w.id, WORDS[1].id]))
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
})

// A learner who does one smart session a day (20 cards and 3 new unless said otherwise), run through the session the way useKanji
// does it: readyCard before each card, a miss comes back through reaskCards, a right answer
// after a miss holds the box. `missRate` of the answers go wrong, drawn from a seeded rng.
// The rules of a session are checked on every card on the way.
function simulate(days: number, missRate: number, size = 20, newLimit = 3) {
  const stats: KanjiStatsMap = {}
  const log: KanjiAnswerRecord[] = []
  const rng = seeded(7)
  const opened: Array<{ group: string; day: number }> = []
  const tables = new Set<string>()
  const lastKanji = PLAN_COURSE.kanji[PLAN_COURSE.kanji.length - 1]
  let lastKanjiDay = 0
  let reasks = 0
  let capped = 0
  for (let day = 1; day <= days; day++) {
    let now = NOW + (day - 1) * DAY
    const plan = planKanji(stats, log, PLAN_COURSE, size, now, newLimit)
    const settling = Object.values(stats).filter(e => e.box <= 1).length
    if (settling >= MAX_KANJI_LEARNING) {
      // nothing new while twelve settle (KR31), and the hero says so
      expect(plan.fresh.length + plan.waitingWords.length + (plan.group ? 1 : 0), `day ${day}`).toBe(0)
      if (plan.fill.length >= 6) capped++  // room for a new kanji went to early reviews instead
    }
    if (plan.group) {
      opened.push({ group: plan.group.id, day })
      // opened only once the counter was reviewed on a later day (KR76)
      expect(stats[PLAN_COURSE.groups.find(g => g.id === plan.group!.id)!.home].box).toBeGreaterThanOrEqual(2)
    }
    if (plan.fresh.includes(lastKanji)) lastKanjiDay = day

    const seenBefore = new Set(Object.keys(stats))
    const introduced = new Set<string>()
    let cards = orderKanjiSession(plan, seeded(day))
    const planned = cards.length
    expect(planned).toBeLessThanOrEqual(size)
    let added = 0
    let results: RoundResults = {}
    const right = new Set<string>()
    const reasked: Record<string, number> = {}
    for (let i = 0; i < cards.length; i++) {
      if (i > 0) cards = readyCard(cards, i, right)
      if (i >= cards.length) break
      const c = cards[i]
      if (c.type === 'intro') {
        // a first word only once its kanji was answered right (KR14), a group word behind its table
        if (c.needs) expect(right.has(c.needs), `${c.id} on day ${day}`).toBe(true)
        if (c.after) expect(tables.has(c.after), `${c.id} on day ${day}`).toBe(true)
        if (cardGroup(c.id)) tables.add(c.id)
        introduced.add(c.id)
        continue
      }
      // no question about an item before its intro, no group word before its table was shown
      if (!seenBefore.has(c.id)) expect(introduced.has(c.id), `${c.id} on day ${day}`).toBe(true)
      const group = wordById(c.id)?.group
      if (group) expect(tables.has(groupCardId(group)), `${c.id} on day ${day}`).toBe(true)

      const type = c.type ?? (kanjiOfId(c.id) ? 'meaning' : 'read-choice')
      const correct = rng() >= missRate
      stats[c.id] = applyKanjiAnswer(stats[c.id], { id: c.id, type, correct, given: '', ms: 1000, holdBox: holdsBox(results, c.id, correct) }, now)
      log.push({ id: c.id, type, correct, given: '', ms: 1000, t: now })
      results = noteResult(results, c.id, correct)
      if (correct) right.add(c.id)
      else {
        const slot = reaskCards(cards, i, c.id, type, reasked[c.id] ?? 0, rng)
        if (slot) {
          reasked[c.id] = (reasked[c.id] ?? 0) + 1
          cards = [...cards.slice(0, slot.index), ...slot.cards, ...cards.slice(slot.index)]
          added += slot.cards.length
          reasks++
        }
      }
      now += 10_000
    }
    // no session over its size, plus what the re-asks brought
    expect(cards.length, `day ${day}`).toBeLessThanOrEqual(planned + added)
  }
  return { stats, opened, lastKanjiDay, reasks, capped }
}

describe('a learner over months', () => {
  const allIds = [...PLAN_COURSE.kanji, ...PLAN_COURSE.words.map(w => w.id)]
  const groupIds = wordGroups().map(g => g.id).sort()

  it('who answers everything right meets every kanji and word, every group once', () => {
    const { stats, opened, lastKanjiDay } = simulate(200, 0)
    // the last kanji comes on day 141 at this pace, a little slack for course edits
    expect(lastKanjiDay).toBeGreaterThan(100)
    expect(lastKanjiDay).toBeLessThanOrEqual(155)
    expect(allIds.filter(id => !stats[id]?.correct)).toEqual([])
    expect(opened.map(o => o.group).sort()).toEqual(groupIds)
  })

  it('who misses some keeps every rule of a session, re-asks included, and still opens every group', () => {
    // sessions of 30 with 5 new: at 20 the due reviews fill every day the cap is reached, it never decides
    const { stats, opened, reasks, capped } = simulate(320, 0.15, 30, 5)
    // the misses really ran through the re-asks and the cap
    expect(reasks).toBeGreaterThan(100)
    expect(capped).toBeGreaterThan(0)
    expect(opened.map(o => o.group).sort()).toEqual(groupIds)
    expect(allIds.filter(id => !stats[id])).toEqual([])
  })
})
