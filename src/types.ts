export interface KanaColumn {
  id: string
  label: string
  sample: string
  kana: string[]
  romaji: string[]
}

export type KanaGroupName = 'main' | 'dakuten' | 'combo'
export type KanaData = Record<KanaGroupName, KanaColumn[]>

export type ScriptName = 'hiragana' | 'katakana'
export type ActiveScript = 'hiragana' | 'katakana' | 'both'
// 'listen' is a draw question prompted by audio instead of romaji
export type QuizMode = 'kana-to-romaji' | 'romaji-to-kana' | 'draw' | 'listen' | 'mixed'
export type QuizDirection = 'kana-to-romaji' | 'romaji-to-kana' | 'draw'
export type InputType = 'type' | 'choice' | 'intro' | 'draw'
export type AppScreen = 'setup' | 'quiz' | 'results'
export type SetupTab = 'practice' | 'strokes' | 'progress'
export type StatsSortCol = 'kana' | 'acc' | 'seen' | 'errors' | 'time' | 'box'
export interface StatsSort { col: StatsSortCol; dir: 'asc' | 'desc' }
export type FeedbackType = 'correct' | 'wrong' | ''
export type AccClass = 'good' | 'ok' | 'bad'
export type TimeClass = 'fast' | 'ok' | 'slow' | ''

export interface KanaPair {
  kana: string
  romaji: string
  script: ScriptName
}

export interface QuizQuestion {
  direction: QuizDirection
  inputType: InputType
  question: string
  answer: string
  kana: string
  romaji: string
  script: ScriptName
  options: string[]
  listen?: boolean  // prompt is the sound, the romaji shows only after answering
  reask?: boolean   // missed earlier in this session
}

export interface DirectionStat {
  correct: number
  incorrect: number
}

export interface StatEntry {
  kana: string
  romaji: string
  script: ScriptName
  correct: number
  incorrect: number
  totalMs: number
  count: number
  lastSeen: number   // ms epoch, 0 = never
  lastWrong: number  // ms epoch, 0 = never
  resolvedAt: number // ms epoch the user took it off the error list, 0 = never
  streak: number     // correct answers in a row
  // wrong answer given -> how often. Typed romaji or chosen kana.
  confusions: Record<string, number>
  byDirection: Partial<Record<QuizDirection, DirectionStat>>
  box: number  // Leitner box, see learning/scheduler.ts
  due: number  // ms epoch of the next review
  strokeErrors: number[]                         // rejected attempts per stroke index, draw mode
  strokeFaults: Partial<Record<StrokeFault, number>>
}

export type StatsMap = Record<string, StatEntry>

export interface AnswerInput {
  kana: string
  romaji: string
  script: ScriptName
  direction: QuizDirection
  correct: boolean
  given: string
  elapsedMs: number
  typo?: boolean     // counts as wrong, but leaves the Leitner box alone
  timeout?: boolean  // too slow in a timed session, same treatment as a typo
  holdBox?: boolean  // right after a miss in the same session: counts, but can't promote
  strokes?: StrokeTally  // draw answers only
}

// one line in the rolling answer log
export interface AnswerRecord {
  kana: string
  direction: QuizDirection
  correct: boolean
  given: string
  ms: number
  t: number
}

export interface StatRow extends StatEntry {
  seen: number
  acc: number
  accClass: AccClass
  avgTime: string | null
  timeClass: TimeClass
}

// one kana from KanjiVG, viewBox 0 0 109 109
export interface StrokeData {
  paths: string[]                     // svg path d, one per stroke, in writing order
  numbers: Array<[number, number]>    // where KanjiVG puts the stroke number
}

export interface Point { x: number; y: number }

// why a drawn stroke was rejected
export type StrokeFault = 'shape' | 'direction' | 'order'

export interface StrokeTally {
  errors: number[]  // rejects per stroke index
  faults: Partial<Record<StrokeFault, number>>
}

// what the drawing canvas hands back once every stroke is down
export interface DrawResult extends StrokeTally {
  correct: boolean
  ink: Array<Point[] | null>  // the accepted stroke per index, null where the app drew it after three misses
}

// --- kanji ---
// Ids: a kanji is `k:日`, a word is `w:` + form + `:` + shown reading (`w:一日:ついたち`),
// since two words can share a form.

// Hand written course, src/data/kanjiCourse.ts. It holds no readings, a word is pinned by
// its JMdict entry id.
export interface CourseWord {
  form: string
  jmdict: string                     // JMdict entry id, copied from the candidates file
  gloss: string                      // short meaning, out of the JMdict glosses
  why?: string                       // why the word is in although it is not in the N5 list (KR1)
  meanings?: Record<string, string>  // kanji -> its meaning in this word, out of the source meanings (KR13)
  // Only where one entry has several readings for the form and the default (the N5 list
  // reading, else the first one) is the wrong one, like 十 read とお. Copied from the
  // candidates file, the script stops when JMdict doesn't have it.
  reading?: string
}

export interface CourseKanji {
  kanji: string
  keyword: string
  parts?: string[]     // kanji of the set it is visibly built from (KR8)
  hook: string         // one line memory hook
  words: CourseWord[]  // in teaching order, the first one is its first word
}

export interface CourseSet {
  id: string
  title: string
  kanji: CourseKanji[]  // in learning order
}

// a group member or question word, no gloss of its own
export interface CourseGroupWord {
  form: string
  jmdict: string
  reading?: string  // same rule as CourseWord.reading
}

export interface CourseGroup {
  id: string
  title: string
  counter: string                  // the counter kanji, home kanji of the group
  members: CourseGroupWord[]       // in table order
  practice: 'all' | 'irregular'    // KR75
  question?: CourseGroupWord       // 何時, 何人
}

export interface KanjiLookalikeGroup {
  kanji: string[]
  hint: string
}

// Generated, src/data/kanjiSource.ts.

// one piece of a reading split over the form: a kanji, a kana run, or several kanji
// when the reading can't be split (今日 きょう)
export interface ReadingPart {
  text: string
  reading: string         // hiragana
  kind?: 'on' | 'kun'     // single kanji only, missing when no source reading fits
}

export interface SourceKanji {
  meanings: string[]  // KANJIDIC2, English
  on: string[]        // hiragana
  kun: string[]       // hiragana, a '.' marks where the okurigana starts (い.きる)
  strokes: number
  parts: string[]     // KanjiVG parts that are kanji of the set
  n5Readings: string[]  // readings it has in two or more N5 words of the set (KR2)
}

export interface SourceWord {
  form: string
  jmdict: string
  reading: string      // the one shown first
  readings: string[]   // every reading JMdict gives for the form in this entry, hiragana
  // readings other JMdict entries give for the same form (何 なん next to 何 なに): not
  // wrong for this spelling, so never offered as a wrong option
  homographs: string[]
  glosses: string[]    // per sense, its glosses joined
  n5: boolean          // in the N5 word list with this form and reading
  common: boolean      // JMdict marks the entry as common
  split: ReadingPart[] // empty when JmdictFurigana has none
  special: boolean     // one part spans several kanji
}

export interface SourceGroupMember {
  word: string        // word id
  irregular: boolean  // not simply number reading + counter reading (KR74), always false when practice is 'all'
}

export interface SourceGroup {
  members: SourceGroupMember[]
  question: string | null  // word id
}

// one line of the Sources screen (KR63)
export interface KanjiSourceInfo {
  name: string
  version: string
  url: string
  licence: string
  licenceUrl: string
}

// Merged entries, what src/data/kanjiData.ts hands out.

export interface KanjiSetEntry {
  id: string
  title: string
  kanji: string[]
}

export interface KanjiEntry {
  id: string           // k:日
  kanji: string
  keyword: string
  meanings: string[]   // every source meaning, keyword included
  strokeCount: number
  parts: string[]
  hook: string
  set: string          // set id
  order: number        // position in the whole course, from 0
  words: string[]      // ids of the words it owns, first word first
}

export interface WordEntry extends SourceWord {
  id: string
  gloss: string                      // the course gloss, for group members the first source gloss
  why: string | null
  meanings: Record<string, string>   // kanji -> meaning in this word, only where the course gives one
  kanji: string[]                    // set kanji in the form, in order of appearance
  home: string                       // the kanji it belongs to
  group: string | null               // group id for group members and question words
}

export interface WordGroupMember {
  word: string
  irregular: boolean
  practiced: boolean   // KR75
}

export interface WordGroupEntry {
  id: string
  title: string
  counter: string
  practice: 'all' | 'irregular'
  members: WordGroupMember[]  // only those JMdict has, in table order
  question: string | null     // word id, always practiced
}

// a reading of a kanji as one of its words shows it
export interface KanjiReading {
  reading: string
  kind?: 'on' | 'kun'
  word: string  // the first word in course order that has it
}

// Practice. 'meaning' shows the kanji and asks for its keyword (M1), 'recognize' shows the
// keyword and asks for the kanji (M2). Words: 'word-meaning' shows the word and asks for its
// meaning (V1), 'read-choice' for its reading (R1), 'read-type' has the reading typed (R2), 'spell'
// shows reading and meaning and asks for the written form (S1). The mode Reading is
// 'read-choice' and asks R1 or R2 by the box, there is no mode of its own for R2.
export type KanjiQuestionType = 'meaning' | 'recognize'
export type WordQuestionType = 'word-meaning' | 'read-choice' | 'read-type' | 'spell'
export type QuestionType = KanjiQuestionType | WordQuestionType
export type KanjiMode = Exclude<QuestionType, 'read-type'> | 'mixed'
export type Course = 'kana' | 'kanji'

// the kinds of wrong readings that have a name (KR22, KR33), see learning/readings.ts
export type ReadingKind = 'long-vowel' | 'small-tsu' | 'voicing' | 'vowel-kana' | 'other-reading'

// one stored item, a kanji (`k:日`) or a word (`w:...`)
export interface KanjiStatEntry {
  id: string
  correct: number
  incorrect: number
  totalMs: number
  count: number
  lastSeen: number
  lastWrong: number
  resolvedAt: number
  streak: number
  confusions: Record<string, number>  // what was picked instead (see KanjiAnswerInput.given) -> how often
  byType: Partial<Record<QuestionType, DirectionStat>>
  mistakes: Partial<Record<ReadingKind, number>>  // wrong readings by kind, words only
  box: number
  due: number
}

export type KanjiStatsMap = Record<string, KanjiStatEntry>

export interface KanjiAnswerInput {
  id: string
  type: QuestionType
  correct: boolean
  // what was picked, '' for "Don't know": the item id for kanji and meaning options,
  // the reading for a reading question (typed: only when it is a real reading), the written
  // form for a spelling question
  given: string
  ms: number
  holdBox?: boolean  // right after a miss in the same session: counts, but can't promote
  typo?: boolean     // a typed reading slipped twice: counts as wrong, but leaves the Leitner box alone
  mistake?: ReadingKind  // the kind of a wrong reading, when it has one
}

export interface KanjiAnswerRecord {
  id: string
  type: QuestionType
  correct: boolean
  given: string
  ms: number
  t: number
}

export interface KanjiCard {
  id: string
  home: string  // the kanji, for a word its home kanji
  type: QuestionType | 'intro'
  // kanji for 'meaning' and 'recognize' (a meaning card shows their keywords), word ids for
  // 'word-meaning' (shown as glosses), readings for 'read-choice', written forms for 'spell',
  // none for 'read-type'
  options: string[]
  answer: string  // the right one of the options, the reading shown first for 'read-type'
  // the intro of a new kanji's first word: the kanji item that has to be answered right in
  // this session first, else the word's cards are dropped (KR14)
  needs?: string
  reask?: boolean
}

// what an item id stands for, a kanji or a word, for every list that shows both
export interface ItemInfo {
  id: string
  kind: 'kanji' | 'word'
  text: string     // the kanji or the written form
  meaning: string  // keyword or gloss
  reading: string  // '' for a kanji
  home: string     // the kanji whose sheet it belongs to
}

// a line of the table on the Progress tab
export interface KanjiRow {
  item: ItemInfo
  order: number    // course position, the default sort; a word sits right after its home kanji
  correct: number
  incorrect: number
  acc: number
  box: number
  due: number
}

export type KanjiSortCol = 'kanji' | 'acc' | 'box' | 'errors'
export interface KanjiSort { col: KanjiSortCol; dir: 'asc' | 'desc' }
