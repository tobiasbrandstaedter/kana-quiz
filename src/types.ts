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
export type QuizMode = 'kana-to-romaji' | 'romaji-to-kana' | 'mixed'
export type QuizDirection = 'kana-to-romaji' | 'romaji-to-kana'
export type InputType = 'type' | 'choice'
export type AppScreen = 'setup' | 'quiz' | 'results'
export type SetupTab = 'practice' | 'errors' | 'stats'
export type StatsFilter = 'all' | 'hiragana' | 'katakana' | 'worst' | 'slowest'
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
}

export interface StatEntry {
  kana: string
  romaji: string
  script: ScriptName
  correct: number
  incorrect: number
  totalMs: number
  count: number
}

export type StatsMap = Record<string, StatEntry>

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
