import { describe, it, expect } from 'vitest'
import { normalizeStats } from './statsMigration'

describe('normalizeStats', () => {
  it('fills the v3 fields on a v2 entry', () => {
    const v2 = { 'あ': { kana: 'あ', romaji: 'a', script: 'hiragana', correct: 3, incorrect: 1, totalMs: 4000, count: 4 } }
    const out = normalizeStats(v2)
    expect(out['あ']).toEqual({
      kana: 'あ', romaji: 'a', script: 'hiragana', correct: 3, incorrect: 1, totalMs: 4000, count: 4,
      lastSeen: 0, lastWrong: 0, streak: 0, confusions: {}, byDirection: {}, box: 1, due: 0,
      strokeErrors: [], strokeFaults: {},
    })
  })

  it('derives a starting box from the track record', () => {
    const e = (correct: number, incorrect: number) => ({ kana: 'あ', romaji: 'a', script: 'hiragana', correct, incorrect })
    expect(normalizeStats({ 'あ': e(9, 1) })['あ'].box).toBe(2)
    expect(normalizeStats({ 'あ': e(3, 1) })['あ'].box).toBe(1)
    expect(normalizeStats({ 'あ': e(1, 1) })['あ'].box).toBe(0)
    expect(normalizeStats({ 'あ': e(4, 0) })['あ'].box).toBe(1)
  })

  it('refreshes romaji from the kana table', () => {
    const v2 = { 'ぢ': { kana: 'ぢ', romaji: 'di', script: 'hiragana', correct: 0, incorrect: 2, totalMs: 0, count: 0 } }
    expect(normalizeStats(v2)['ぢ'].romaji).toBe('ji')
  })

  it('keeps v3 fields as they are', () => {
    const v3 = { 'ぬ': {
      kana: 'ぬ', romaji: 'nu', script: 'hiragana', correct: 1, incorrect: 2, totalMs: 0, count: 0,
      lastSeen: 10, lastWrong: 9, streak: 1, confusions: { me: 2 }, byDirection: { 'kana-to-romaji': { correct: 1, incorrect: 2 } },
      box: 3, due: 12345, strokeErrors: [0, 2], strokeFaults: { order: 1, shape: 1 },
    } }
    expect(normalizeStats(v3)).toEqual(v3)
  })

  it('drops garbage and handles missing storage', () => {
    expect(normalizeStats(null)).toEqual({})
    expect(normalizeStats('nope')).toEqual({})
    expect(normalizeStats({ x: 5, y: { romaji: 'a' } })).toEqual({})
  })
})
