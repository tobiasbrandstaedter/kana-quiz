import { describe, it, expect } from 'vitest'
import { planKanji, MAX_KANJI_LEARNING } from './kanjiPlan'
import { newKanjiEntry } from './kanjiStats'
import type { KanjiAnswerRecord, KanjiStatEntry, KanjiStatsMap } from '../types'

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

  it('ignores stored items that are not in the list', () => {
    const s = statsOf(seen('w:something', 0, NOW - DAY))
    expect(planKanji(s, [], IDS, 10, NOW, 0).due).toEqual([])
  })
})
