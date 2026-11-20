import { describe, it, expect } from 'vitest'
import type { KanjiAnswerRecord, KanjiStatEntry, KanjiStatsMap } from '../types'
import { detectKanjiPatterns, jaPieces, kanjiStatsFromLog, patternCards } from './kanjiPatterns'
import type { KanjiPattern, PatternCourse, Piece } from './kanjiPatterns'
import { newKanjiEntry } from './kanjiStats'
import { seeded } from './seeded'
import { DAY, NOW } from './kanjiFixtures'

// A made up course: kanji A to F in two sets, A and B look alike, words written with the letters
const SETS: Record<string, { id: string; title: string }> = { s1: { id: 's1', title: 'First set' }, s2: { id: 's2', title: 'Second set' } }
const SET_OF: Record<string, string> = { A: 's1', B: 's1', C: 's1', D: 's2', E: 's2', F: 's2' }
const WORDS: Record<string, string> = { 'w:a': 'A', 'w:ab': 'AB', 'w:ac': 'AC', 'w:c': 'C', 'w:d': 'D', 'w:e': 'E', 'w:f': 'F' }
const HOME: Record<string, string> = { 'w:a': 'A', 'w:ab': 'B', 'w:ac': 'C', 'w:c': 'C', 'w:d': 'D', 'w:e': 'E', 'w:f': 'F' }
const letter = (id: string) => id.startsWith('k:') && SET_OF[id.slice(2)] ? id.slice(2) : null

const COURSE: PatternCourse = {
  text: id => letter(id) ?? WORDS[id] ?? null,
  setOf: id => SETS[SET_OF[letter(id) ?? HOME[id]]] ?? null,
  lookalikes: id => id === 'k:A' ? ['k:B'] : id === 'k:B' ? ['k:A'] : [],
  hint: (a, b) => [a, b].sort().join() === 'k:A,k:B' ? 'ゑ has a tail, A does not' : null,
  wordsWith: id => Object.keys(WORDS).filter(w => WORDS[w].includes(letter(id) ?? '-')),
  swap: (id, form) => {
    const right = WORDS[id]
    if (!right || right.length !== form.length) return null
    const at = [...right].findIndex((ch, i) => ch !== form[i])
    if (at < 0 || right.slice(at + 1) !== form.slice(at + 1) || !SET_OF[form[at]]) return null
    return [`k:${right[at]}`, `k:${form[at]}`]
  },
}

const entry = (id: string, correct: number, incorrect: number, patch: Partial<KanjiStatEntry> = {}): KanjiStatEntry =>
  ({ ...newKanjiEntry(id), correct, incorrect, lastSeen: NOW - DAY, ...patch })
const statsOf = (...entries: KanjiStatEntry[]): KanjiStatsMap => Object.fromEntries(entries.map(e => [e.id, e]))
const text = (pieces: Piece[]) => pieces.map(p => p.text).join('')
const detect = (stats: KanjiStatsMap, scope: 'round' | 'all' = 'all', log: KanjiAnswerRecord[] = []) =>
  detectKanjiPatterns(stats, log, scope, COURSE, NOW)
const ofKind = (patterns: KanjiPattern[], kind: KanjiPattern['kind']) => patterns.filter(p => p.kind === kind)

describe('confused kanji (KR37)', () => {
  it('merges both ways and gives the lookalike hint with its Japanese marked', () => {
    const s = statsOf(entry('k:A', 3, 1, { confusions: { 'k:B': 1 } }), entry('k:B', 3, 1, { confusions: { 'k:A': 1 } }))
    const [p] = ofKind(detect(s), 'confusion')
    expect(p.title).toEqual([{ text: 'A', ja: true }, { text: ' vs ' }, { text: 'B', ja: true }])
    expect(text(p.detail)).toBe('Mixed up 2×. ゑ has a tail, A does not')
    expect(p.detail).toContainEqual({ text: 'ゑ', ja: true })
    expect(p.mode).toBe('recognize')
    expect(p.practice).toEqual(['k:A', 'k:B'])
  })

  it('needs two mix-ups over everything but one in a round', () => {
    const s = statsOf(entry('k:C', 2, 1, { confusions: { 'k:D': 1 } }))
    expect(ofKind(detect(s), 'confusion')).toEqual([])
    const [p] = ofKind(detect(s, 'round'), 'confusion')
    expect(text(p.detail)).toBe('Mixed up 1×')
  })

  it('counts a wrong written form as the kanji swapped in it, and practices the lookalike group too', () => {
    const s = statsOf(entry('w:ac', 1, 2, { confusions: { AD: 2, 'w:c': 3, AB: 1 } }), entry('k:C', 2, 0))
    const found = ofKind(detect(s), 'confusion')
    expect(found.map(p => text(p.title))).toEqual(['C vs D'])
    // a word id picked for a meaning is no kanji mix-up
    expect(found[0].practice).toEqual(['k:C', 'k:D'])
    const round = ofKind(detect(s, 'round'), 'confusion').find(p => text(p.title) === 'B vs C')!
    expect(round.practice).toEqual(['k:B', 'k:C', 'k:A'])
  })

  it('ignores answers on a meaning question that were not kanji', () => {
    const s = statsOf(entry('k:A', 1, 3, { confusions: { 'w:a': 3 } }))
    expect(ofKind(detect(s), 'confusion')).toEqual([])
  })
})

describe('reading habits (KR38)', () => {
  it('counts a kind over all words and names the words', () => {
    const s = statsOf(
      entry('w:a', 2, 2, { mistakes: { 'long-vowel': 2 } }),
      entry('w:c', 3, 1, { mistakes: { 'long-vowel': 1 } }),
      entry('w:d', 3, 1, { mistakes: { voicing: 1 } }),
    )
    const found = ofKind(detect(s), 'reading-habit')
    expect(found).toHaveLength(1)
    expect(text(found[0].title)).toBe('Long vowels')
    expect(text(found[0].detail)).toBe('A vowel held too long or too short. 3× so far, in 2 words.')
    expect(found[0].chips).toEqual(['A', 'C'])
    expect(found[0].practice).toEqual(['w:a', 'w:c'])
    expect(found[0].mode).toBe('read-choice')
  })

  it('is about one word, not a habit, when only one word has it', () => {
    const s = statsOf(entry('w:a', 1, 5, { mistakes: { 'small-tsu': 5 } }))
    expect(ofKind(detect(s), 'reading-habit')).toEqual([])
  })

  it('never makes a habit of another reading of a kanji', () => {
    const s = statsOf(entry('w:a', 1, 3, { mistakes: { 'other-reading': 3 } }), entry('w:c', 1, 3, { mistakes: { 'other-reading': 3 } }))
    expect(ofKind(detect(s), 'reading-habit')).toEqual([])
  })

  it('marks the small tsu in the title as Japanese', () => {
    const s = statsOf(entry('w:a', 1, 2, { mistakes: { 'small-tsu': 2 } }), entry('w:c', 1, 1, { mistakes: { 'small-tsu': 1 } }))
    const [p] = ofKind(detect(s), 'reading-habit')
    expect(p.title).toEqual([{ text: 'Small ' }, { text: 'っ', ja: true }])
  })

  it('reads one round from the log, mistakes included', () => {
    const at = (t: number, id: string, mistake?: KanjiAnswerRecord['mistake']): KanjiAnswerRecord =>
      ({ id, type: 'read-choice', correct: !mistake, given: mistake ? 'x' : '', ms: 1500, t, ...(mistake ? { mistake } : {}) })
    const log = [at(NOW, 'w:a', 'voicing'), at(NOW + 1, 'w:c', 'voicing'), at(NOW + 2, 'w:d')]
    const [p] = ofKind(detectKanjiPatterns(kanjiStatsFromLog(log), log, 'round', COURSE, NOW), 'reading-habit')
    expect(text(p.detail)).toBe('A sound voiced or unvoiced where the word has it the other way. 2× this round, in 2 words.')
  })
})

describe('meaning known, reading weak (KR39)', () => {
  const weakWord = (id: string) => entry(id, 1, 3, { byType: { 'read-choice': { correct: 1, incorrect: 2 }, 'read-type': { correct: 0, incorrect: 1 } } })

  it('names a mastered kanji whose words are not read right and practices those words', () => {
    // three of four reading answers on the one word wrong, the other word read right once: 2 of 5 over the kanji
    const s = statsOf(entry('k:A', 6, 0, { box: 3 }), weakWord('w:a'), entry('w:ab', 1, 0, { byType: { 'read-choice': { correct: 1, incorrect: 0 } } }))
    const [p] = ofKind(detect(s), 'reading-gap')
    expect(text(p.title)).toBe('Meaning sits, reading not yet')
    expect(p.detail).toEqual([
      { text: 'You know what ' }, { text: 'A', ja: true }, { text: ' means, but its words are not read right yet' },
    ])
    expect(p.practice).toEqual(['w:a'])
    expect(p.mode).toBe('read-choice')
  })

  it('also takes a kanji answered well by meaning, and stays quiet while the meaning is shaky', () => {
    const known = { byType: { meaning: { correct: 2, incorrect: 0 }, recognize: { correct: 1, incorrect: 0 } } }
    expect(ofKind(detect(statsOf(entry('k:C', 3, 0, known), weakWord('w:c'))), 'reading-gap')).toHaveLength(1)
    const shaky = { byType: { meaning: { correct: 2, incorrect: 2 } } }
    expect(ofKind(detect(statsOf(entry('k:C', 2, 2, shaky), weakWord('w:c'))), 'reading-gap')).toEqual([])
  })

  it('needs enough reading answers', () => {
    const one = entry('w:a', 0, 1, { byType: { 'read-choice': { correct: 0, incorrect: 1 } } })
    expect(ofKind(detect(statsOf(entry('k:A', 6, 0, { box: 3 }), one)), 'reading-gap')).toEqual([])
  })
})

describe('weak set (KR40)', () => {
  const good = ['k:D', 'k:E', 'k:F', 'w:d', 'w:e', 'w:f'].map(id => entry(id, 5, 0))

  it('flags a set clearly worse than the rest, kanji and words together', () => {
    const s = statsOf(...good, entry('k:A', 1, 2), entry('w:ab', 1, 2), entry('k:C', 2, 1))
    const [p] = ofKind(detect(s), 'weak-set')
    expect(text(p.title)).toBe('Weak set: First set')
    expect(text(p.detail)).toBe('5 of 9 wrong (44%), overall 87%')
    expect(p.practice).toEqual(['k:A', 'w:ab', 'k:C'])
    expect(p.mode).toBeUndefined()
  })

  it('does not call one bad item a weak set', () => {
    const s = statsOf(...good, entry('k:A', 2, 4), entry('k:B', 5, 0))
    expect(ofKind(detect(s), 'weak-set')).toEqual([])
  })

  it('stays quiet when everything is equally bad', () => {
    const s = statsOf(entry('k:A', 1, 2), entry('k:B', 1, 2), entry('k:D', 1, 2), entry('k:E', 1, 2))
    expect(ofKind(detect(s), 'weak-set')).toEqual([])
  })
})

describe('slipping (KR41)', () => {
  const miss = (id: string, t: number): KanjiAnswerRecord => ({ id, type: 'meaning', correct: false, given: '', ms: 1000, t })

  it('finds an item usually right and missed this week, over everything only', () => {
    const s = statsOf(entry('k:A', 8, 1), entry('w:d', 8, 1), entry('k:B', 2, 1))
    const log = [miss('k:A', NOW - DAY), miss('w:d', NOW - 10 * DAY), miss('k:B', NOW - DAY)]
    const [p] = ofKind(detect(s, 'all', log), 'slipping')
    expect(p.practice).toEqual(['k:A'])
    expect(text(p.detail)).toBe('Usually right, but missed again this week')
    expect(ofKind(detect(s, 'round', log), 'slipping')).toEqual([])
  })
})

describe('detectKanjiPatterns', () => {
  it('leaves out items the course does not have and puts the most useful first, six at most', () => {
    const s = statsOf(
      entry('k:Z', 1, 5, { confusions: { 'k:A': 5 } }),
      entry('k:A', 3, 3, { confusions: { 'k:B': 3 } }),
      entry('k:C', 3, 2, { confusions: { 'k:D': 2 } }),
      entry('k:E', 9, 1),
      entry('w:a', 2, 2, { mistakes: { 'long-vowel': 2, voicing: 1, 'small-tsu': 1, 'vowel-kana': 1 } }),
      entry('w:c', 2, 2, { mistakes: { 'long-vowel': 2, voicing: 2, 'small-tsu': 2, 'vowel-kana': 2 } }),
    )
    const found = detect(s, 'all', [{ id: 'k:E', type: 'meaning', correct: false, given: '', ms: 1, t: NOW }])
    expect(found).toHaveLength(6)
    expect(found.flatMap(p => p.practice)).not.toContain('k:Z')
    expect(text(found[0].title)).toBe('A vs B')
    expect(found.map(p => p.severity)).toEqual([...found.map(p => p.severity)].sort((a, b) => b - a))
  })

  it('has nothing to say without answers', () => {
    expect(detect({})).toEqual([])
  })
})

describe('kanjiStatsFromLog', () => {
  it('counts per type with confusions and mistakes, the box stays where it was', () => {
    const log: KanjiAnswerRecord[] = [
      { id: 'k:A', type: 'meaning', correct: true, given: 'k:A', ms: 1000, t: NOW },
      { id: 'k:A', type: 'recognize', correct: false, given: 'k:B', ms: 1000, t: NOW + 1 },
      { id: 'w:a', type: 'read-choice', correct: false, given: 'x', ms: 1000, t: NOW + 2, mistake: 'small-tsu' },
    ]
    const s = kanjiStatsFromLog(log)
    expect(s['k:A']).toMatchObject({ correct: 1, incorrect: 1, box: 0, confusions: { 'k:B': 1 } })
    expect(s['w:a'].mistakes).toEqual({ 'small-tsu': 1 })
  })
})

describe('patternCards', () => {
  const pattern = (practice: string[], mode?: KanjiPattern['mode']): KanjiPattern =>
    ({ kind: 'weak-set', title: [], detail: [], chips: [], severity: 1, practice, ...(mode ? { mode } : {}) })

  it('asks the items met so far twice each, never one right after itself', () => {
    const s = statsOf(entry('k:A', 1, 0), entry('k:B', 1, 0), entry('w:a', 1, 0))
    const cards = patternCards(pattern(['k:A', 'k:B', 'w:a', 'k:F']), s, seeded(3))
    expect(cards.map(c => c.id).sort()).toEqual(['k:A', 'k:A', 'k:B', 'k:B', 'w:a', 'w:a'])
    expect(cards.every((c, i) => i === 0 || c.id !== cards[i - 1].id)).toBe(true)
    expect(cards.every(c => c.type === undefined)).toBe(true)
  })

  it('asks each item once when twice would make the session long, or come back to back', () => {
    const ids = ['k:A', 'k:B', 'k:C', 'k:D', 'k:E', 'k:F', 'w:a', 'w:c', 'w:d']
    const cards = patternCards(pattern(ids), statsOf(...ids.map(id => entry(id, 1, 0))), seeded(1))
    expect(cards).toHaveLength(9)
    expect(patternCards(pattern(['k:A']), statsOf(entry('k:A', 1, 0)), seeded(1))).toEqual([{ id: 'k:A' }])
  })

  it('fixes the type the pattern is about, by the box as its mode does', () => {
    const s = statsOf(entry('w:a', 1, 0, { box: 1 }), entry('w:c', 3, 0, { box: 2 }), entry('k:A', 1, 0), entry('k:B', 1, 0))
    const reading = patternCards(pattern(['w:a', 'w:c'], 'read-choice'), s, seeded(2))
    expect(reading.filter(c => c.id === 'w:a').map(c => c.type)).toEqual(['read-choice', 'read-choice'])
    expect(reading.filter(c => c.id === 'w:c').map(c => c.type)).toEqual(['read-type', 'read-type'])
    const tellApart = patternCards(pattern(['k:A', 'k:B'], 'recognize'), s, seeded(2))
    expect(tellApart.every(c => c.type === 'recognize')).toBe(true)
  })
})

describe('jaPieces', () => {
  it('marks runs of kanji and kana, the English stays as it is', () => {
    expect(jaPieces('ゑ has a tail, ゐ・ヰ do not')).toEqual([
      { text: 'ゑ', ja: true }, { text: ' has a tail, ' }, { text: 'ゐ・ヰ', ja: true }, { text: ' do not' },
    ])
    expect(jaPieces('plain')).toEqual([{ text: 'plain' }])
  })
})
