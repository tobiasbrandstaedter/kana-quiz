// The one way into kanji content: merges the hand written course with the generated
// source facts. Components and composables read kanji data through here only.
import type {
  CourseGroupWord, CourseWord, KanjiEntry, KanjiReading, KanjiSetEntry, WordEntry, WordGroupEntry,
} from '../types'
import type { KanaStrokes } from './strokeGlyphs'
import { CLOSE_MEANINGS, KANJI_LOOKALIKES, KANJI_SETS, WORD_GROUPS } from './kanjiCourse'
import { DEFAULT_WORD_ID, GROUP_SOURCE, KANJI_SOURCE, WORD_SOURCE } from './kanjiSource'
import { KANJI_STROKES } from './kanjiStrokes'

export { KANJI_DATA_DATE, KANJI_SOURCES } from './kanjiSource'

export const wordId = (form: string, reading: string) => `w:${form}:${reading}`

const ORDER = KANJI_SETS.flatMap(s => s.kanji.map(k => k.kanji))
const POSITION = new Map(ORDER.map((k, i) => [k, i]))

/** The kanji of the form that comes last in the course, null when it has none. */
export function homeKanji(form: string): string | null {
  let home: string | null = null
  for (const ch of form)
    if (POSITION.has(ch) && (home === null || POSITION.get(ch)! > POSITION.get(home)!)) home = ch
  return home
}

function sourceWordId(ref: CourseWord | CourseGroupWord): string {
  const id = ref.reading ? wordId(ref.form, ref.reading) : DEFAULT_WORD_ID[`${ref.form}:${ref.jmdict}`]
  if (!id || !WORD_SOURCE[id])
    throw new Error(`kanjiSource.ts has no data for ${ref.form} (${ref.jmdict}), run node scripts/extract-kanji.mjs after changing kanjiCourse.ts`)
  return id
}

const setKanji = (form: string) => [...new Set([...form].filter(ch => ch in KANJI_SOURCE))]

const SETS: KanjiSetEntry[] = KANJI_SETS.map(s => ({ id: s.id, title: s.title, kanji: s.kanji.map(k => k.kanji) }))

const WORDS = new Map<string, WordEntry>()
// course words in course order, group members are not in here
const COURSE_WORDS: WordEntry[] = []
const KANJI = new Map<string, KanjiEntry>()

for (const set of KANJI_SETS) {
  for (const k of set.kanji) {
    const ids = k.words.map(w => {
      const id = sourceWordId(w)
      const entry: WordEntry = {
        ...WORD_SOURCE[id],
        id,
        gloss: w.gloss,
        why: w.why ?? null,
        meanings: w.meanings ?? {},
        kanji: setKanji(w.form),
        home: homeKanji(w.form)!,
        group: null,
      }
      WORDS.set(id, entry)
      COURSE_WORDS.push(entry)
      return id
    })
    const src = KANJI_SOURCE[k.kanji]
    KANJI.set(k.kanji, {
      id: `k:${k.kanji}`,
      kanji: k.kanji,
      keyword: k.keyword,
      meanings: src.meanings,
      strokeCount: src.strokes,
      parts: k.parts ?? [],
      hook: k.hook,
      set: set.id,
      order: POSITION.get(k.kanji)!,
      words: ids,
    })
  }
}

const COURSE_IDS = new Set(COURSE_WORDS.map(w => w.id))

const GROUPS: WordGroupEntry[] = WORD_GROUPS.map(g => {
  const src = GROUP_SOURCE[g.id]
  if (!src) throw new Error(`kanjiSource.ts has no group ${g.id}, run node scripts/extract-kanji.mjs after changing kanjiCourse.ts`)
  // a course word in the table (百 in the hundreds) stays a course word: home and gloss
  // from the course, practiced as a course word and not again as a member
  const add = (id: string) => {
    if (WORDS.has(id)) return
    const s = WORD_SOURCE[id]
    WORDS.set(id, {
      ...s, id, gloss: s.glosses[0] ?? '', why: null, meanings: {},
      kanji: setKanji(s.form), home: g.counter, group: g.id,
    })
  }
  src.members.forEach(m => add(m.word))
  if (src.question) add(src.question)
  // KR75: all of them, or the irregular ones plus one regular member so the pattern is
  // practiced too. Groups practiced in full carry no marks.
  const isCourseWord = (id: string) => COURSE_IDS.has(id)
  const firstRegular = g.practice === 'irregular' ? src.members.find(m => !m.irregular && !isCourseWord(m.word))?.word : undefined
  return {
    id: g.id,
    title: g.title,
    counter: g.counter,
    practice: g.practice,
    members: src.members.map(m => ({
      ...m,
      practiced: !isCourseWord(m.word) && (g.practice === 'all' || m.irregular || m.word === firstRegular),
    })),
    question: src.question,
  }
})

export const kanjiSets = (): KanjiSetEntry[] => SETS

/** Every kanji of the course, in learning order. */
export const allKanji = (): KanjiEntry[] => ORDER.map(k => KANJI.get(k)!)

export const kanjiEntry = (kanji: string): KanjiEntry | null => KANJI.get(kanji) ?? null

/** The entries of the kanji the course has, in the order given, the rest left out. */
export function courseEntries(kanji: string[]): KanjiEntry[] {
  return kanji.map(kanjiEntry).filter((entry): entry is KanjiEntry => !!entry)
}

/** Course words and group members. */
export const wordById = (id: string): WordEntry | null => WORDS.get(id) ?? null

/** The words this kanji owns, first word first. */
export function ownWords(kanji: string): WordEntry[] {
  return KANJI.get(kanji)?.words.map(id => WORDS.get(id)!) ?? []
}

/** Every course word (no group members), in course order: by home kanji, then teaching order. */
export const courseWords = (): WordEntry[] => COURSE_WORDS

/** Other practiced words, group words included, written the same way (KR78): a card that shows the form has to tell them apart. */
export function sameForm(word: WordEntry): WordEntry[] {
  return PRACTICED.filter(w => w.form === word.form && w.id !== word.id)
}

/** Kanji of the course that have this reading in one of their words, in course order. */
export function kanjiWithReading(reading: string): string[] {
  return BY_READING.get(reading) ?? []
}

/** Course words (not group members) that contain the kanji, in course order. */
export function wordsWith(kanji: string): WordEntry[] {
  return COURSE_WORDS.filter(w => w.kanji.includes(kanji))
}

/** The readings of a kanji as its words and practiced group words show them, each with the first word that has it (KD4). */
export function kanjiReadings(kanji: string): KanjiReading[] {
  const out: KanjiReading[] = []
  // course words first, then the group words that get practiced (三 read みっ is only in 三つ and 三日)
  const practiced = GROUPS.flatMap(groupPractice).filter(w => w.kanji.includes(kanji))
  for (const w of [...wordsWith(kanji), ...practiced]) {
    for (const p of w.split) {
      if (p.text !== kanji || out.some(r => r.reading === p.reading)) continue
      out.push(p.kind ? { reading: p.reading, kind: p.kind, word: w.id } : { reading: p.reading, word: w.id })
    }
  }
  return out
}

/** Every kanji that shares a lookalike group with this one. */
export function kanjiLookalikes(kanji: string): string[] {
  const others = KANJI_LOOKALIKES.filter(g => g.kanji.includes(kanji)).flatMap(g => g.kanji)
  return [...new Set(others)].filter(k => k !== kanji)
}

export function kanjiLookalikeHint(a: string, b: string): string | null {
  return KANJI_LOOKALIKES.find(g => g.kanji.includes(a) && g.kanji.includes(b))?.hint ?? null
}

/** Keywords or glosses too close to offer against each other (KR15, KR72). */
export function tooClose(a: string, b: string): boolean {
  return CLOSE_MEANINGS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

export const wordGroups = (): WordGroupEntry[] => GROUPS

/** The group whose counter, and so home kanji, this kanji is. */
export const groupOf = (kanji: string): WordGroupEntry | null => GROUPS.find(g => g.counter === kanji) ?? null

export const groupById = (id: string): WordGroupEntry | null => GROUPS.find(g => g.id === id) ?? null

/** The words of a group that are practiced (KR75), in table order with the question word last. */
export function groupPractice(g: WordGroupEntry): WordEntry[] {
  return [...g.members.filter(m => m.practiced).map(m => m.word), ...(g.question ? [g.question] : [])].map(id => WORDS.get(id)!)
}

/** Every word a kanji is home of that gets practiced: its own words, then the practiced words of its group. */
export function homeWords(kanji: string): WordEntry[] {
  const group = groupOf(kanji)
  return [...ownWords(kanji), ...(group ? groupPractice(group) : [])]
}

// every word that gets practiced, in course order
const PRACTICED = ORDER.flatMap(homeWords)

// reading -> the kanji that have it, in course order. The course is static, so once
const BY_READING = new Map<string, string[]>()
for (const k of ORDER) {
  for (const { reading } of kanjiReadings(k)) BY_READING.set(reading, [...(BY_READING.get(reading) ?? []), k])
}

/** Course words and practiced group words, by home kanji: the pool for wrong options and known readings. */
export const practicedWords = (): WordEntry[] => PRACTICED

/** Strokes in the shape kanaStrokes returns, for StrokeDemo and StrokeCanvas. */
export function kanjiStrokes(kanji: string): KanaStrokes | null {
  const data = KANJI_STROKES[kanji]
  if (!data) return null
  return { width: 109, strokes: data.paths.map((d, i) => ({ d, dx: 0, number: data.numbers[i] })) }
}
