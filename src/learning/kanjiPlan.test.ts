import { describe, it, expect } from 'vitest'
import { planKanji, pickedKanjiIds, errorPracticeIds, singleKanjiOrder, MAX_KANJI_LEARNING } from './kanjiPlan'
import { newKanjiEntry } from './kanjiStats'
import type { KanjiAnswerRecord, KanjiSetEntry, KanjiStatEntry, KanjiStatsMap } from '../types'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

const IDS = Array.from({ length: 30 }, (_, i) => `k:${String.fromCharCode(65 + i)}`)

const seen = (id: string, box: number, due: number): KanjiStatEntry => ({ ...newKanjiEntry(id), correct: 1, box, due })
const statsOf = (...entries: KanjiStatEntry[]): KanjiStatsMap => Object.fromEntries(entries.map(e => [e.id, e]))

describe('planKanji', () => {
  it('brings new kanji in learning order, each worth three cards', () => {
    const p = planKanji({}, [], IDS, 10, NOW, 3)
    expect(p.fresh).toEqual(IDS.slice(0, 3))
    expect(p).toMatchObject({ due: [], weak: [], fill: [], newBlocked: null })
  })

  it('fits new kanji into the room the reviews leave', () => {
    const s = statsOf(...IDS.slice(0, 5).map(id => seen(id, 2, NOW - DAY)))
    const p = planKanji(s, [], IDS, 10, NOW, 3)
    expect(p.due).toHaveLength(5)
    // 5 cards left: one new kanji takes three, every seen kanji is due already, so nothing fills
    expect(p.fresh).toEqual([IDS[5]])
    expect(p.fill).toHaveLength(0)
  })

  it('puts the lowest box and the most overdue first', () => {
    const s = statsOf(seen('k:A', 3, NOW - DAY), seen('k:B', 1, NOW - 2 * DAY), seen('k:C', 1, NOW - 3 * DAY))
    expect(planKanji(s, [], IDS, 2, NOW, 0).due).toEqual(['k:C', 'k:B'])
  })

  it('picks weak items from the recent answers', () => {
    const s = statsOf(seen('k:A', 2, NOW + 5 * DAY), seen('k:B', 2, NOW + 5 * DAY))
    const log: KanjiAnswerRecord[] = [true, false, false].map(correct => ({ id: 'k:B', type: 'meaning', correct, given: '', ms: 1000, t: NOW }))
    const p = planKanji(s, log, IDS, 10, NOW, 0)
    expect(p.weak).toEqual(['k:B'])
    expect(p.fill).toEqual(['k:A'])
  })

  it('stops new kanji while twelve are settling and says why', () => {
    const shaky = IDS.slice(0, MAX_KANJI_LEARNING).map(id => seen(id, 1, NOW + DAY))
    const p = planKanji(statsOf(...shaky), [], IDS, 30, NOW, 3)
    expect(p.fresh).toEqual([])
    expect(p.newBlocked).toBe('cap')
    // one less and they come again
    expect(planKanji(statsOf(...shaky.slice(1)), [], IDS, 30, NOW, 3).fresh).toHaveLength(3)
  })

  it('says new kanji are switched off', () => {
    expect(planKanji({}, [], IDS, 10, NOW, 0).newBlocked).toBe('off')
  })

  it('has no reason when every kanji is seen', () => {
    const s = statsOf(...IDS.map(id => seen(id, 3, NOW + 5 * DAY)))
    const p = planKanji(s, [], IDS, 10, NOW, 3)
    expect(p.fresh).toEqual([])
    expect(p.newBlocked).toBeNull()
    expect(p.fill).toHaveLength(10)
  })

  it('takes new kanji only from the picked sets, reviews from everywhere', () => {
    const s = statsOf(seen('k:A', 2, NOW - DAY))
    const p = planKanji(s, [], IDS, 20, NOW, 3, ['k:E', 'k:F'])
    expect(p.fresh).toEqual(['k:E', 'k:F'])
    expect(p.due).toEqual(['k:A'])
  })

  it('says when the picked sets have nothing new left', () => {
    const s = statsOf(seen('k:E', 2, NOW + DAY))
    const p = planKanji(s, [], IDS, 20, NOW, 3, ['k:E'])
    expect(p.fresh).toEqual([])
    expect(p.newBlocked).toBe('sets')
    // switched off wins, that is what the learner can change first
    expect(planKanji(s, [], IDS, 20, NOW, 0, ['k:E']).newBlocked).toBe('off')
  })

  it('ignores stored items that are not in the list', () => {
    const s = statsOf(seen('w:something', 0, NOW - DAY))
    expect(planKanji(s, [], IDS, 10, NOW, 0).due).toEqual([])
  })
})

const seeded = (seed = 1) => () => (seed = (seed * 16807) % 2147483647) / 2147483647
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
