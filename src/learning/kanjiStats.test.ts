import { describe, it, expect } from 'vitest'
import { applyKanjiAnswer, confusedKanji, newKanjiEntry, normalizeKanjiStats } from './kanjiStats'
import type { KanjiAnswerInput } from '../types'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

const answer = (patch: Partial<KanjiAnswerInput> = {}): KanjiAnswerInput =>
  ({ id: 'k:A', type: 'meaning', correct: true, given: 'k:A', ms: 2000, ...patch })

describe('applyKanjiAnswer', () => {
  it('starts a new entry and promotes a new item, it is due right away', () => {
    const e = applyKanjiAnswer(undefined, answer(), NOW)
    expect(e).toMatchObject({ id: 'k:A', correct: 1, incorrect: 0, streak: 1, box: 1, lastSeen: NOW, totalMs: 2000, count: 1 })
    expect(e.byType).toEqual({ meaning: { correct: 1, incorrect: 0 } })
    expect(e.due).toBe(NOW + DAY)
  })

  it('counts per question type', () => {
    let e = applyKanjiAnswer(undefined, answer(), NOW)
    e = applyKanjiAnswer(e, answer({ type: 'recognize', correct: false, given: 'k:B' }), NOW + 1)
    expect(e.byType).toEqual({ meaning: { correct: 1, incorrect: 0 }, recognize: { correct: 0, incorrect: 1 } })
  })

  it('sends a miss back to box 0 and stores what was picked', () => {
    const before = { ...newKanjiEntry('k:A'), correct: 4, box: 3, due: NOW + 5 * DAY, streak: 4 }
    const e = applyKanjiAnswer(before, answer({ correct: false, given: 'k:B' }), NOW)
    expect(e).toMatchObject({ box: 0, due: NOW, streak: 0, lastWrong: NOW, incorrect: 1 })
    expect(e.confusions).toEqual({ 'k:B': 1 })
  })

  it('counts a wrong reading by its kind', () => {
    // made up kana, not readings of real words
    const miss = (given: string, mistake: 'long-vowel' | 'voicing') =>
      answer({ id: 'w:a', type: 'read-choice', correct: false, given, mistake })
    let e = applyKanjiAnswer(undefined, miss('かこ', 'long-vowel'), NOW)
    e = applyKanjiAnswer(e, miss('かこ', 'long-vowel'), NOW + 1)
    e = applyKanjiAnswer(e, miss('がこう', 'voicing'), NOW + 2)
    expect(e.mistakes).toEqual({ 'long-vowel': 2, voicing: 1 })
    expect(e.confusions).toEqual({ 'かこ': 2, 'がこう': 1 })
  })

  it('stores no confusion for "Don\'t know"', () => {
    const e = applyKanjiAnswer(undefined, answer({ correct: false, given: '' }), NOW)
    expect(e.incorrect).toBe(1)
    expect(e.confusions).toEqual({})
  })

  it('only promotes an item that was due', () => {
    const before = { ...newKanjiEntry('k:A'), correct: 1, box: 1, due: NOW + DAY }
    expect(applyKanjiAnswer(before, answer(), NOW)).toMatchObject({ box: 1, due: NOW + DAY, correct: 2 })
  })

  it('holds the box on a re-ask after a miss in the same session', () => {
    const before = { ...newKanjiEntry('k:A'), incorrect: 1, box: 0, due: NOW }
    const e = applyKanjiAnswer(before, answer({ holdBox: true }), NOW)
    expect(e).toMatchObject({ box: 0, due: NOW, correct: 1 })
  })

  it('counts a typo as wrong and leaves the box alone', () => {
    const before = { ...newKanjiEntry('w:a'), correct: 3, box: 3, due: NOW, streak: 3 }
    const e = applyKanjiAnswer(before, answer({ id: 'w:a', type: 'read-type', correct: false, given: '', typo: true }), NOW)
    expect(e).toMatchObject({ box: 3, due: NOW, incorrect: 1, streak: 0, lastWrong: NOW })
    expect(e.byType['read-type']).toEqual({ correct: 0, incorrect: 1 })
  })

  it('leaves the old entry alone', () => {
    const before = newKanjiEntry('k:A')
    applyKanjiAnswer(before, answer({ correct: false, given: 'k:B' }), NOW)
    expect(before).toEqual(newKanjiEntry('k:A'))
  })

  it('keeps answers without a useful time out of the timing', () => {
    expect(applyKanjiAnswer(undefined, answer({ ms: 0 }), NOW)).toMatchObject({ totalMs: 0, count: 0 })
    expect(applyKanjiAnswer(undefined, answer({ ms: 60_000 }), NOW)).toMatchObject({ totalMs: 0, count: 0 })
  })
})

describe('normalizeKanjiStats', () => {
  it('fills missing fields and drops what is not an entry', () => {
    const out = normalizeKanjiStats({ 'k:A': { correct: 2, box: 1 }, 'k:B': 'nonsense' })
    expect(out).toEqual({ 'k:A': { ...newKanjiEntry('k:A'), correct: 2, box: 1 } })
    expect(normalizeKanjiStats(null)).toEqual({})
    // an entry stored before words came has no mistakes field and gets an empty one
    expect(normalizeKanjiStats({ 'k:A': { correct: 1, confusions: {}, byType: {} } })['k:A'].mistakes).toEqual({})
  })
})

describe('confusedKanji', () => {
  it('gives the kanji picked instead, most often first, words left out', () => {
    const stat = { ...newKanjiEntry('k:A'), confusions: { 'k:B': 1, 'k:C': 3, 'w:x:y': 5 } }
    expect(confusedKanji(stat)).toEqual([{ kanji: 'C', n: 3 }, { kanji: 'B', n: 1 }])
    expect(confusedKanji(undefined)).toEqual([])
  })
})
