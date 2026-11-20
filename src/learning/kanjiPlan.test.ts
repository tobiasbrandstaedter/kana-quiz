import { describe, it, expect } from 'vitest'
import { seeded } from './seeded'
import {
  planKanji, planCards, orderKanjiSession, readyCard, spreadCards, pickedKanjiIds, pickedWordIds, errorPracticeIds, singleKanjiOrder, wordLock,
  MAX_KANJI_LEARNING,
} from './kanjiPlan'
import type { PlanCourse, PlanWord, PlannedCard } from './kanjiPlan'
import { newKanjiEntry } from './kanjiStats'
import type { KanjiAnswerRecord, KanjiSetEntry, KanjiStatEntry, KanjiStatsMap } from '../types'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

const IDS = Array.from({ length: 30 }, (_, i) => `k:${String.fromCharCode(65 + i)}`)
// kanji only, the tests further down add words
const K: PlanCourse = { kanji: IDS, words: [] }

const seen = (id: string, box: number, due: number): KanjiStatEntry => ({ ...newKanjiEntry(id), correct: 1, box, due })
const statsOf = (...entries: KanjiStatEntry[]): KanjiStatsMap => Object.fromEntries(entries.map(e => [e.id, e]))

describe('planKanji over kanji', () => {
  it('brings new kanji in learning order, each worth three cards', () => {
    const p = planKanji({}, [], K, 10, NOW, 3)
    expect(p.fresh).toEqual(IDS.slice(0, 3))
    expect(p).toMatchObject({ due: [], weak: [], fill: [], newBlocked: null })
  })

  it('fits new kanji into the room the reviews leave', () => {
    const s = statsOf(...IDS.slice(0, 5).map(id => seen(id, 2, NOW - DAY)))
    const p = planKanji(s, [], K, 10, NOW, 3)
    expect(p.due).toHaveLength(5)
    // 5 cards left: one new kanji takes three, every seen kanji is due already, so nothing fills
    expect(p.fresh).toEqual([IDS[5]])
    expect(p.fill).toHaveLength(0)
  })

  it('puts the lowest box and the most overdue first', () => {
    const s = statsOf(seen('k:A', 3, NOW - DAY), seen('k:B', 1, NOW - 2 * DAY), seen('k:C', 1, NOW - 3 * DAY))
    expect(planKanji(s, [], K, 2, NOW, 0).due).toEqual(['k:C', 'k:B'])
  })

  it('picks weak items from the recent answers', () => {
    const s = statsOf(seen('k:A', 2, NOW + 5 * DAY), seen('k:B', 2, NOW + 5 * DAY))
    const log: KanjiAnswerRecord[] = [true, false, false].map(correct => ({ id: 'k:B', type: 'meaning', correct, given: '', ms: 1000, t: NOW }))
    const p = planKanji(s, log, K, 10, NOW, 0)
    expect(p.weak).toEqual(['k:B'])
    expect(p.fill).toEqual(['k:A'])
  })

  it('stops new kanji while twelve are settling and says why', () => {
    const shaky = IDS.slice(0, MAX_KANJI_LEARNING).map(id => seen(id, 1, NOW + DAY))
    const p = planKanji(statsOf(...shaky), [], K, 30, NOW, 3)
    expect(p.fresh).toEqual([])
    expect(p.newBlocked).toBe('cap')
    // one less and they come again
    expect(planKanji(statsOf(...shaky.slice(1)), [], K, 30, NOW, 3).fresh).toHaveLength(3)
  })

  it('says new kanji are switched off', () => {
    expect(planKanji({}, [], K, 10, NOW, 0).newBlocked).toBe('off')
  })

  it('has no reason when every kanji is seen', () => {
    const s = statsOf(...IDS.map(id => seen(id, 3, NOW + 5 * DAY)))
    const p = planKanji(s, [], K, 10, NOW, 3)
    expect(p.fresh).toEqual([])
    expect(p.newBlocked).toBeNull()
    expect(p.fill).toHaveLength(10)
  })

  it('takes new kanji only from the picked sets, reviews from everywhere', () => {
    const s = statsOf(seen('k:A', 2, NOW - DAY))
    const p = planKanji(s, [], K, 20, NOW, 3, ['k:E', 'k:F'])
    expect(p.fresh).toEqual(['k:E', 'k:F'])
    expect(p.due).toEqual(['k:A'])
  })

  it('says when the picked sets have nothing new left', () => {
    const s = statsOf(seen('k:E', 2, NOW + DAY))
    const p = planKanji(s, [], K, 20, NOW, 3, ['k:E'])
    expect(p.fresh).toEqual([])
    expect(p.newBlocked).toBe('sets')
    // switched off wins, that is what the learner can change first
    expect(planKanji(s, [], K, 20, NOW, 0, ['k:E']).newBlocked).toBe('off')
  })

  it('ignores stored items that are not in the list', () => {
    const s = statsOf(seen('w:something', 0, NOW - DAY))
    expect(planKanji(s, [], K, 10, NOW, 0).due).toEqual([])
  })
})

const miss = (id: string): KanjiAnswerRecord => ({ id, type: 'meaning', correct: false, given: '', ms: 1000, t: NOW })

describe('pickedKanjiIds', () => {
  const SETS: KanjiSetEntry[] = [
    { id: 's1', title: 'One', kanji: ['A', 'B', 'C'] },
    { id: 's2', title: 'Two', kanji: ['D', 'E'] },
    { id: 's3', title: 'Three', kanji: ['F'] },
  ]

  it('lists the kanji of the picked sets in course order', () => {
    expect(pickedKanjiIds(SETS, new Set(['s3', 's1']))).toEqual(['k:A', 'k:B', 'k:C', 'k:F'])
  })

  it('has nothing for no sets or sets that do not exist', () => {
    expect(pickedKanjiIds(SETS, new Set())).toEqual([])
    expect(pickedKanjiIds(SETS, new Set(['gone']))).toEqual([])
  })
})

describe('errorPracticeIds', () => {
  it('asks each error one to three times by its recent misses', () => {
    const errors = [{ ...newKanjiEntry('k:A'), incorrect: 1 }, { ...newKanjiEntry('k:B'), incorrect: 6 }]
    const log = [miss('k:B'), miss('k:B'), miss('k:B'), miss('k:B')]
    const ids = errorPracticeIds(errors, log, seeded())
    expect(ids.filter(id => id === 'k:A')).toHaveLength(1)
    expect(ids.filter(id => id === 'k:B')).toHaveLength(3)
  })
})

describe('singleKanjiOrder', () => {
  it('asks the kanji three times with a known one after each', () => {
    const order = singleKanjiOrder('k:A', ['k:A', 'k:B', 'k:C', 'k:D', 'k:E'], seeded())
    expect(order).toHaveLength(6)
    expect(order.filter((_, i) => i % 2 === 0)).toEqual(['k:A', 'k:A', 'k:A'])
    expect(new Set(order.filter((_, i) => i % 2 === 1)).size).toBe(3)
    expect(order.filter((_, i) => i % 2 === 1)).not.toContain('k:A')
  })

  it('makes do with fewer known kanji', () => {
    expect(singleKanjiOrder('k:A', ['k:B'])).toEqual(['k:A', 'k:B', 'k:A', 'k:A'])
    expect(singleKanjiOrder('k:A', [])).toEqual(['k:A', 'k:A', 'k:A'])
  })
})

// A course with words: every kanji has its own first word, A has two further words, one
// of them special, the first word of D needs A too
const word = (id: string, kanji: string[], first: boolean, special = false): PlanWord =>
  ({ id: `w:${id}`, kanji: kanji.map(k => `k:${k}`), home: `k:${kanji[kanji.length - 1]}`, first, special })
const WORDS: PlanWord[] = [
  word('a', ['A'], true), word('a-special', ['A'], false, true), word('a2', ['A'], false),
  word('b', ['B'], true), word('c', ['C'], true), word('ad', ['A', 'D'], true), word('e', ['E'], true),
]
const C: PlanCourse = { kanji: ['k:A', 'k:B', 'k:C', 'k:D', 'k:E'], words: WORDS }

describe('planKanji with words', () => {
  it('starts a new kanji only with room for all six cards, its first word along (KR14)', () => {
    const p = planKanji({}, [], C, 10, NOW, 3)
    expect(p.fresh).toEqual(['k:A'])
    expect(p.firstWords).toEqual({ 'k:A': 'w:a' })
    expect(planCards(p)).toBe(6)
    const q = planKanji({}, [], C, 20, NOW, 3)
    expect(q.fresh).toEqual(['k:A', 'k:B', 'k:C'])
    expect(planCards(q)).toBe(18)
  })

  it('lets a first word come along when its other kanji is new earlier in the same session', () => {
    const s = statsOf(seen('k:B', 2, NOW + DAY), seen('k:C', 2, NOW + DAY), seen('w:b', 2, NOW + DAY), seen('w:c', 2, NOW + DAY))
    const p = planKanji(s, [], C, 30, NOW, 3)
    expect(p.fresh).toEqual(['k:A', 'k:D', 'k:E'])
    expect(p.firstWords).toMatchObject({ 'k:A': 'w:a', 'k:D': 'w:ad' })
  })

  it('starts a kanji alone when its first word has a kanji not met yet', () => {
    const p = planKanji({}, [], C, 20, NOW, 3, ['k:D'])
    expect(p.fresh).toEqual(['k:D'])
    expect(p.firstWords).toEqual({})
    expect(planCards(p)).toBe(3)
  })

  it('puts a first word left behind first in line, before new kanji', () => {
    const s = statsOf(seen('k:A', 1, NOW + DAY))
    const p = planKanji(s, [], C, 10, NOW, 3)
    expect(p.newWords).toEqual(['w:a'])
    // three cards for the word, six for the next kanji with its word, the last one fills
    expect(p.fresh).toEqual(['k:B'])
    expect(p.fill).toEqual(['k:A'])
    expect(planCards(p)).toBe(10)
  })

  it('unlocks further words once the home kanji is in box 2, the special one last (KR29)', () => {
    const early = statsOf(seen('k:A', 1, NOW + DAY), seen('w:a', 1, NOW + DAY))
    expect(planKanji(early, [], C, 30, NOW, 3).newWords).toEqual([])
    const ready = statsOf(seen('k:A', 2, NOW + DAY), seen('w:a', 1, NOW + DAY))
    expect(planKanji(ready, [], C, 30, NOW, 3).newWords).toEqual(['w:a2', 'w:a-special'])
  })

  it('takes at most as many words as new kanji, words first when room is short (KR30)', () => {
    const s = statsOf(seen('k:A', 2, NOW + DAY), seen('w:a', 1, NOW + DAY))
    const one = planKanji(s, [], C, 30, NOW, 1)
    expect(one.newWords).toEqual(['w:a2'])
    expect(one.fresh).toEqual(['k:B'])
    const short = planKanji(s, [], C, 5, NOW, 3)
    expect(short.newWords).toEqual(['w:a2'])
    expect(short.fresh).toEqual([])
  })

  it('counts words toward the twelve that stop new material (KR31)', () => {
    const shaky = [...IDS.slice(0, 6), ...WORDS.slice(0, 6).map(w => w.id)].map(id => seen(id, 1, NOW + DAY))
    const p = planKanji(statsOf(...shaky), [], { kanji: [...C.kanji, ...IDS.slice(5, 6)], words: WORDS }, 30, NOW, 3)
    expect(p.fresh).toEqual([])
    expect(p.newWords).toEqual([])
    expect(p.newBlocked).toBe('cap')
  })

  it('takes new words only from the picked sets', () => {
    const s = statsOf(seen('k:A', 2, NOW + DAY), seen('w:a', 1, NOW + DAY), seen('k:B', 1, NOW + DAY))
    const p = planKanji(s, [], C, 30, NOW, 3, ['k:B', 'k:C'])
    expect(p.newWords).toEqual(['w:b'])
    expect(p.fresh).toEqual(['k:C'])
  })

  it('names the kanji outside the picked sets that words of the picked sets wait for', () => {
    // the first word of D needs A, which is in no picked set and not seen
    expect(planKanji({}, [], C, 30, NOW, 3, ['k:D']).outsideSets).toEqual(['k:A'])
    expect(planKanji(statsOf(seen('k:A', 1, NOW + DAY)), [], C, 30, NOW, 3, ['k:D']).outsideSets).toEqual([])
    expect(planKanji({}, [], C, 30, NOW, 3).outsideSets).toEqual([])
  })

  it('reviews words that are due like kanji', () => {
    const s = statsOf(seen('k:A', 2, NOW + DAY), seen('w:a', 1, NOW - DAY))
    expect(planKanji(s, [], C, 10, NOW, 0).due).toEqual(['w:a'])
  })
})

describe('wordLock', () => {
  it('names the kanji not met yet and whether the home kanji still needs a review', () => {
    const s = statsOf(seen('k:A', 1, NOW + DAY))
    expect(wordLock(WORDS[5], s)).toEqual({ unseen: ['k:D'], review: false })
    expect(wordLock(WORDS[2], s)).toEqual({ unseen: [], review: true })
    expect(wordLock(WORDS[0], s)).toBeNull()
    expect(wordLock(WORDS[2], statsOf(seen('k:A', 2, NOW + DAY)))).toBeNull()
  })
})

// the same item twice in a row where both cards are questions
const backToBack = (cards: PlannedCard[]) =>
  cards.filter((c, i) => i > 0 && c.id === cards[i - 1].id && c.type !== 'intro' && cards[i - 1].type !== 'intro')

describe('orderKanjiSession', () => {
  it('spreads a lone new kanji and its first word as far as six cards allow (KR12, KR14)', () => {
    const p = planKanji({}, [], C, 10, NOW, 3)
    expect(orderKanjiSession(p, seeded())).toEqual([
      { id: 'k:A', type: 'intro' },
      { id: 'k:A' },
      { id: 'w:a', type: 'intro', needs: 'k:A' },
      { id: 'w:a', type: 'read-choice' },
      { id: 'k:A' },
      { id: 'w:a', type: 'word-meaning' },
    ])
  })

  // reviews of seen kanji and words, so the new ones come on top of real reviews
  const reviews = (n: number) => statsOf(...IDS.slice(10, 10 + n).map(id => seen(id, 2, NOW - DAY)))
  const course = (n: number): PlanCourse => ({ kanji: [...C.kanji, ...IDS.slice(10, 10 + n)], words: WORDS })

  for (const size of [10, 20, 30]) {
    for (const fresh of [1, 2, 3]) {
      for (const due of [0, 3]) {
        it(`keeps the questions of an item apart at size ${size}, ${fresh} new kanji, ${due} reviews`, () => {
          for (let seed = 1; seed < 6; seed++) {
            const p = planKanji(reviews(due), [], course(due), size, NOW, fresh)
            const cards = orderKanjiSession(p, seeded(seed))
            expect(backToBack(cards), JSON.stringify(cards)).toEqual([])
            for (const [i, c] of cards.entries()) {
              // every question comes after its item's intro, a first word after a question of its kanji
              if (c.type !== 'intro' && p.fresh.concat(Object.values(p.firstWords)).includes(c.id)) {
                expect(cards.slice(0, i).some(x => x.id === c.id && x.type === 'intro')).toBe(true)
              }
              if (c.needs) expect(cards.slice(0, i).some(x => x.id === c.needs && x.type !== 'intro')).toBe(true)
            }
            const word = cards.filter(c => c.id.startsWith('w:') && c.id !== 'w:e')
            for (const id of new Set(word.map(c => c.id))) {
              expect(cards.filter(c => c.id === id).map(c => c.type)).toEqual(['intro', 'read-choice', 'word-meaning'])
            }
          }
        })
      }
    }
  }
})

describe('spreadCards', () => {
  it('puts another card between two questions of the same item', () => {
    const cards: PlannedCard[] = [{ id: 'a' }, { id: 'a' }, { id: 'b' }]
    expect(spreadCards(cards).map(c => c.id)).toEqual(['a', 'b', 'a'])
  })

  it('leaves the cards before `from` alone and keeps each item in order', () => {
    const cards: PlannedCard[] = [
      { id: 'a', type: 'intro' }, { id: 'b' }, { id: 'b', type: 'read-choice' }, { id: 'b', type: 'word-meaning' }, { id: 'c' }, { id: 'd' },
    ]
    const out = spreadCards(cards, 2)
    expect(out.slice(0, 2)).toEqual(cards.slice(0, 2))
    expect(out.filter(c => c.id === 'b').map(c => c.type)).toEqual([undefined, 'read-choice', 'word-meaning'])
    expect(backToBack(out)).toEqual([])
  })

  it('keeps clumps it cannot take apart', () => {
    expect(spreadCards([{ id: 'a' }, { id: 'a' }]).map(c => c.id)).toEqual(['a', 'a'])
  })
})

describe('readyCard (KR14)', () => {
  const session: PlannedCard[] = [
    { id: 'k:A', type: 'intro' }, { id: 'k:A' }, { id: 'w:a', type: 'intro', needs: 'k:A' },
    { id: 'k:B' }, { id: 'w:a', type: 'read-choice' }, { id: 'k:A', type: 'meaning' }, { id: 'k:C' }, { id: 'w:a', type: 'word-meaning' },
  ]

  it('shows the word intro once its kanji was answered right', () => {
    expect(readyCard(session, 2, new Set(['k:A']))).toBe(session)
  })

  it('moves the word behind the next question of its kanji when that is still to come', () => {
    const out = readyCard(session, 2, new Set())
    const at = out.findIndex(c => c.id === 'w:a')
    expect(out.slice(0, at).filter(c => c.id === 'k:A' && c.type !== 'intro')).toHaveLength(2)
    expect(out.filter(c => c.id === 'w:a').map(c => c.type)).toEqual(['intro', 'read-choice', 'word-meaning'])
    expect(out).toHaveLength(session.length)
    expect(backToBack(out.slice(2))).toEqual([])
  })

  it('drops the word when no question of its kanji is left, and spreads what stays', () => {
    // the kanji's re-asks would come twice in a row once the word is out
    const cards: PlannedCard[] = [
      { id: 'k:A', type: 'intro' }, { id: 'k:A' }, { id: 'k:B' }, { id: 'w:a', type: 'intro', needs: 'k:A' },
      { id: 'w:a', type: 'read-choice' }, { id: 'k:B' }, { id: 'w:a', type: 'word-meaning' }, { id: 'k:B' }, { id: 'k:C' }, { id: 'k:D' },
    ]
    const out = readyCard(cards, 3, new Set(['k:B']))
    expect(out.map(c => c.id)).not.toContain('w:a')
    expect(out.slice(0, 3)).toEqual(cards.slice(0, 3))
    expect(backToBack(out)).toEqual([])
  })
})

describe('pickedWordIds', () => {
  it('lists the words met so far whose home kanji is picked', () => {
    const s = statsOf(seen('w:a', 1, NOW), seen('w:b', 1, NOW), seen('w:ad', 1, NOW))
    expect(pickedWordIds(['k:A', 'k:D'], WORDS, s)).toEqual(['w:a', 'w:ad'])
    expect(pickedWordIds(['k:C'], WORDS, s)).toEqual([])
  })
})
