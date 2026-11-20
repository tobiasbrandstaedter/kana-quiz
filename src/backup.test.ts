import { describe, it, expect } from 'vitest'
import { buildBackup, parseBackup, kanaInBackup, kanjiInBackup, restoreBackup } from './backup'

const STORED: Record<string, string> = {
  kana_stats_v3: JSON.stringify({ あ: { kana: 'あ', correct: 2 }, い: { kana: 'い', correct: 1 } }),
  kana_prefs: '{"mode":"draw"}',
  something_else: 'not ours',
}
const read = (key: string) => STORED[key] ?? null

const KANJI_STATS = JSON.stringify({ 'k:日': { id: 'k:日' }, 'k:月': { id: 'k:月' }, 'w:日本': { id: 'w:日本' } })

function memoryStore(initial: Record<string, string>) {
  const store = { ...initial }
  return {
    store,
    storage: {
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    },
  }
}

describe('backup', () => {
  it('takes the app keys that exist and nothing else', () => {
    const b = buildBackup(read, 1000)
    expect(Object.keys(b.data).sort()).toEqual(['kana_prefs', 'kana_stats_v3'])
    expect(b.savedAt).toBe(1000)
  })

  it('writes version 1 while there is nothing of kanji to carry', () => {
    expect(buildBackup(read, 1000).version).toBe(1)
  })

  it('writes version 2 once a kanji key has a value', () => {
    expect(buildBackup(key => ({ ...STORED, kanji_prefs: '{}' })[key] ?? null, 1000).version).toBe(2)
  })

  it('carries the kanji keys', () => {
    const b = buildBackup(key => ({ ...STORED, kanji_stats_v1: KANJI_STATS, kanji_prefs: '{}' })[key] ?? null, 1000)
    expect(b.version).toBe(2)
    expect(b.data.kanji_stats_v1).toBe(KANJI_STATS)
    expect(b.data.kanji_prefs).toBe('{}')
  })

  it('survives a round trip through text', () => {
    const b = parseBackup(JSON.stringify(buildBackup(read, 1000)))
    expect(kanaInBackup(b)).toBe(2)
    expect(kanjiInBackup(b)).toBe(0)
    expect(b.data.kana_prefs).toBe('{"mode":"draw"}')
  })

  it('counts kanji, not words', () => {
    const b = parseBackup(JSON.stringify({ app: 'kana-quiz', version: 2, data: { kanji_stats_v1: KANJI_STATS } }))
    expect(kanjiInBackup(b)).toBe(2)
  })

  it('reads a version 1 backup and keeps only kana keys from it', () => {
    const b = parseBackup(JSON.stringify({ app: 'kana-quiz', version: 1, data: { ...STORED, kanji_stats_v1: KANJI_STATS } }))
    expect(b.version).toBe(1)
    expect(kanaInBackup(b)).toBe(2)
    expect(b.data.kanji_stats_v1).toBeUndefined()
  })

  it('says what is wrong with a file that is no backup', () => {
    expect(() => parseBackup('not json')).toThrow(/not valid JSON/)
    expect(() => parseBackup('{"hello":1}')).toThrow(/not a Kana Quiz backup/)
    expect(() => parseBackup(JSON.stringify({ app: 'kana-quiz', version: 3, data: {} }))).toThrow(/version 3/)
    expect(() => parseBackup(JSON.stringify({ app: 'kana-quiz', version: 1, data: { kana_prefs: '{}' } }))).toThrow(/no progress/)
    expect(() => parseBackup(JSON.stringify({ app: 'kana-quiz', version: 2, data: { kanji_stats_v1: '{}' } }))).toThrow(/no progress/)
  })

  it('accepts kanji progress alone', () => {
    const b = parseBackup(JSON.stringify({ app: 'kana-quiz', version: 2, data: { kanji_stats_v1: KANJI_STATS } }))
    expect(kanaInBackup(b)).toBe(0)
    expect(kanjiInBackup(b)).toBe(2)
  })

  it('drops keys the app does not know', () => {
    const b = parseBackup(JSON.stringify({ app: 'kana-quiz', version: 1, savedAt: 5, data: { ...STORED } }))
    expect(b.data.something_else).toBeUndefined()
  })

  it('replaces what is stored, removing what the backup lacks', () => {
    const { store, storage } = memoryStore({ kana_days_v1: '{"2026-01-01":3}', kana_prefs: '{"mode":"mixed"}', kanji_prefs: '{}', kanji_answers_v1: '[]' })
    restoreBackup(buildBackup(key => ({ ...STORED, kanji_stats_v1: KANJI_STATS })[key] ?? null, 1000), storage)
    expect(store.kana_prefs).toBe('{"mode":"draw"}')
    expect(store.kana_days_v1).toBeUndefined()
    expect(store.kanji_prefs).toBeUndefined()
    expect(store.kanji_answers_v1).toBeUndefined()
    expect(store.kana_stats_v3).toBe(STORED.kana_stats_v3)
  })

  it('removes the old kana stats key, so a backup without kana stats keeps them gone', () => {
    const { store, storage } = memoryStore({ kana_stats_v2: STORED.kana_stats_v3, kana_stats_v3: STORED.kana_stats_v3 })
    const kanjiOnly = parseBackup(JSON.stringify({ app: 'kana-quiz', version: 2, data: { kanji_stats_v1: KANJI_STATS } }))
    restoreBackup(kanjiOnly, storage)
    expect(store.kana_stats_v2).toBeUndefined()
    expect(store.kana_stats_v3).toBeUndefined()
    expect(store.kanji_stats_v1).toBe(KANJI_STATS)
  })

  it('leaves kanji progress alone when restoring a version 1 backup', () => {
    const { store, storage } = memoryStore({ kanji_stats_v1: KANJI_STATS, kanji_answers_v1: '[]', kanji_prefs: '{}', kana_days_v1: '{}' })
    const v1 = parseBackup(JSON.stringify({ app: 'kana-quiz', version: 1, data: { ...STORED } }))
    restoreBackup(v1, storage)
    expect(store.kanji_stats_v1).toBe(KANJI_STATS)
    expect(store.kanji_answers_v1).toBe('[]')
    expect(store.kanji_prefs).toBe('{}')
    expect(store.kana_days_v1).toBeUndefined()
    expect(store.kana_stats_v3).toBe(STORED.kana_stats_v3)
  })
})
