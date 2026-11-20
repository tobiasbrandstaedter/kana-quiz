import { allPairs, katakanaToHiragana } from '../data/kana'
import { acceptedRomaji } from './romaji'

// Typed answers for readings: romaji (or kana from a Japanese keyboard) to hiragana. The
// romaji follows the kana spelling, so a long vowel is typed as it is written (ou, uu, ei),
// a doubled consonant gives っ, and every spelling romaji.ts accepts for a kana works here too.

// romaji -> hiragana, built from the kana table so there is one list of spellings. ん is
// left out, it depends on what follows. じ and ず come before ぢ and づ in the table, so
// ji and zu give the usual ones.
const SYLLABLES = new Map<string, string>()
for (const p of allPairs()) {
  if (p.script !== 'hiragana' || p.kana === 'ん') continue
  for (const r of acceptedRomaji(p.kana, p.romaji)) if (!SYLLABLES.has(r)) SYLLABLES.set(r, p.kana)
}
const LONGEST = Math.max(...[...SYLLABLES.keys()].map(r => r.length))

const VOWELS = 'aeiou'
const isLetter = (ch: string | undefined) => !!ch && ch >= 'a' && ch <= 'z'
const isConsonant = (ch: string | undefined) => isLetter(ch) && !VOWELS.includes(ch!)
// what an n can still join with to make a syllable: な, にゃ
const joinsN = (ch: string | undefined) => !!ch && (VOWELS.includes(ch) || ch === 'y')

/** True when there is nothing but hiragana in it, no letters left over. */
export const isAllKana = (s: string) => /^[ぁ-ゖ]+$/.test(s)

/** Whether a Japanese keyboard put kanji into the answer, which can't be judged as a reading. */
export const hasKanji = (typed: string) => /\p{Script=Han}/u.test(typed)

/**
 * What is left of an answer to judge: full width letters and half width kana made plain
 * (NFKC), lower case, the curly apostrophe as ', katakana as hiragana, and everything that
 * is no letter, apostrophe or kana dropped (spaces, the period of an iOS double space,
 * digits, an ö hit next to the p).
 */
export function cleanTyped(typed: string): string {
  const s = katakanaToHiragana(typed.normalize('NFKC').toLowerCase().replace(/’/g, "'"))
  return s.replace(/[^a-z'ぁ-ゖー]/g, '')
}

/**
 * Hiragana for what was typed. Letters that don't make a kana (yet) stay as typed. ん comes
 * from `n'`, `nn`, an n before a consonant or kana, an m before b, p or m, and a final n
 * (`trailingN` false keeps that one a letter for the preview).
 */
export function toKana(typed: string, { trailingN = true } = {}): string {
  const s = cleanTyped(typed)
  let out = ''
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    const next = s[i + 1]
    if (ch === 'n' && next === "'") {
      out += 'ん'
      i += 2
      continue
    }
    if (ch === 'n' && next === 'n') {
      // the second n stays for the syllable after it when it can make one: konnichi
      out += 'ん'
      i += joinsN(s[i + 2]) ? 1 : 2
      continue
    }
    if (ch === 'n' && next === undefined && !trailingN) {
      out += 'n'
      i++
      continue
    }
    const nIsN = ch === 'n' && (next === undefined || !joinsN(next))
    if (nIsN || (ch === 'm' && !!next && 'bpm'.includes(next))) {
      out += 'ん'
      i++
      continue
    }
    // a doubled consonant is a small っ, and so is the t of tch (Hepburn writes っち as tchi)
    if (isConsonant(ch) && (next === ch || (ch === 't' && next === 'c' && s[i + 2] === 'h'))) {
      out += 'っ'
      i++
      continue
    }
    let len = Math.min(LONGEST, s.length - i)
    while (len > 0 && !SYLLABLES.has(s.slice(i, i + len))) len--
    if (len > 0) {
      out += SYLLABLES.get(s.slice(i, i + len))
      i += len
    } else {
      out += ch
      i++
    }
  }
  return out
}

// a reading has one or two such spots at most, the cap keeps the slip check (thousands of
// conversions per answer) from blowing up on a long string of na na na
const MAX_N_SPOTS = 3

/**
 * The ways to read what was typed, the plain one first. Where an n could start a syllable
 * (な, にゃ) the learner may have meant ん without the apostrophe: kinyoubi, and nanyoubi with
 * one of each. Where nn comes before a vowel or y, the plain reading keeps the second n for
 * the syllable (konnichi), but nn can also be ん alone (kinnyoubi). Each such spot is read
 * both ways and every mix is given, for the first MAX_N_SPOTS spots.
 */
export function kanaWays(typed: string): string[] {
  const s = cleanTyped(typed)
  // where to put an apostrophe that makes ん: after a lone n, or in place of the second n of nn
  const spots: Array<{ at: number; drop: number }> = []
  for (let i = 1; i < s.length && spots.length < MAX_N_SPOTS; i++) {
    if (s[i] !== 'n' || s[i - 1] === 'n') continue
    if (s[i + 1] === 'n' && joinsN(s[i + 2])) spots.push({ at: i + 1, drop: 1 })
    else if (joinsN(s[i + 1])) spots.push({ at: i + 1, drop: 0 })
  }
  const ways = new Set<string>()
  for (let mask = 0; mask < 1 << spots.length; mask++) {
    // from the back, so the earlier spots stay where they are
    const marked = spots.reduceRight((t, { at, drop }, j) => mask & (1 << j) ? `${t.slice(0, at)}'${t.slice(at + drop)}` : t, s)
    ways.add(toKana(marked))
  }
  return [...ways]
}

/** The preview of what is being typed: runs of kana so far and of letters not kana yet. */
export function previewParts(typed: string): Array<{ text: string; pending: boolean }> {
  return toKana(typed, { trailingN: false }).split(/([^ぁ-ゖ]+)/).filter(Boolean)
    .map(text => ({ text, pending: !isAllKana(text) }))
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz'"

/**
 * Whether romaji is one keystroke off a spelling of one of `readings` (KR23): a letter
 * dropped, added or replaced, or two neighbours swapped. Measured on what was typed, not on
 * the kana it gives. Kana typed directly never count.
 */
export function isRomajiSlip(typed: string, readings: string[]): boolean {
  const t = cleanTyped(typed)
  if (!t || !/^[a-z']+$/.test(t)) return false
  const hits = (s: string) => kanaWays(s).some(k => readings.includes(k))
  if (hits(t)) return false
  // Listing every spelling of a reading would multiply out (si/shi, tu/tsu, n/nn ...), so
  // instead each string one edit away from the input is converted and looked up. That is
  // about 55 conversions per letter, times the ways kanaWays reads an n, which is why the
  // field is capped at 40 characters.
  for (let i = 0; i <= t.length; i++) {
    const head = t.slice(0, i)
    if (i < t.length && hits(head + t.slice(i + 1))) return true
    if (i < t.length - 1 && hits(head + t[i + 1] + t[i] + t.slice(i + 2))) return true
    for (const ch of ALPHABET) {
      if (hits(head + ch + t.slice(i))) return true
      if (i < t.length && ch !== t[i] && hits(head + ch + t.slice(i + 1))) return true
    }
  }
  return false
}
