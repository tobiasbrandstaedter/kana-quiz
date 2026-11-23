import { describe, it, expect } from 'vitest'
import { applyKanjiAnswer, confusedKanji, newKanjiEntry, normalizeKanjiLog, normalizeKanjiStats } from './kanjiStats'
import type { KanjiAnswerInput } from '../types'
import { EASE_MAX, EASE_MIN } from './scheduler'

import { DAY, NOW } from './kanjiFixtures'

const answer = (patch: Partial<KanjiAnswerInput> = {}): KanjiAnswerInput =>
  ({ id: 'k:A', type: 'meaning', correct: true, given: 'k:A', ms: 2000, ...patch })

describe('applyKanjiAnswer', () => {
  it('starts a new entry and promotes a new item, it is due right away', () => {
    const e = applyKanjiAnswer(undefined, answer(), NOW)
    expect(e).toMatchObject({ id: 'k:A', correct: 1, incorrect: 0, streak: 1, box: 1, lastSeen: NOW, totalMs: 2000, count: 1 })
    expect(e.byType).toEqual({ meaning: { correct: 1, incorrect: 0 } })
    expect(e.due).toBe(NOW + DAY)
  })

  it('moves a stored box 5 item on to 60 and then 120 days times its ease, no migration needed', () => {
    // written before the ease: it starts at 1 and goes up a little with every promotion
    const { 'k:A': stored } = normalizeKanjiStats({ 'k:A': { correct: 5, box: 5, due: NOW } })
    const six = applyKanjiAnswer(stored, answer(), NOW)
    expect(six).toMatchObject({ box: 6, due: NOW + 60 * 1.05 * DAY, ease: 1.05 })
    expect(applyKanjiAnswer(six, answer(), six.due)).toMatchObject({ box: 7, due: six.due + 120 * 1.1 * DAY })
  })

  it('counts per question type', () => {
    let e = applyKanjiAnswer(undefined, answer(), NOW)
    e = applyKanjiAnswer(e, answer({ type: 'recognize', correct: false, given: 'k:B' }), NOW + 1)
    expect(e.byType).toEqual({ meaning: { correct: 1, incorrect: 0 }, recognize: { correct: 0, incorrect: 1 } })
  })

  it('sends a miss back, a mastered item to box 1, lowers the ease and stores what was picked', () => {
    const before = { ...newKanjiEntry('k:A'), correct: 4, box: 3, due: NOW + 5 * DAY, streak: 4 }
    const e = applyKanjiAnswer(before, answer({ correct: false, given: 'k:B' }), NOW)
    expect(e).toMatchObject({ box: 1, due: NOW + DAY, streak: 0, lastWrong: NOW, incorrect: 1 })
    expect(e.ease).toBeCloseTo(0.8)
    expect(applyKanjiAnswer({ ...before, box: 2 }, answer({ correct: false }), NOW).box).toBe(0)
    expect(e.confusions).toEqual({ 'k:B': 1 })
  })

  it('lowers the ease once for a miss and its re-asks, again on a later day', () => {
    const before = { ...newKanjiEntry('k:A'), correct: 4, box: 3, due: NOW, ease: 1 }
    let e = applyKanjiAnswer(before, answer({ correct: false }), NOW)
    e = applyKanjiAnswer(e, answer({ correct: false }), NOW + 60_000)
    expect(e).toMatchObject({ box: 0 })
    expect(e.ease).toBeCloseTo(0.8)
    expect(applyKanjiAnswer(e, answer({ correct: false }), NOW + DAY).ease).toBeCloseTo(0.6)
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

describe('applyKanjiAnswer with a written kanji', () => {
  const write = (patch: Partial<KanjiAnswerInput> = {}) =>
    answer({ type: 'write', given: '', strokes: { errors: [0, 2, 1], faults: { order: 1, shape: 2 } }, ...patch })
  const known = { ...newKanjiEntry('k:A'), correct: 4, incorrect: 1, streak: 2, box: 3, due: NOW, lastSeen: NOW - DAY, lastWrong: NOW - 9 * DAY, totalMs: 9000, count: 5 }

  it('counts it under write with the stroke tallies, and moves no box either way', () => {
    const wrong = applyKanjiAnswer(known, write({ correct: false }), NOW)
    expect(wrong).toEqual({
      ...known, byType: { write: { correct: 0, incorrect: 1 } }, strokeErrors: [0, 2, 1], strokeFaults: { order: 1, shape: 2 },
    })
    const right = applyKanjiAnswer(wrong, write({ strokes: { errors: [1, 0, 0, 3], faults: { direction: 1 } } }), NOW)
    expect(right).toMatchObject({ box: 3, due: NOW, correct: 4, incorrect: 1, streak: 2 })
    expect(right.byType.write).toEqual({ correct: 1, incorrect: 1 })
    expect(right.strokeErrors).toEqual([1, 2, 1, 3])
    expect(right.strokeFaults).toEqual({ order: 1, shape: 2, direction: 1 })
  })

  it('leaves the old entry alone', () => {
    const before = { ...known, strokeErrors: [1], strokeFaults: { order: 1 } }
    applyKanjiAnswer(before, write({ correct: false }), NOW)
    expect(before.strokeErrors).toEqual([1])
    expect(before.strokeFaults).toEqual({ order: 1 })
    expect(before.byType).toEqual({})
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

  it('keeps only k: and w: ids, so a stray key or __proto__ never becomes an entry', () => {
    const raw = JSON.parse('{"x":{},"__proto__":{"correct":5},"k:A":{"correct":1},"w:x:y":{"correct":2},"g:x":{}}')
    const out = normalizeKanjiStats(raw)
    expect(Object.keys(out)).toEqual(['k:A', 'w:x:y'])
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype)
    expect((out as Record<string, unknown>).correct).toBeUndefined()
    expect(normalizeKanjiStats([{ correct: 1 }])).toEqual({})
  })

  it('sets nested fields of the wrong shape back, so readers and writes never throw', () => {
    const raw = JSON.parse(`{"k:A":{"confusions":null,"strokeErrors":null,"byType":{"meaning":null,"recognize":{"correct":"2"}},
      "mistakes":[1],"strokeFaults":{"shape":"x","order":2},"correct":"3","incorrect":null,"box":99,"due":"soon","streak":1e999}}`)
    const e = normalizeKanjiStats(raw)['k:A']
    expect(e).toEqual({
      ...newKanjiEntry('k:A'), byType: { recognize: { correct: 0, incorrect: 0 } }, strokeFaults: { order: 2 }, box: 7,
    })
    expect(() => applyKanjiAnswer(e, answer({ correct: false, given: 'k:B' }), NOW)).not.toThrow()
    expect(() => applyKanjiAnswer(e, answer({ type: 'write', given: '', strokes: { errors: [1], faults: { shape: 1 } } }), NOW)).not.toThrow()
    expect(confusedKanji(e)).toEqual([])
  })

  it('keeps stroke errors as finite numbers at their index, and the box a whole number in range', () => {
    const e = normalizeKanjiStats({ 'k:A': { strokeErrors: [1, 'x', null, 2], box: -3 }, 'k:B': { box: 1.5 } })
    expect(e['k:A'].strokeErrors).toEqual([1, 0, 0, 2])
    expect(e['k:A'].box).toBe(0)
    expect(e['k:B'].box).toBe(0)
  })

  it('keeps the ease in its bounds, an entry without one or with a broken one starts at 1', () => {
    const e = normalizeKanjiStats({ 'k:A': { ease: 1.3 }, 'k:B': { ease: 9 }, 'k:C': { ease: -1 }, 'k:D': { ease: 'x' }, 'k:E': {} })
    expect(Object.values(e).map(x => x.ease)).toEqual([1.3, EASE_MAX, EASE_MIN, 1, 1])
  })

  it('drops a __proto__ key inside the count maps', () => {
    const e = normalizeKanjiStats(JSON.parse('{"k:A":{"confusions":{"__proto__":3,"k:B":1}}}'))['k:A']
    expect(Object.keys(e.confusions)).toEqual(['k:B'])
    expect(Object.getPrototypeOf(e.confusions)).toBe(Object.prototype)
  })

  it('gives an entry stored before writing came empty stroke tallies, so a write needs no migration', () => {
    const stored = normalizeKanjiStats({ 'k:A': { correct: 1, confusions: {}, byType: { meaning: { correct: 1, incorrect: 0 } }, mistakes: {} } })['k:A']
    expect(stored).toMatchObject({ strokeErrors: [], strokeFaults: {} })
    const e = applyKanjiAnswer(stored, answer({ type: 'write', given: '', strokes: { errors: [2], faults: { shape: 2 } } }), NOW)
    expect(e).toMatchObject({ strokeErrors: [2], strokeFaults: { shape: 2 }, byType: { meaning: { correct: 1, incorrect: 0 }, write: { correct: 1, incorrect: 0 } } })
  })
})

describe('normalizeKanjiLog', () => {
  it('keeps records with a string id, a string type and a finite time', () => {
    const good = { id: 'k:A', type: 'meaning', correct: true, given: 'k:A', ms: 1, t: NOW }
    const raw = [null, 5, 'x', [], good, { ...good, id: 3 }, { ...good, type: null }, { ...good, t: 'now' }, { ...good, t: null }]
    expect(normalizeKanjiLog(raw)).toEqual([good])
    expect(normalizeKanjiLog(JSON.parse('[{"id":"k:A","type":"meaning","t":1e999}]'))).toEqual([])
    expect(normalizeKanjiLog({ 0: good })).toEqual([])
    expect(normalizeKanjiLog(null)).toEqual([])
  })
})

describe('confusedKanji', () => {
  it('gives the kanji picked instead, most often first, words left out', () => {
    const stat = { ...newKanjiEntry('k:A'), confusions: { 'k:B': 1, 'k:C': 3, 'w:x:y': 5 } }
    expect(confusedKanji(stat)).toEqual([{ kanji: 'C', n: 3 }, { kanji: 'B', n: 1 }])
    expect(confusedKanji(undefined)).toEqual([])
  })
})
