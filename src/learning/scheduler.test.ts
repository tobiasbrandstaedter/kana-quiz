import { describe, it, expect } from 'vitest'
import type { AnswerRecord, StatEntry, StatsMap } from '../types'
import { review, isDue, recentErrors, pickSmart, orderSession, columnProgress, MAX_BOX } from './scheduler'
import { allPairs, pairFor, HIRAGANA } from '../data/kana'
import { newEntry } from './statsMigration'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000
const fixedRng = () => 0.5

function entry(kana: string, box: number, due: number, extra: Partial<StatEntry> = {}): StatEntry {
  return { ...newEntry(pairFor(kana)!), correct: 3, box, due, ...extra }
}

function stats(...entries: StatEntry[]): StatsMap {
  return Object.fromEntries(entries.map(e => [e.kana, e]))
}

function answers(kana: string, pattern: string): AnswerRecord[] {
  return [...pattern].map((c, i) => ({ kana, direction: 'kana-to-romaji', correct: c === '1', given: '', ms: 1000, t: i }))
}

describe('review', () => {
  it('promotes a due kana and schedules the next interval', () => {
    expect(review({ box: 0, due: 0 }, true, NOW)).toEqual({ box: 1, due: NOW + DAY })
    expect(review({ box: 2, due: NOW }, true, NOW)).toEqual({ box: 3, due: NOW + 7 * DAY })
  })

  it('does not promote a kana that is not due yet', () => {
    const s = { box: 1, due: NOW + DAY }
    expect(review(s, true, NOW)).toBe(s)
  })

  it('accepts a review a few hours early', () => {
    expect(isDue({ box: 1, due: NOW + 3 * 60 * 60 * 1000 }, NOW)).toBe(true)
    expect(isDue({ box: 1, due: NOW + 5 * 60 * 60 * 1000 }, NOW)).toBe(false)
  })

  it('drops to box 0 on a wrong answer, due at once', () => {
    expect(review({ box: 4, due: NOW + 9 * DAY }, false, NOW)).toEqual({ box: 0, due: NOW })
  })

  it('caps at the top box', () => {
    expect(review({ box: MAX_BOX, due: 0 }, true, NOW).box).toBe(MAX_BOX)
  })
})

describe('recentErrors', () => {
  it('only looks at the last ten answers per kana', () => {
    const log = [...answers('ぬ', '0000011111'), ...answers('ぬ', '1111111110')]
    expect(recentErrors(log).get('ぬ')).toEqual({ errors: 1, answers: 10 })
  })
})

describe('pickSmart', () => {
  const table = allPairs().filter(p => p.script === 'hiragana')

  it('puts due kana first, lowest box and most overdue first', () => {
    const s = stats(
      entry('か', 2, NOW - DAY),
      entry('き', 0, NOW - DAY),
      entry('く', 2, NOW - 5 * DAY),
      entry('け', 3, NOW + 5 * DAY),
    )
    const p = pickSmart(s, [], [], ['hiragana'], 20, NOW)
    expect(p.due.map(x => x.kana)).toEqual(['き', 'く', 'か'])
    expect(p.fill.map(x => x.kana)).toEqual(['け'])
  })

  it('adds weak kana by recent error rate even when not due', () => {
    const s = stats(entry('ね', 2, NOW + 2 * DAY), entry('れ', 2, NOW + 2 * DAY))
    const p = pickSmart(s, answers('ね', '1001'), [], ['hiragana'], 20, NOW)
    expect(p.weak.map(x => x.kana)).toEqual(['ね'])
  })

  it('introduces new kana in table order, at most five', () => {
    const p = pickSmart({}, [], table, ['hiragana'], 20, NOW)
    expect(p.fresh.map(x => x.kana)).toEqual(['あ', 'い', 'う', 'え', 'お'])
  })

  it('holds back new kana while many are still shaky', () => {
    const shaky = ['か', 'き', 'く', 'け', 'こ', 'さ', 'し', 'す', 'せ', 'そ'].map(k => entry(k, 1, NOW + DAY))
    const p = pickSmart(stats(...shaky), [], table, ['hiragana'], 20, NOW)
    expect(p.fresh).toEqual([])
  })

  it('leaves room for new kana only when the session has space', () => {
    const due = HIRAGANA.main.flatMap(c => c.kana).slice(0, 19).map(k => entry(k, 3, NOW - DAY))
    const p = pickSmart(stats(...due), [], table, ['hiragana'], 20, NOW)
    expect(p.due).toHaveLength(19)
    expect(p.fresh).toEqual([])
  })

  it('ignores kana of scripts not in play', () => {
    const s = stats(entry('カ', 0, 0), entry('か', 0, 0))
    const p = pickSmart(s, [], [], ['hiragana'], 20, NOW)
    expect(p.due.map(x => x.kana)).toEqual(['か'])
  })

  it('never picks a kana twice', () => {
    const s = stats(entry('ね', 0, 0))
    const p = pickSmart(s, answers('ね', '0000'), table, ['hiragana'], 20, NOW)
    const all = [...p.due, ...p.weak, ...p.fresh, ...p.fill].map(x => x.kana)
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('orderSession', () => {
  it('shows each new kana before testing it, twice', () => {
    const fresh = ['あ', 'い', 'う'].map(k => pairFor(k)!)
    const items = orderSession({ due: [], weak: [], fresh, fill: [] }, fixedRng)
    expect(items.map(i => (i.intro ? 'I' : 'T') + i.pair.kana).join(' '))
      .toBe('Iあ Iい Tあ Iう Tい Tあ Tう Tい Tう')
  })

  it('keeps every review exactly once', () => {
    const due = ['か', 'き', 'く', 'け'].map(k => pairFor(k)!)
    const items = orderSession({ due, weak: [], fresh: [pairFor('あ')!], fill: [] }, fixedRng)
    expect(items).toHaveLength(7)
    expect(items.filter(i => !i.intro && i.pair.kana !== 'あ').map(i => i.pair.kana).sort()).toEqual(['か', 'き', 'く', 'け'])
    expect(items.findIndex(i => i.intro)).toBeLessThan(items.findIndex(i => !i.intro && i.pair.kana === 'あ'))
  })
})

describe('columnProgress', () => {
  it('counts seen, mastered and due kana', () => {
    const s = stats(entry('か', 3, NOW + DAY), entry('き', 1, NOW - DAY), entry('く', 0, 0, { correct: 0 }))
    expect(columnProgress(['か', 'き', 'く', 'け', 'こ'], s, NOW)).toEqual({ total: 5, seen: 2, mastered: 1, due: 1 })
  })
})
