import type { KanjiReading, ReadingKind, ReadingPart } from '../types'
import { shuffle } from './distractors'
import { hasKanji, isAllKana, isRomajiSlip, kanaWays } from './kanaInput'

// Near misses of a reading, compared in kana. Two sides: `readingMistake` names the mistake
// in a wrong answer (KR22, KR33), `nearMisses` and `otherReadings` build wrong options for a
// reading question (KR17). They encode the rules separately; options and feedback agree
// because the options are sorted by kind through `readingMistake` itself. A typed reading is
// judged by `typedVerdict` with the same detector.

export type ReadingMistake =
  | { kind: Exclude<ReadingKind, 'other-reading'> }
  // `reading` is what was put in for `kanji`, `right` what it is in this word, `word` the
  // first course word that has the other reading
  | { kind: 'other-reading'; kanji: string; reading: string; right: string; word: string }

const VOWELS: Record<string, string> = {
  a: 'あかさたなはまやらわがざだばぱぁゃ',
  i: 'いきしちにひみりぎじぢびぴぃ',
  u: 'うくすつぬふむゆるぐずづぶぷぅゅ',
  e: 'えけせてねへめれげぜでべぺぇ',
  o: 'おこそとのほもよろをごぞどぼぽぉょ',
}

// the kana that hold a vowel long: おう and おお both hold an o, えい and ええ an e
const LONG: Record<string, string> = { a: 'あ', i: 'い', u: 'う', e: 'いえ', o: 'うお' }

const VOICED = 'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ'
// index aligned with VOICED, so はひふへほ is in here twice: once for ば, once for ぱ
const UNVOICED = 'かきくけこさしすせそたちつてとはひふへほはひふへほ'

// a small っ only doubles these consonants: k, s, t, p
const DOUBLES = 'かきくけこさしすせそたちつてとぱぴぷぺぽ'
const SMALL = 'ぁぃぅぇぉゃゅょっ'

function vowelOf(ch: string): string | null {
  for (const [v, row] of Object.entries(VOWELS)) if (row.includes(ch)) return v
  return null
}

// a vowel kana that only holds the vowel before it long
function holdsLong(s: string, i: number): boolean {
  if (i === 0) return false
  const v = vowelOf(s[i - 1])
  return !!v && LONG[v].includes(s[i])
}

const withoutLong = (s: string) => [...s].filter((_, i) => !holdsLong(s, i)).join('')
const unvoiced = (s: string) => [...s].map(ch => VOICED.includes(ch) ? UNVOICED[VOICED.indexOf(ch)] : ch).join('')

function nearMissKind(given: string, right: string): ReadingMistake | null {
  if (given === right) return null
  if (withoutLong(given) === withoutLong(right)) {
    if (given.length !== right.length) return { kind: 'long-vowel' }
    // same length: the long vowel is held with another kana, おう for おお
    const swapped = [...given].every((ch, i) => ch === right[i] || (holdsLong(given, i) && holdsLong(right, i)))
    if (swapped) return { kind: 'vowel-kana' }
  }
  if (given.replace(/っ/g, '') === right.replace(/っ/g, '')) return { kind: 'small-tsu' }
  if (given.length === right.length && unvoiced(given) === unvoiced(right)) return { kind: 'voicing' }
  return null
}

// every way to put another reading of one of the word's kanji in for its part of the word
function swappedReadings(split: ReadingPart[], readingsOf: (kanji: string) => KanjiReading[]) {
  const out: Array<{ reading: string; kanji: string; other: KanjiReading; right: string }> = []
  for (const [i, part] of split.entries()) {
    if ([...part.text].length !== 1) continue
    const before = split.slice(0, i).map(p => p.reading).join('')
    const after = split.slice(i + 1).map(p => p.reading).join('')
    for (const r of readingsOf(part.text)) {
      if (r.reading !== part.reading) out.push({ reading: before + r.reading + after, kanji: part.text, other: r, right: part.reading })
    }
  }
  return out
}

/**
 * What kind of mistake `given` is against the `right` reading of a word, null when it has no
 * name. The named near misses (vowel length, small っ, voicing, a long vowel held with the
 * wrong kana) go first, then another reading of one of the word's kanji put in for its part
 * of the word. `split` is the word's reading over its form, `readingsOf` gives the readings
 * of a kanji as the course words show them.
 */
export function readingMistake(
  given: string, right: string, split: ReadingPart[], readingsOf: (kanji: string) => KanjiReading[],
): ReadingMistake | null {
  const near = nearMissKind(given, right)
  if (near) return near
  const swap = swappedReadings(split, readingsOf).find(s => s.reading === given)
  return swap ? { kind: 'other-reading', kanji: swap.kanji, reading: swap.other.reading, right: swap.right, word: swap.other.word } : null
}

// A typed reading (R2) can go wrong in two ways that don't count as knowing it wrong:
// - slip: one keystroke off an accepted reading. The first slip on a card gets one more try
//   and counts nothing.
// - typo: a second slip on the card whose input still has letters left over after
//   conversion, visibly a typing accident. It counts as wrong but leaves the box alone, the
//   same meaning `typo` has for kana.
// A second slip that converts to clean kana is a plain miss, the box moves.
export type TypedVerdict =
  | { result: 'right'; kana: string }
  // a reading another word gives this spelling: not counted, the card asks again
  | { result: 'homograph'; kana: string }
  // kanji from a Japanese keyboard: not judged, the card asks for hiragana
  | { result: 'kanji' }
  | { result: 'slip' }
  // `given` is the kana when they are a known reading, else ''
  | { result: 'wrong'; kana: string; given: string; mistake: ReadingMistake | null; typo: boolean }

// readings this short have too many neighbours one key away for a slip to mean anything
const SHORT_READING = 2

/**
 * Judges a typed reading (KR20 to KR23), in this order: kanji in the input, an accepted
 * reading, a homograph, a named mistake against any accepted reading (only for kana a
 * reading could be), one keystroke off in romaji (`slipped` says one slip was let through
 * on this card already), anything else. An n the learner may have meant as ん is read both
 * ways, the better one counts. `isKnownReading` says whether kana are a reading somewhere;
 * those are a mix-up, never a slip, and the only thing stored as given.
 */
export function typedVerdict(
  typed: string,
  word: { reading: string; readings: string[]; homographs: string[]; split: ReadingPart[] },
  readingsOf: (kanji: string) => KanjiReading[], isKnownReading: (kana: string) => boolean, slipped: boolean,
): TypedVerdict {
  if (hasKanji(typed)) return { result: 'kanji' }
  const ways = kanaWays(typed)
  const right = ways.find(k => word.readings.includes(k))
  if (right) return { result: 'right', kana: right }
  const homograph = ways.find(k => word.homographs.includes(k))
  if (homograph) return { result: 'homograph', kana: homograph }

  for (const kana of ways.filter(looksLikeReading)) {
    for (const r of word.readings) {
      const mistake = readingMistake(kana, r, r === word.reading ? word.split : [], readingsOf)
      if (mistake) return { result: 'wrong', kana, given: isKnownReading(kana) ? kana : '', mistake, typo: false }
    }
  }

  const kana = ways.find(isKnownReading) ?? ways[0]
  const known = isKnownReading(kana)
  const clean = isAllKana(kana)
  const slipFrom = clean ? word.readings.filter(r => r.length > SHORT_READING) : word.readings
  const slip = !known && isRomajiSlip(typed, slipFrom)
  if (slip && !slipped) return { result: 'slip' }
  return { result: 'wrong', kana, given: known ? kana : '', mistake: null, typo: slip && !clean }
}

// near misses of a reading, the way the exam builds them
function nearMisses(s: string): string[] {
  const out: string[] = []
  const drop = (i: number) => out.push(s.slice(0, i) + s.slice(i + 1))
  const insert = (i: number, ch: string) => out.push(s.slice(0, i) + ch + s.slice(i))
  const swap = (i: number, ch: string) => out.push(s.slice(0, i) + ch + s.slice(i + 1))
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (holdsLong(s, i)) {
      drop(i)
      for (const other of LONG[vowelOf(s[i - 1])!]) if (other !== ch) swap(i, other)
    } else {
      const v = vowelOf(ch)
      // not inside a syllable like きょ, and not where the vowel is held long already
      const next = s[i + 1]
      if (v && !(next && SMALL.includes(next)) && !holdsLong(s, i + 1)) insert(i + 1, LONG[v][0])
    }
    if (ch === 'っ') drop(i)
    else if (i > 0 && DOUBLES.includes(ch) && !'っん'.includes(s[i - 1])) insert(i, 'っ')
    if (VOICED.includes(ch)) swap(i, UNVOICED[VOICED.indexOf(ch)])
    for (let j = 0; j < UNVOICED.length; j++) if (UNVOICED[j] === ch) swap(i, VOICED[j])
  }
  return out
}

const SMALL_Y = 'ゃゅょ'
// the kana a small ゃゅょ can follow
const Y_BASE = 'きしちにひみりぎじぢびぴ'
const PURE_VOWELS = 'あいうえお'

/**
 * Whether kana could be a reading at all: no small kana or ん up front, a small っ only
 * before a kana it can double (so not at the end, not twice), ゃゅょ only after an i kana,
 * and no vowel held three times (きゅうう). A bounced key gives kana like that.
 */
export function looksLikeReading(s: string): boolean {
  if (!s || SMALL.includes(s[0]) || s[0] === 'ん') return false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    const next = s[i + 1]
    if (ch === 'っ' && !(next && DOUBLES.includes(next))) return false
    if (SMALL_Y.includes(ch) && !Y_BASE.includes(s[i - 1])) return false
    if (i >= 2 && PURE_VOWELS.includes(ch) && ch === s[i - 1] && vowelOf(s[i - 2]) === vowelOf(ch)) return false
  }
  return true
}

/**
 * Three wrong readings for a reading question (KR17): near misses of the right one and the
 * word with another reading of one of its kanji, at most one of each kind while there are
 * enough kinds, another reading of a kanji first. Where that gives too few, readings from
 * `fill` make up the rest. Never one of the word's accepted readings, and never a reading
 * another word gives the same written form (`homographs`), both would be right.
 */
export function readingOptions(
  word: { reading: string; readings: string[]; homographs: string[]; split: ReadingPart[] },
  readingsOf: (kanji: string) => KanjiReading[], fill: string[], rng: () => number = Math.random,
): string[] {
  const taken = new Set([...word.readings, ...word.homographs])
  const usable: string[] = []
  for (const r of [...swappedReadings(word.split, readingsOf).map(s => s.reading), ...nearMisses(word.reading)]) {
    if (taken.has(r) || !looksLikeReading(r)) continue
    taken.add(r)
    usable.push(r)
  }

  const byKind = new Map<string, string[]>()
  for (const r of shuffle(usable, rng)) {
    const kind = readingMistake(r, word.reading, word.split, readingsOf)?.kind ?? 'none'
    byKind.set(kind, [...(byKind.get(kind) ?? []), r])
  }
  // another reading of the same kanji leads, the other kinds in random order
  const others = shuffle([...byKind.keys()].filter(k => k !== 'other-reading'), rng)
  const kinds = byKind.has('other-reading') ? ['other-reading', ...others] : others

  const picked: string[] = []
  // one of each kind per round, so three options show three different traps where possible
  while (picked.length < 3 && [...byKind.values()].some(list => list.length)) {
    for (const kind of kinds) {
      const next = byKind.get(kind)!.shift()
      if (next && picked.length < 3) picked.push(next)
    }
  }
  for (const r of fill) {
    if (picked.length === 3) break
    if (taken.has(r) || !looksLikeReading(r)) continue
    taken.add(r)
    picked.push(r)
  }
  return picked
}
