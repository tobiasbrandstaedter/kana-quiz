import { describe, it, expect } from 'vitest'
import { kanjiRow, openKanjiErrors, sortKanjiRows } from './kanjiProgress'
import { newKanjiEntry } from './kanjiStats'
import { columnProgress, MASTERED_BOX } from './scheduler'
import type { KanjiAnswerRecord, KanjiEntry, KanjiRow, KanjiStatEntry, KanjiStatsMap } from '../types'

// letters stand in for kanji, nothing here is course content
const IDS = ['A', 'B', 'C', 'D', 'E', 'F'].map(k => `k:${k}`)

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

const stat = (id: string, patch: Partial<KanjiStatEntry>): KanjiStatEntry => ({ ...newKanjiEntry(id), ...patch })
const statsOf = (...stats: KanjiStatEntry[]): KanjiStatsMap => Object.fromEntries(stats.map(e => [e.id, e]))
const miss = (id: string, t = NOW): KanjiAnswerRecord => ({ id, type: 'meaning', correct: false, given: '', ms: 1000, t })

describe('columnProgress over a kanji set', () => {
  it('counts seen, mastered and due kanji of the set', () => {
    const s = statsOf(
      stat('k:A', { correct: 2, box: MASTERED_BOX, due: NOW + 5 * DAY }),
      stat('k:B', { correct: 1, box: 1, due: NOW - DAY }),
      stat('k:D', { correct: 1, box: 2, due: NOW - DAY }),
    )
    expect(columnProgress(['k:A', 'k:B', 'k:C'], s, NOW)).toEqual({ total: 3, seen: 2, mastered: 1, due: 1 })
  })
})

describe('openKanjiErrors', () => {
  it('keeps missed kanji that are not mastered and not resolved since', () => {
    const s = statsOf(
      stat('k:A', { incorrect: 1, lastWrong: NOW, box: 0 }),
      stat('k:B', { incorrect: 1, lastWrong: NOW - DAY, box: MASTERED_BOX }),
      stat('k:C', { incorrect: 2, lastWrong: NOW - DAY, resolvedAt: NOW }),
      stat('k:D', { correct: 3, box: 2 }),
      // missed again after it was resolved
      stat('k:E', { incorrect: 2, lastWrong: NOW, resolvedAt: NOW - DAY, box: 1 }),
    )
    expect(openKanjiErrors(s, [], IDS).map(e => e.id)).toEqual(['k:E', 'k:A'])
  })

  it('puts recent misses first and leaves out ids not asked for', () => {
    const s = statsOf(
      stat('k:A', { incorrect: 5, lastWrong: NOW }),
      stat('k:B', { incorrect: 1, lastWrong: NOW }),
      stat('w:word', { incorrect: 9, lastWrong: NOW }),
    )
    const log = [miss('k:B'), miss('k:B')]
    expect(openKanjiErrors(s, log, IDS).map(e => e.id)).toEqual(['k:B', 'k:A'])
  })
})

describe('kanjiRow', () => {
  it('takes the kanji, keyword and position from the course and the numbers from the stats', () => {
    const entry: KanjiEntry = { id: 'k:A', kanji: 'A', keyword: 'aa', meanings: ['aa'], strokeCount: 1, parts: [], hook: '', set: 's1', order: 4, words: [] }
    expect(kanjiRow(entry, stat('k:A', { correct: 3, incorrect: 1, box: 2, due: NOW }))).toEqual({
      id: 'k:A', kanji: 'A', keyword: 'aa', order: 4, correct: 3, incorrect: 1, acc: 75, box: 2, due: NOW,
    })
  })
})

describe('sortKanjiRows', () => {
  const row = (kanji: string, order: number, patch: Partial<KanjiRow> = {}): KanjiRow => ({
    id: `k:${kanji}`, kanji, keyword: kanji.toLowerCase(), order, correct: 1, incorrect: 0, acc: 100, box: 1, due: 0, ...patch,
  })
  const ROWS = [
    row('C', 2, { acc: 50, incorrect: 1, box: 0, due: 5 }),
    row('A', 0, { acc: 100, box: 3, due: 9 }),
    row('B', 1, { acc: 50, incorrect: 3, box: 0, due: 2 }),
  ]
  const kanji = (rows: KanjiRow[]) => rows.map(r => r.kanji).join('')

  it('keeps course order without a pick', () => {
    expect(kanji(sortKanjiRows(ROWS, null))).toBe('ABC')
    expect(kanji(sortKanjiRows(ROWS, { col: 'kanji', dir: 'desc' }))).toBe('CBA')
  })

  it('sorts by accuracy, ties in course order', () => {
    expect(kanji(sortKanjiRows(ROWS, { col: 'acc', dir: 'asc' }))).toBe('BCA')
    expect(kanji(sortKanjiRows(ROWS, { col: 'acc', dir: 'desc' }))).toBe('ABC')
  })

  it('sorts by errors and by stage, the stage by box and then by due date', () => {
    expect(kanji(sortKanjiRows(ROWS, { col: 'errors', dir: 'desc' }))).toBe('BCA')
    expect(kanji(sortKanjiRows(ROWS, { col: 'box', dir: 'asc' }))).toBe('BCA')
  })

  it('leaves the rows it was given alone', () => {
    sortKanjiRows(ROWS, { col: 'acc', dir: 'asc' })
    expect(kanji(ROWS)).toBe('CAB')
  })
})
