import { describe, it, expect } from 'vitest'
import type { AnswerRecord, StatEntry, StatsMap } from '../types'
import { detectPatterns, statsFromLog } from './patterns'
import { pairFor } from '../data/kana'
import { newEntry } from './statsMigration'

function entry(kana: string, correct: number, incorrect: number, extra: Partial<StatEntry> = {}): StatEntry {
  return { ...newEntry(pairFor(kana)!), correct, incorrect, ...extra }
}

function stats(...entries: StatEntry[]): StatsMap {
  return Object.fromEntries(entries.map(e => [e.kana, e]))
}

const NOW = 1_800_000_000_000
const DAY = 24 * 60 * 60 * 1000

describe('confusion detection', () => {
  it('merges both directions and resolves typed romaji to a kana', () => {
    const s = stats(
      entry('ぬ', 3, 2, { confusions: { me: 2 } }),
      entry('め', 4, 1, { confusions: { 'ぬ': 1 } }),
    )
    const p = detectPatterns(s, [], 'all').find(x => x.kind === 'confusion')!
    expect(p.title).toBe('ぬ vs め')
    expect(p.detail).toContain('3×')
    expect(p.detail).toContain('loop')
    expect(p.mode).toBe('romaji-to-kana')
    expect(p.practice.map(x => x.kana)).toEqual(['ぬ', 'め'])
  })

  it('needs two occurrences all-time but one in a round', () => {
    const s = stats(entry('さ', 2, 1, { confusions: { ki: 1 } }))
    expect(detectPatterns(s, [], 'all').some(x => x.kind === 'confusion')).toBe(false)
    expect(detectPatterns(s, [], 'round').some(x => x.kind === 'confusion')).toBe(true)
  })
})

describe('clusters', () => {
  it('flags a row that is clearly worse than the rest', () => {
    const good = ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く'].map(k => entry(k, 5, 0))
    const s = stats(...good, entry('ら', 1, 2), entry('り', 1, 2), entry('る', 2, 1))
    const row = detectPatterns(s, [], 'all').find(x => x.kind === 'row')!
    expect(row.title).toBe('Weak row: ら行')
    expect(row.practice.map(x => x.kana)).toEqual(['ら', 'り', 'る'])
  })

  it('flags dakuten lagging behind plain kana', () => {
    const plain = ['か', 'き', 'く', 'け', 'こ'].map(k => entry(k, 5, 0))
    const s = stats(...plain, entry('が', 1, 2), entry('ぎ', 1, 2))
    const m = detectPatterns(s, [], 'all').find(x => x.kind === 'marks')!
    expect(m.title).toContain('Dakuten')
  })

  it('does not call one bad kana a cluster', () => {
    const s = stats(...['ま', 'み', 'む', 'め', 'も', 'な', 'に'].map(k => entry(k, 5, 0)), entry('ぬ', 2, 3))
    expect(detectPatterns(s, [], 'all').filter(x => x.kind === 'row' || x.kind === 'vowel')).toEqual([])
  })

  it('stays quiet when everything is equally bad', () => {
    const s = stats(...['あ', 'い', 'う', 'か', 'き', 'く'].map(k => entry(k, 1, 2)))
    expect(detectPatterns(s, [], 'all').filter(x => x.kind === 'row' || x.kind === 'vowel')).toEqual([])
  })
})

describe('script and direction gaps', () => {
  it('reports katakana lagging behind', () => {
    const s = stats(
      ...['あ', 'い', 'う', 'え', 'お'].map(k => entry(k, 4, 0)),
      ...['ア', 'イ', 'ウ', 'エ', 'オ'].map(k => entry(k, 2, 2)),
    )
    const g = detectPatterns(s, [], 'all').find(x => x.kind === 'script-gap')!
    expect(g.title).toBe('Katakana lags behind')
    expect(g.practice.every(p => p.script === 'katakana')).toBe(true)
  })

  it('finds kana that are recognized but not read', () => {
    const s = stats(entry('は', 3, 3, {
      byDirection: { 'kana-to-romaji': { correct: 0, incorrect: 3 }, 'romaji-to-kana': { correct: 3, incorrect: 0 } },
    }))
    const g = detectPatterns(s, [], 'all').find(x => x.kind === 'direction-gap')!
    expect(g.title).toBe('Recognized but not read')
    expect(g.mode).toBe('kana-to-romaji')
  })
})

describe('time based patterns', () => {
  it('flags correct but slow kana against the median', () => {
    const fast = ['あ', 'い', 'う', 'え'].map(k => entry(k, 5, 0, { totalMs: 6000, count: 5 }))
    const s = stats(...fast, entry('ぬ', 5, 0, { totalMs: 25000, count: 5 }))
    const p = detectPatterns(s, [], 'all').find(x => x.kind === 'slow')!
    expect(p.kana).toEqual(['ぬ'])
  })

  it('flags slipping kana from recent errors in the log', () => {
    const s = stats(entry('ね', 9, 1))
    const log: AnswerRecord[] = [
      { kana: 'ね', direction: 'kana-to-romaji', correct: false, given: 're', ms: 1000, t: NOW - DAY },
      { kana: 'ね', direction: 'kana-to-romaji', correct: false, given: 'wa', ms: 1000, t: NOW - 2 * DAY },
      { kana: 'ね', direction: 'kana-to-romaji', correct: false, given: 'wa', ms: 1000, t: NOW - 30 * DAY },
    ]
    expect(detectPatterns(s, log, 'all', NOW).some(x => x.kind === 'slipping')).toBe(true)
    expect(detectPatterns(s, log.slice(2), 'all', NOW).some(x => x.kind === 'slipping')).toBe(false)
  })
})

describe('blind spots', () => {
  it('suggests unseen lookalikes of missed kana', () => {
    const s = stats(entry('シ', 1, 2))
    const p = detectPatterns(s, [], 'all').find(x => x.kind === 'blind-spot')!
    expect(p.kana).toEqual(['シ', 'ツ'])
    expect(p.detail).toContain('シ vs ツ')
  })

  it('is not reported for a single round', () => {
    const s = stats(entry('シ', 1, 2))
    expect(detectPatterns(s, [], 'round').some(x => x.kind === 'blind-spot')).toBe(false)
  })
})

describe('statsFromLog', () => {
  it('rebuilds entries with confusions and directions', () => {
    const log: AnswerRecord[] = [
      { kana: 'ぬ', direction: 'kana-to-romaji', correct: false, given: 'me', ms: 2000, t: 1 },
      { kana: 'ぬ', direction: 'romaji-to-kana', correct: true, given: 'ぬ', ms: 1500, t: 2 },
      { kana: '???', direction: 'romaji-to-kana', correct: true, given: '', ms: 1, t: 3 },
    ]
    const s = statsFromLog(log)
    expect(Object.keys(s)).toEqual(['ぬ'])
    expect(s['ぬ']).toMatchObject({
      romaji: 'nu', correct: 1, incorrect: 1, totalMs: 3500, count: 2, streak: 1, lastSeen: 2, lastWrong: 1,
      confusions: { me: 1 },
      byDirection: { 'kana-to-romaji': { correct: 0, incorrect: 1 }, 'romaji-to-kana': { correct: 1, incorrect: 0 } },
    })
  })

  it('returns nothing for an empty map', () => {
    expect(detectPatterns({}, [], 'all')).toEqual([])
  })
})

describe('stroke patterns', () => {
  it('names the stroke that keeps getting redone', () => {
    const s = stats(entry('ふ', 2, 3, { strokeErrors: [0, 4, 1, 0] }), entry('あ', 3, 0, { strokeErrors: [1, 0, 0] }))
    const p = detectPatterns(s, [], 'all', NOW).find(x => x.kind === 'stroke')!
    expect(p.detail).toBe('stroke 2 of ふ (4× redone)')
    expect(p.kana).toEqual(['ふ'])
    expect(p.mode).toBe('draw')
  })

  it('adds up direction mistakes across kana', () => {
    const s = stats(
      entry('こ', 3, 1, { strokeFaults: { direction: 2 } }),
      entry('に', 3, 1, { strokeFaults: { direction: 1, shape: 4 } }),
    )
    const p = detectPatterns(s, [], 'all', NOW).find(x => x.kind === 'stroke-habit')!
    expect(p.title).toBe('Strokes drawn backwards')
    expect(p.kana.sort()).toEqual(['こ', 'に'].sort())
  })

  it('flags kana that are read but not written', () => {
    const s = stats(entry('ね', 4, 3, { byDirection: {
      'kana-to-romaji': { correct: 4, incorrect: 0 },
      draw: { correct: 0, incorrect: 3 },
    } }))
    const p = detectPatterns(s, [], 'all', NOW).find(x => x.title === 'Read but not written')!
    expect(p.kana).toEqual(['ね'])
    expect(p.mode).toBe('draw')
  })

  it('keeps drawing time out of the timing stats', () => {
    const s = statsFromLog([{ kana: 'あ', direction: 'draw', correct: true, given: '', ms: 9000, t: 1 }])
    expect(s['あ'].count).toBe(0)
    expect(s['あ'].byDirection.draw).toEqual({ correct: 1, incorrect: 0 })
  })
})
