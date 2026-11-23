import { describe, it, expect } from 'vitest'
import { itemRow, openKanjiErrors, readsWord, sortKanjiRows } from './kanjiProgress'
import { MASTERED_BOX } from './scheduler'
import { DAY, IDS as ALL_IDS, NOW, stat, statsOf } from './kanjiFixtures'
import type { ItemInfo, KanjiAnswerRecord, KanjiRow } from '../types'

// letters stand in for kanji, nothing here is course content
const IDS = ALL_IDS.slice(0, 6)
const miss = (id: string, t = NOW): KanjiAnswerRecord => ({ id, type: 'meaning', correct: false, given: '', ms: 1000, t })

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

describe('readsWord', () => {
  it('needs a typed reading that was right and a word that has not fallen back since', () => {
    const typed = { 'read-type': { correct: 1, incorrect: 0 } }
    expect(readsWord(stat('w:a', { box: 2, byType: typed }))).toBe(true)
    expect(readsWord(stat('w:a', { box: 1, byType: typed }))).toBe(false)
    expect(readsWord(stat('w:a', { box: 4, byType: { 'read-choice': { correct: 3, incorrect: 0 } } }))).toBe(false)
  })
})

describe('itemRow', () => {
  it('keeps the item and its place and takes the numbers from the stats', () => {
    const item: ItemInfo = { id: 'w:AB:かか', kind: 'word', text: 'AB', meaning: 'ab', reading: 'かか', home: 'A' }
    expect(itemRow(item, 4.01, stat(item.id, { correct: 3, incorrect: 1, box: 2, due: NOW }))).toEqual({
      item, order: 4.01, correct: 3, incorrect: 1, acc: 75, box: 2, due: NOW,
    })
  })
})

describe('sortKanjiRows', () => {
  const row = (kanji: string, order: number, patch: Partial<KanjiRow> = {}): KanjiRow => ({
    item: { id: `k:${kanji}`, kind: 'kanji', text: kanji, meaning: kanji.toLowerCase(), reading: '', home: kanji }, order,
    correct: 1, incorrect: 0, acc: 100, box: 1, due: 0, ...patch,
  })
  const ROWS = [
    row('C', 2, { acc: 50, incorrect: 1, box: 0, due: 5 }),
    row('A', 0, { acc: 100, box: 3, due: 9 }),
    row('B', 1, { acc: 50, incorrect: 3, box: 0, due: 2 }),
  ]
  const kanji = (rows: KanjiRow[]) => rows.map(r => r.item.text).join('')

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
