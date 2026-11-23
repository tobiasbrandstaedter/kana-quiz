import { describe, it, expect } from 'vitest'
import { seeded } from './seeded'
import {
  planKanji, planCards, pickedKanjiIds, pickedWordIds, errorPracticeIds, singleKanjiOrder, wordLock, groupLock, groupStarted,
  MAX_KANJI_LEARNING,
} from './kanjiPlan'
import type { PlanCourse } from './kanjiPlan'
import { newKanjiEntry } from './kanjiStats'
import { C, DAY, G, G2, GROUP, GROUP_D, IDS, NOW, READY, WORDS, readyWith, seen, statsOf } from './kanjiFixtures'
import type { KanjiAnswerRecord, KanjiSetEntry, KanjiStatEntry } from '../types'

// kanji only, the tests further down add words
const K: PlanCourse = { kanji: IDS, words: [], groups: [] }

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

  it('puts the lowest box first, the most overdue first within a box', () => {
    // A is the most overdue of all, sorting by the due date alone would take it first
    const s = statsOf(seen('k:A', 3, NOW - 5 * DAY), seen('k:B', 1, NOW - 2 * DAY), seen('k:C', 1, NOW - 3 * DAY))
    expect(planKanji(s, [], K, 2, NOW, 0).due).toEqual(['k:C', 'k:B'])
    expect(planKanji(s, [], K, 3, NOW, 0).due).toEqual(['k:C', 'k:B', 'k:A'])
  })

  const answers = (id: string, pattern: string): KanjiAnswerRecord[] =>
    [...pattern].map(c => ({ id, type: 'meaning', correct: c === '1', given: '', ms: 1000, t: NOW }))

  it('picks weak items from the recent answers', () => {
    const s = statsOf(seen('k:A', 2, NOW + 5 * DAY), seen('k:B', 2, NOW + 5 * DAY))
    const p = planKanji(s, answers('k:B', '100'), K, 10, NOW, 0)
    expect(p.weak).toEqual(['k:B'])
    expect(p.fill).toEqual(['k:A'])
  })

  it('calls an item weak from three answers and three wrong in ten, worst first', () => {
    const s = statsOf(...['k:A', 'k:B', 'k:C', 'k:D'].map(id => seen(id, 2, NOW + 5 * DAY)))
    const log = [
      ...answers('k:A', '1110111010'),  // three of ten wrong: weak
      ...answers('k:B', '1111101110'),  // two of ten: not yet
      ...answers('k:C', '00'),          // two answers say nothing yet
      ...answers('k:D', '100'),         // two of three
    ]
    expect(planKanji(s, log, K, 10, NOW, 0).weak).toEqual(['k:D', 'k:A'])
  })

  it('fills the rest with what is due next, soonest first (KR28)', () => {
    const s = statsOf(seen('k:A', 2, NOW + 5 * DAY), seen('k:B', 2, NOW + DAY), seen('k:C', 3, NOW + 3 * DAY), seen('k:D', 1, NOW - DAY))
    const p = planKanji(s, [], K, 10, NOW, 0)
    expect(p.due).toEqual(['k:D'])
    expect(p.fill).toEqual(['k:B', 'k:C', 'k:A'])
    // reviews and new kanji come first, the fill takes what room is left
    expect(planKanji(s, [], K, 5, NOW, 1)).toMatchObject({ due: ['k:D'], fresh: ['k:E'], fill: ['k:B'] })
  })

  it('stops new kanji while twelve are settling and says why', () => {
    const shaky = IDS.slice(0, MAX_KANJI_LEARNING).map(id => seen(id, 1, NOW + DAY))
    const p = planKanji(statsOf(...shaky), [], K, 30, NOW, 3)
    expect(p.fresh).toEqual([])
    expect(p.newBlocked).toBe('cap')
    // one less and they come again
    expect(planKanji(statsOf(...shaky.slice(1)), [], K, 30, NOW, 3).fresh).toHaveLength(3)
  })

  it('counts only box 0 and 1 toward the twelve, an item in box 2 has settled', () => {
    const eleven = IDS.slice(0, MAX_KANJI_LEARNING - 1).map(id => seen(id, 1, NOW + DAY))
    expect(planKanji(statsOf(...eleven, seen(IDS[11], 0, NOW + DAY)), [], K, 30, NOW, 3).newBlocked).toBe('cap')
    const settled = [...eleven, ...IDS.slice(11, 16).map(id => seen(id, 2, NOW + DAY))]
    expect(planKanji(statsOf(...settled), [], K, 30, NOW, 3).fresh).toEqual(IDS.slice(16, 19))
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

  it('says when the reviews fill the session although something new is ready', () => {
    const s = statsOf(seen('k:A', 2, NOW - DAY), seen('k:B', 2, NOW - DAY))
    const full = planKanji(s, [], K, 2, NOW, 3)
    expect(full.fresh).toEqual([])
    expect(full.newBlocked).toBe('reviews')
    expect(planKanji(s, [], K, 5, NOW, 3).newBlocked).toBeNull()
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
    const s = statsOf(seen('k:A', 0, NOW + DAY))
    const p = planKanji(s, [], C, 10, NOW, 3)
    expect(p.waitingWords).toEqual(['w:a'])
    // three cards for the word, six for the next kanji with its word, the last one fills
    expect(p.fresh).toEqual(['k:B'])
    expect(p.fill).toEqual(['k:A'])
    expect(planCards(p)).toBe(10)
  })

  it('unlocks further words once the home kanji was answered right, the special one last (KR29)', () => {
    const early = statsOf(seen('k:A', 0, NOW + DAY), seen('w:a', 1, NOW + DAY))
    expect(planKanji(early, [], C, 30, NOW, 3).waitingWords).toEqual([])
    const reviewed = statsOf(seen('k:A', 1, NOW + DAY), seen('w:a', 1, NOW + DAY))
    expect(planKanji(reviewed, [], C, 30, NOW, 3).waitingWords).toEqual(['w:a2', 'w:a-special'])
  })

  it('takes at most as many words as new kanji, no new kanji while words of met kanji wait (KR30, KD8)', () => {
    const s = statsOf(seen('k:A', 1, NOW + DAY), seen('w:a', 1, NOW + DAY))
    const one = planKanji(s, [], C, 30, NOW, 1)
    expect(one.waitingWords).toEqual(['w:a2'])
    expect(one.fresh).toEqual([])
    const two = planKanji(s, [], C, 30, NOW, 2)
    expect(two.waitingWords).toEqual(['w:a2', 'w:a-special'])
    expect(two.fresh).toEqual(['k:B', 'k:C'])
    const short = planKanji(s, [], C, 5, NOW, 3)
    expect(short.waitingWords).toEqual(['w:a2'])
    expect(short.fresh).toEqual([])
  })

  it('counts words toward the twelve that stop new material (KR31)', () => {
    const shaky = [...IDS.slice(0, 6), ...WORDS.slice(0, 6).map(w => w.id)].map(id => seen(id, 1, NOW + DAY))
    const p = planKanji(statsOf(...shaky), [], { kanji: [...C.kanji, ...IDS.slice(5, 6)], words: WORDS, groups: [] }, 30, NOW, 3)
    expect(p.fresh).toEqual([])
    expect(p.waitingWords).toEqual([])
    expect(p.newBlocked).toBe('cap')
  })

  it('takes new words only from the picked sets', () => {
    const s = statsOf(seen('k:A', 2, NOW + DAY), seen('w:a', 1, NOW + DAY), seen('k:B', 1, NOW + DAY))
    const p = planKanji(s, [], C, 30, NOW, 3, ['k:B', 'k:C'])
    expect(p.waitingWords).toEqual(['w:b'])
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
    const s = statsOf(seen('k:A', 0, NOW + DAY))
    expect(wordLock(WORDS[5], s)).toEqual({ unseen: ['k:D'], review: false })
    expect(wordLock(WORDS[2], s)).toEqual({ unseen: [], review: true })
    expect(wordLock(WORDS[0], s)).toBeNull()
    expect(wordLock(WORDS[2], statsOf(seen('k:A', 1, NOW + DAY)))).toBeNull()
  })
})

describe('pickedWordIds', () => {
  it('lists the words met so far whose home kanji is picked', () => {
    const s = statsOf(seen('w:a', 1, NOW), seen('w:b', 1, NOW), seen('w:ad', 1, NOW))
    expect(pickedWordIds(['k:A', 'k:D'], WORDS, s)).toEqual(['w:a', 'w:ad'])
    expect(pickedWordIds(['k:C'], WORDS, s)).toEqual([])
  })

  it('lists the group words met so far along, by their home on the counter', () => {
    expect(pickedWordIds(['k:B'], G.words, readyWith(seen('w:g2', 1, NOW)))).toEqual(['w:b', 'w:g2'])
  })
})

describe('groupLock (KR76)', () => {
  it('names the kanji of its words not met yet and whether the counter needs a review', () => {
    expect(groupLock(GROUP, {})).toEqual({ unseen: ['k:A', 'k:B', 'k:D'], review: true })
    expect(groupLock(GROUP, statsOf(seen('k:A', 1, NOW), seen('k:B', 1, NOW)))).toEqual({ unseen: ['k:D'], review: true })
    expect(groupLock(GROUP, statsOf(seen('k:A', 1, NOW), seen('k:B', 2, NOW)))).toEqual({ unseen: ['k:D'], review: false })
    expect(groupLock(GROUP, readyWith())).toBeNull()
  })

  it('is not held back by the kanji of its question word', () => {
    // the question word needs E, which nobody has met
    expect(readyWith()['k:E']).toBeUndefined()
    expect(groupLock(GROUP, readyWith())).toBeNull()
  })
})

describe('groupStarted', () => {
  it('counts a group as started once one of its words was answered, nothing else is stored', () => {
    expect(groupStarted(GROUP, readyWith())).toBe(false)
    expect(groupStarted(GROUP, readyWith(seen('w:g2', 0, NOW)))).toBe(true)
  })
})

describe('planKanji with a group', () => {
  it('opens a ready group with its card and its words in table order, the question word once it can be read', () => {
    const p = planKanji(readyWith(), [], G, 30, NOW, 3)
    expect(p.group).toEqual({ id: 'gb', words: ['w:g1', 'w:g2'] })
    expect(p.waitingWords).toEqual([])
    expect(p.newBlocked).toBeNull()
  })

  it('counts its words against the word limit, the card against neither limit (KR30)', () => {
    const two = planKanji(readyWith(), [], G, 30, NOW, 2)
    expect(two.group?.words).toEqual(['w:g1', 'w:g2'])
    expect(two.fresh).toEqual(['k:C', 'k:E'])
    const one = planKanji(readyWith(), [], G, 30, NOW, 1)
    expect(one.group?.words).toEqual(['w:g1'])
    expect(one.fresh).toEqual(['k:C'])
    // card, three cards for the word, six for the new kanji with its first word
    expect(planCards({ ...one, fill: [] })).toBe(1 + 3 + 6)
  })

  it('costs one card of room and needs room for one word after it', () => {
    expect(planKanji(readyWith(), [], G, 3, NOW, 3).group).toBeNull()
    const four = planKanji(readyWith(), [], G, 4, NOW, 3)
    expect(four.group).toEqual({ id: 'gb', words: ['w:g1'] })
    expect(planCards(four)).toBe(4)
  })

  it('waits for every kanji of its words and for a review of the counter', () => {
    const noD = statsOf(...READY.filter(e => e.id !== 'k:D' && e.id !== 'w:ad'))
    expect(planKanji(noD, [], G, 30, NOW, 3).group).toBeNull()
    expect(planKanji(readyWith(seen('k:B', 1, NOW + DAY)), [], G, 30, NOW, 3).group).toBeNull()
  })

  it('goes on with a started group after first words left behind and before further words, without a card', () => {
    const s = readyWith(seen('k:A', 2, NOW + DAY), seen('k:E', 1, NOW + DAY), seen('w:g1', 1, NOW + DAY))
    const p = planKanji(s, [], G, 30, NOW, 4)
    expect(p.waitingWords).toEqual(['w:e', 'w:g2', 'w:gq', 'w:a2'])
    expect(p.group).toBeNull()
  })

  it('brings plain further words before a new group opens', () => {
    const s = readyWith(seen('k:A', 2, NOW + DAY))
    const three = planKanji(s, [], G, 30, NOW, 3)
    expect(three.waitingWords).toEqual(['w:a2', 'w:a-special'])
    expect(three.group).toEqual({ id: 'gb', words: ['w:g1'] })
    const two = planKanji(s, [], G, 30, NOW, 2)
    expect(two.waitingWords).toEqual(['w:a2', 'w:a-special'])
    expect(two.group).toBeNull()
  })

  it('opens no group while twelve items are settling (KR31)', () => {
    const extra = IDS.slice(5, 12)
    const p = planKanji(readyWith(...extra.map(id => seen(id, 1, NOW + DAY))), [], { ...G, kanji: [...G.kanji, ...extra] }, 30, NOW, 3)
    expect(p.group).toBeNull()
    expect(p.newBlocked).toBe('cap')
  })

  it('belongs to the set of its counter', () => {
    expect(planKanji(readyWith(), [], G, 30, NOW, 3, ['k:C']).group).toBeNull()
    expect(planKanji(readyWith(), [], G, 30, NOW, 3, ['k:B']).group?.id).toBe('gb')
    // the question word still waits for E, which no picked set brings
    const done = readyWith(seen('w:g1', 1, NOW + DAY), seen('w:g2', 1, NOW + DAY))
    expect(planKanji(done, [], G, 30, NOW, 3, ['k:B']).newBlocked).toBe('sets')
  })
})

describe('planKanji with two groups (KR76)', () => {
  // both groups ready: their kanji met, both counters reviewed on a later day
  const ready = (...extra: KanjiStatEntry[]) => readyWith(seen('k:D', 2, NOW + DAY), ...extra)

  it('opens the group whose counter comes first, one per session', () => {
    expect(planKanji(ready(), [], G2, 30, NOW, 5).group).toEqual({ id: 'gb', words: ['w:g1', 'w:g2'] })
  })

  it('keeps the second one shut while words of the first still wait', () => {
    const started = ready(seen('w:g1', 1, NOW + DAY))
    // the word limit or the room goes to the first group's next word, the second one waits
    for (const [size, limit] of [[30, 1], [5, 5]]) {
      const p = planKanji(started, [], G2, size, NOW, limit)
      expect(p.waitingWords, `size ${size}, limit ${limit}`).toEqual(['w:g2'])
      expect(p.group, `size ${size}, limit ${limit}`).toBeNull()
    }
    // with room for both the first group's last word comes first, then the second opens
    expect(planKanji(started, [], G2, 30, NOW, 5)).toMatchObject({ waitingWords: ['w:g2'], group: { id: 'gd', words: ['w:d1', 'w:d2'] } })
    // once the words of the first group have come in, the second one opens
    const done = ready(seen('w:g1', 1, NOW + DAY), seen('w:g2', 1, NOW + DAY))
    expect(planKanji(done, [], G2, 30, NOW, 5).group).toEqual({ id: 'gd', words: ['w:d1', 'w:d2'] })
  })

  it('brings the words of started groups by the place of their counter', () => {
    const both = ready(seen('w:g1', 1, NOW + DAY), seen('w:d1', 1, NOW + DAY))
    expect(planKanji(both, [], G2, 30, NOW, 5).waitingWords).toEqual(['w:g2', 'w:d2'])
    // the course order decides, not the order the groups are listed in
    const listed = { ...G2, groups: [GROUP_D, GROUP] }
    expect(planKanji(both, [], listed, 30, NOW, 5).waitingWords).toEqual(['w:g2', 'w:d2'])
  })
})
