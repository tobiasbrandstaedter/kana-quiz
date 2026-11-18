import { describe, it, expect } from 'vitest'
import { buildBackup, parseBackup, kanaInBackup, restoreBackup } from './backup'

const STORED: Record<string, string> = {
  kana_stats_v3: JSON.stringify({ あ: { kana: 'あ', correct: 2 }, い: { kana: 'い', correct: 1 } }),
  kana_prefs: '{"mode":"draw"}',
  something_else: 'not ours',
}
const read = (key: string) => STORED[key] ?? null

describe('backup', () => {
  it('takes the app keys that exist and nothing else', () => {
    const b = buildBackup(read, 1000)
    expect(Object.keys(b.data).sort()).toEqual(['kana_prefs', 'kana_stats_v3'])
    expect(b.savedAt).toBe(1000)
  })

  it('survives a round trip through text', () => {
    const b = parseBackup(JSON.stringify(buildBackup(read, 1000)))
    expect(kanaInBackup(b)).toBe(2)
    expect(b.data.kana_prefs).toBe('{"mode":"draw"}')
  })

  it('says what is wrong with a file that is no backup', () => {
    expect(() => parseBackup('not json')).toThrow(/not valid JSON/)
    expect(() => parseBackup('{"hello":1}')).toThrow(/not a Kana Quiz backup/)
    expect(() => parseBackup(JSON.stringify({ app: 'kana-quiz', version: 2, data: {} }))).toThrow(/version 2/)
    expect(() => parseBackup(JSON.stringify({ app: 'kana-quiz', version: 1, data: { kana_prefs: '{}' } }))).toThrow(/no progress/)
  })

  it('drops keys the app does not know', () => {
    const b = parseBackup(JSON.stringify({ app: 'kana-quiz', version: 1, savedAt: 5, data: { ...STORED } }))
    expect(b.data.something_else).toBeUndefined()
  })

  it('replaces what is stored, removing what the backup lacks', () => {
    const store: Record<string, string> = { kana_days_v1: '{"2026-01-01":3}', kana_prefs: '{"mode":"mixed"}' }
    restoreBackup(buildBackup(read, 1000), {
      setItem: (k, v) => { store[k] = v },
      removeItem: k => { delete store[k] },
    })
    expect(store.kana_prefs).toBe('{"mode":"draw"}')
    expect(store.kana_days_v1).toBeUndefined()
    expect(store.kana_stats_v3).toBe(STORED.kana_stats_v3)
  })
})
