import { describe, it, expect } from 'vitest'
import { recallAnswers, writePractice, writeQuizIds, writtenClean } from './kanjiWrite'
import { newKanjiEntry } from './kanjiStats'
import { pickedKanjiIds } from './kanjiPlan'
import type { KanjiAnswerRecord, KanjiStatsMap } from '../types'

const DAY = 24 * 60 * 60 * 1000
// noon, so a few hours either way stay on the same local day
const NOW = new Date(2027, 0, 13, 12).getTime()

const seen = (id: string) => ({ ...newKanjiEntry(id), correct: 1, box: 1 })
const record = (patch: Partial<KanjiAnswerRecord>): KanjiAnswerRecord =>
  ({ id: 'k:A', type: 'write', correct: true, given: '', ms: 0, t: NOW, ...patch })

describe('writeQuizIds', () => {
  it('takes the kanji of the picked sets the learner has been introduced to, nothing else', () => {
    const sets = [
      { id: 's1', title: 'one', kanji: ['A', 'B', 'C'] },
      { id: 's2', title: 'two', kanji: ['D', 'E'] },
    ]
    const stats: KanjiStatsMap = { 'k:B': seen('k:B'), 'k:C': newKanjiEntry('k:C'), 'k:D': seen('k:D') }
    expect(writeQuizIds(pickedKanjiIds(sets, new Set(['s1'])), stats)).toEqual(['k:B'])
    expect(writeQuizIds(pickedKanjiIds(sets, new Set(['s1', 's2'])), stats)).toEqual(['k:B', 'k:D'])
    // picked sets with nothing met: the quiz has nothing to ask
    expect(writeQuizIds(pickedKanjiIds(sets, new Set(['s2'])), {})).toEqual([])
  })

  it('counts a kanji met only through a written answer as not introduced', () => {
    const written = { ...newKanjiEntry('k:A'), byType: { write: { correct: 1, incorrect: 0 } } }
    expect(writeQuizIds(['k:A'], { 'k:A': written })).toEqual([])
  })
})

describe('writePractice', () => {
  const stat = seen('k:A')

  it('stores nothing for a kanji not in practice yet, whatever else holds', () => {
    expect(writePractice(undefined, [], 'k:A', false, NOW)).toBe('new')
    expect(writePractice(newKanjiEntry('k:A'), [], 'k:A', true, NOW)).toBe('new')
  })

  it('stores nothing when the kanji was on screen since it was picked', () => {
    expect(writePractice(stat, [], 'k:A', true, NOW)).toBe('peeked')
  })

  it('stores one write per kanji and day from the tab', () => {
    expect(writePractice(stat, [], 'k:A', false, NOW)).toBe('save')
    expect(writePractice(stat, [record({ t: NOW - 2 * 60 * 60 * 1000 })], 'k:A', false, NOW)).toBe('repeat')
    // yesterday, another kanji, a quiz write (it has a time) or another type don't count
    expect(writePractice(stat, [
      record({ t: NOW - DAY }),
      record({ id: 'k:B' }),
      record({ ms: 4200 }),
      record({ type: 'meaning', ms: 0 }),
    ], 'k:A', false, NOW)).toBe('save')
  })
})

describe('recallAnswers', () => {
  it('drops the written answers and keeps the order of the rest', () => {
    const log = [record({ type: 'meaning' }), record({ correct: false }), record({ id: 'w:x:y', type: 'read-choice', correct: false })]
    expect(recallAnswers(log)).toEqual([log[0], log[2]])
  })
})

describe('writtenClean', () => {
  it('is true once a write was right', () => {
    expect(writtenClean(undefined)).toBe(false)
    expect(writtenClean({ ...seen('k:A'), byType: { write: { correct: 0, incorrect: 2 } } })).toBe(false)
    expect(writtenClean({ ...seen('k:A'), byType: { write: { correct: 1, incorrect: 2 } } })).toBe(true)
  })
})
