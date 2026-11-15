import type { KanaPair } from '../types'
import { kanaInfo } from '../data/kana'
import { lookalikesOf } from '../data/lookalikes'

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Three wrong options for a choice question, hardest first: what the user
 * confused this kana with before, then lookalikes, then same row or vowel,
 * then anything from the same script.
 */
export function pickDistractors(pair: KanaPair, full: KanaPair[], preferred: string[], rng: () => number = Math.random): string[] {
  const sameScript = full.filter(p => p.script === pair.script && p.kana !== pair.kana)
  const available = new Set(sameScript.map(p => p.kana))
  const info = kanaInfo(pair.kana)

  const related = sameScript.filter(p => {
    const i = kanaInfo(p.kana)
    return i && info && (i.colId === info.colId || (i.vowel && i.vowel === info.vowel))
  }).map(p => p.kana)

  const tiers = [
    preferred,
    lookalikesOf(pair.kana),
    shuffle(related, rng),
    shuffle(sameScript.map(p => p.kana), rng),
    // tiny custom pools may not have three same-script kana
    shuffle(full.map(p => p.kana), rng),
  ]

  const picked: string[] = []
  for (const tier of tiers) {
    for (const k of tier) {
      if (picked.length === 3) return picked
      if (k === pair.kana || picked.includes(k)) continue
      if (tier !== tiers[4] && !available.has(k)) continue
      picked.push(k)
    }
  }
  return picked
}
