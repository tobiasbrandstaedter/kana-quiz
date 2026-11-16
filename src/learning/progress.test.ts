import { describe, it, expect } from 'vitest'
import type { StatsMap } from '../types'
import { dayKey, streak, fluencyLimits, DEFAULT_LIMITS } from './progress'
import { newEntry } from './statsMigration'
import { pairFor } from '../data/kana'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date(2026, 10, 16, 15, 0).getTime()

function days(...offsets: number[]): Record<string, number> {
  return Object.fromEntries(offsets.map(o => [dayKey(NOW - o * DAY), 5]))
}

describe('streak', () => {
  it('counts days in a row up to today', () => {
    expect(streak(days(0, 1, 2), NOW)).toBe(3)
  })

  it('keeps the streak from yesterday alive before the first answer today', () => {
    expect(streak(days(1, 2), NOW)).toBe(2)
  })

  it('is broken by a missed day', () => {
    expect(streak(days(0, 2, 3), NOW)).toBe(1)
    expect(streak(days(2, 3), NOW)).toBe(0)
  })
})

describe('fluencyLimits', () => {
  function timed(avgMs: number[]): StatsMap {
    const kana = ['あ', 'い', 'う', 'え', 'お', 'か', 'き']
    return Object.fromEntries(avgMs.map((ms, i) => [kana[i], { ...newEntry(pairFor(kana[i])!), count: 4, totalMs: ms * 4 }]))
  }

  it('uses the defaults until five kana have timings', () => {
    expect(fluencyLimits(timed([1000, 1000, 1000, 1000]))).toEqual(DEFAULT_LIMITS)
  })

  it('scales with the median pace, typing gets a little extra', () => {
    expect(fluencyLimits(timed([1000, 1200, 1600, 2000, 5000]))).toEqual({ choice: 2400, type: 2900 })
  })

  it('stays within sane bounds', () => {
    expect(fluencyLimits(timed([300, 300, 300, 300, 300]))).toEqual({ choice: 1800, type: 2300 })
    expect(fluencyLimits(timed([9000, 9000, 9000, 9000, 9000]))).toEqual({ choice: 6000, type: 7000 })
  })
})
