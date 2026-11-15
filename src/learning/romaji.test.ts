import { describe, it, expect } from 'vitest'
import { acceptedRomaji, matchesRomaji, isTypo } from './romaji'

describe('matchesRomaji', () => {
  it('accepts the Hepburn form', () => {
    expect(matchesRomaji('shi', 'し', 'shi')).toBe(true)
    expect(matchesRomaji('ka', 'か', 'ka')).toBe(true)
  })

  it('accepts Kunrei spellings and typing habits', () => {
    expect(matchesRomaji('si', 'し', 'shi')).toBe(true)
    expect(matchesRomaji('tu', 'つ', 'tsu')).toBe(true)
    expect(matchesRomaji('hu', 'ふ', 'fu')).toBe(true)
    expect(matchesRomaji('nn', 'ん', 'n')).toBe(true)
    expect(matchesRomaji('zya', 'じゃ', 'ja')).toBe(true)
  })

  it('ignores case and surrounding whitespace', () => {
    expect(matchesRomaji('  SHI ', 'し', 'shi')).toBe(true)
  })

  it('keeps ぢ/づ apart from じ/ず', () => {
    expect(matchesRomaji('di', 'ぢ', 'ji')).toBe(true)
    expect(matchesRomaji('zi', 'ぢ', 'ji')).toBe(false)
    expect(matchesRomaji('zi', 'じ', 'ji')).toBe(true)
    expect(matchesRomaji('du', 'ヅ', 'zu')).toBe(true)
    expect(matchesRomaji('du', 'ず', 'zu')).toBe(false)
  })

  it('rejects wrong answers', () => {
    expect(matchesRomaji('me', 'ぬ', 'nu')).toBe(false)
    expect(matchesRomaji('', 'ぬ', 'nu')).toBe(false)
  })
})

describe('acceptedRomaji', () => {
  it('lists the Hepburn form first', () => {
    expect(acceptedRomaji('し', 'shi')).toEqual(['shi', 'si'])
    expect(acceptedRomaji('か', 'ka')).toEqual(['ka'])
  })
})

describe('isTypo', () => {
  it('treats one slip that is no real reading as a typo', () => {
    expect(isTypo('kk', 'き', 'ki')).toBe(true)
    expect(isTypo('sh', 'し', 'shi')).toBe(true)
    expect(isTypo('tsuu', 'つ', 'tsu')).toBe(true)
  })

  it('treats a valid reading of another kana as a real mistake', () => {
    expect(isTypo('ka', 'き', 'ki')).toBe(false)
    expect(isTypo('so', 'さ', 'sa')).toBe(false)
  })

  it('rejects far-off and empty input', () => {
    expect(isTypo('hello', 'き', 'ki')).toBe(false)
    expect(isTypo('', 'き', 'ki')).toBe(false)
  })
})
