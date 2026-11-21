import { describe, it, expect } from 'vitest'
import { peekedAfter, recallAnswers, trimLog, writeCorrect, writePractice, writeQuizIds, writtenClean } from './kanjiWrite'
import type { WriteTabEvent } from './kanjiWrite'
import { newKanjiEntry } from './kanjiStats'
import { pickedKanjiIds } from './kanjiPlan'
import type { KanjiAnswerRecord, KanjiStatsMap } from '../types'

import { DAY, stat } from './kanjiFixtures'

// not the shared NOW: local noon, so a few hours either way stay on the same local day
const NOW = new Date(2027, 0, 13, 12).getTime()

const seen = (id: string) => stat(id, { correct: 1, box: 1 })
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

describe('trimLog', () => {
  const at = (t: number, type: 'write' | 'meaning') => record({ type, t })

  it('keeps everything while both kinds are under their cap', () => {
    const log = [at(1, 'meaning'), at(2, 'write'), at(3, 'meaning')]
    expect(trimLog(log, 5, 5)).toEqual(log)
  })

  it('trims each kind on its own and keeps the order', () => {
    const log = [at(1, 'meaning'), at(2, 'write'), at(3, 'write'), at(4, 'meaning'), at(5, 'write'), at(6, 'meaning')]
    expect(trimLog(log, 2, 1).map(r => r.t)).toEqual([4, 5, 6])
  })

  it('lets lots of writing push out no other answer', () => {
    const log = [at(0, 'meaning'), ...Array.from({ length: 50 }, (_, i) => at(i + 1, 'write'))]
    const out = trimLog(log, 1000, 10)
    expect(out[0].t).toBe(0)
    expect(out.filter(r => r.type === 'write').map(r => r.t)).toEqual(Array.from({ length: 10 }, (_, i) => i + 41))
  })
})

describe('writeCorrect', () => {
  it('counts a clean drawing only when the card was not left and resumed', () => {
    expect(writeCorrect(true, false)).toBe(true)
    expect(writeCorrect(true, true)).toBe(false)
    expect(writeCorrect(false, false)).toBe(false)
  })
})

describe('peekedAfter (the Writing tab, KR50)', () => {
  // run events from a start, as the tab does
  const run = (start: boolean, ...events: WriteTabEvent[]) => events.reduce(peekedAfter, start)

  it('counts a kanji picked while writing as unseen, picked in Watch or Trace as seen', () => {
    expect(run(true, { kind: 'pick', view: 'recall' })).toBe(false)
    expect(run(false, { kind: 'pick', view: 'watch' })).toBe(true)
    expect(run(false, { kind: 'pick', view: 'trace' })).toBe(true)
  })

  it('keeps what was when going to Write from another view, any other view shows the kanji', () => {
    expect(run(false, { kind: 'view', from: 'watch', to: 'recall' })).toBe(false)
    expect(run(true, { kind: 'view', from: 'trace', to: 'recall' })).toBe(true)
    expect(run(false, { kind: 'view', from: 'recall', to: 'watch' })).toBe(true)
    expect(run(false, { kind: 'view', from: 'recall', to: 'trace' })).toBe(true)
  })

  it('counts Write tapped again while writing as seen, the strokes so far were on screen', () => {
    expect(run(false, { kind: 'view', from: 'recall', to: 'recall' })).toBe(true)
  })

  it('counts everything after a finished drawing as seen', () => {
    expect(run(false, { kind: 'done' })).toBe(true)
    // picked in Write, written, then written again: only the first one was from memory
    expect(run(true, { kind: 'pick', view: 'recall' }, { kind: 'done' })).toBe(true)
  })
})
