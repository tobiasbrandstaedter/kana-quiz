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
 * then anything from the same script. Row, vowel and random fill come from
 * `known` kana first, so a beginner isn't shown kana they never met.
 * Lookalikes don't wait for that, telling them apart is the point.
 * A kana with the same romaji (ぢ for じ, カ for か) is never offered,
 * it would be a second right answer.
 */
export function pickDistractors(pair: KanaPair, full: KanaPair[], preferred: string[], rng: () => number = Math.random, known?: Set<string>): string[] {
  const others = full.filter(p => p.romaji !== pair.romaji)
  const sameScript = others.filter(p => p.script === pair.script)
  const available = new Set(sameScript.map(p => p.kana))
  const info = kanaInfo(pair.kana)

  const related = sameScript.filter(p => {
    const i = kanaInfo(p.kana)
    return i && info && (i.colId === info.colId || (i.vowel && i.vowel === info.vowel))
  }).map(p => p.kana)

  const isKnown = (k: string) => !known || known.has(k)
  const relatedMix = shuffle(related, rng)
  const scriptMix = shuffle(sameScript.map(p => p.kana), rng)
  // tiny custom pools may not have three same-script kana
  const anyKana = shuffle(others.map(p => p.kana), rng)

  const tiers = [
    preferred,
    lookalikesOf(pair.kana),
    relatedMix.filter(isKnown),
    scriptMix.filter(isKnown),
    relatedMix,
    scriptMix,
  ]

  const picked: string[] = []
  const add = (k: string) => {
    if (picked.length < 3 && k !== pair.kana && !picked.includes(k)) picked.push(k)
  }
  for (const tier of tiers)
    for (const k of tier) if (available.has(k)) add(k)
  for (const k of anyKana) add(k)
  return picked
}
