import { allPairs } from '../data/kana'

// Hepburn is what the data shows. These are the Kunrei / Nihon-shiki spellings
// and typing habits we accept as correct so they don't pollute the error stats.
const BY_ROMAJI: Record<string, string[]> = {
  shi: ['si'],
  chi: ['ti'],
  tsu: ['tu'],
  fu:  ['hu'],
  ji:  ['zi'],
  n:   ['nn'],
  sha: ['sya'], shu: ['syu'], sho: ['syo'],
  cha: ['tya'], chu: ['tyu'], cho: ['tyo'],
  ja:  ['zya', 'jya'], ju: ['zyu', 'jyu'], jo: ['zyo', 'jyo'],
}

// ぢ and づ share their Hepburn form with じ and ず, so their alternates are keyed by kana
const BY_KANA: Record<string, string[]> = {
  'ぢ': ['di', 'dji'], 'ヂ': ['di', 'dji'],
  'づ': ['du', 'dzu'], 'ヅ': ['du', 'dzu'],
}

export function normalizeRomaji(typed: string): string {
  return typed.trim().toLowerCase()
}

/** Hepburn form first, then every accepted alternate spelling. */
export function acceptedRomaji(kana: string, romaji: string): string[] {
  return [romaji, ...(BY_KANA[kana] ?? BY_ROMAJI[romaji] ?? [])]
}

export function matchesRomaji(typed: string, kana: string, romaji: string): boolean {
  return acceptedRomaji(kana, romaji).includes(normalizeRomaji(typed))
}

let validRomaji: Set<string> | null = null

function isValidRomaji(s: string): boolean {
  if (!validRomaji) {
    validRomaji = new Set()
    for (const p of allPairs()) for (const r of acceptedRomaji(p.kana, p.romaji)) validRomaji.add(r)
  }
  return validRomaji.has(s)
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/**
 * One edit away from an accepted spelling and not itself the reading of some
 * other kana. 'kk' for き is a typo, 'ka' for き is a real mistake.
 */
export function isTypo(typed: string, kana: string, romaji: string): boolean {
  const t = normalizeRomaji(typed)
  if (!t || isValidRomaji(t)) return false
  return acceptedRomaji(kana, romaji).some(r => editDistance(t, r) <= 1)
}
