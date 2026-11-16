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
export type StatsFilter = 'all' | 'hiragana' | 'katakana'
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

export interface StatsSummary {
  kanaCount: number
  accuracy: string
  totalErrors: number
  avgTime: string
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
