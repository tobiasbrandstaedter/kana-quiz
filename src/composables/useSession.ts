import { ref, computed, nextTick } from 'vue'
import type { QuizQuestion, KanaPair, QuizMode, QuizDirection, FeedbackType, AnswerInput, DrawResult, Point, InputType } from '../types'
import { allPairs, pairFor, kanaForRomaji } from '../data/kana'
import { lookalikeHint } from '../data/lookalikes'
import { kanaStrokes } from '../data/strokeGlyphs'
import { matchesRomaji, normalizeRomaji, isTypo } from '../learning/romaji'
import { pickDistractors, shuffle } from '../learning/distractors'
import type { PlannedItem } from '../learning/scheduler'

type DistractorsFor = (kana: string) => string[]

function makeIntro(pair: KanaPair): QuizQuestion {
  return { direction: 'kana-to-romaji', inputType: 'intro', question: pair.kana, answer: pair.romaji, kana: pair.kana, romaji: pair.romaji, script: pair.script, options: [] }
}

function pickDirection(pair: KanaPair, mode: QuizMode): QuizDirection {
  const canDraw = !!kanaStrokes(pair.kana)
  if (mode === 'mixed') {
    const dirs: QuizDirection[] = canDraw ? ['kana-to-romaji', 'romaji-to-kana', 'draw'] : ['kana-to-romaji', 'romaji-to-kana']
    return dirs[Math.floor(Math.random() * dirs.length)]
  }
  if (mode === 'draw' || mode === 'listen') return canDraw ? 'draw' : 'romaji-to-kana'
  return mode
}

function makeQuestion(pair: KanaPair, mode: QuizMode, full: KanaPair[], distractorsFor: DistractorsFor): QuizQuestion {
  const direction = pickDirection(pair, mode)

  if (direction === 'draw') {
    return { direction, inputType: 'draw', question: pair.romaji, answer: pair.kana, kana: pair.kana, romaji: pair.romaji, script: pair.script, options: [], listen: mode === 'listen' }
  }

  if (direction === 'kana-to-romaji') {
    return { direction, inputType: 'type', question: pair.kana, answer: pair.romaji, kana: pair.kana, romaji: pair.romaji, script: pair.script, options: [] }
  }

  const others = pickDistractors(pair, full, distractorsFor(pair.kana))
  return { direction, inputType: 'choice', question: pair.romaji, answer: pair.kana, kana: pair.kana, romaji: pair.romaji, script: pair.script, options: shuffle([pair.kana, ...others]) }
}

type RecordFn = (answer: AnswerInput) => void

// what to show under a wrong answer
export interface Explanation {
  givenKana: string | null
  givenLabel: string
  hint: string | null
}

const MAX_REASKS = 2

// fluency mode: answer within this time or it counts as too slow. Drawing is never timed.
const TIME_LIMITS: Partial<Record<InputType, number>> = { type: 3500, choice: 3000 }

export function useSession() {
  const questions = ref<QuizQuestion[]>([])
  const current = ref(0)
  const correctCount = ref(0)
  const wrongCount = ref(0)
  const answered = ref(false)
  const selectedOption = ref<string | null>(null)
  const missedPairs = ref<KanaPair[]>([])
  const isErrorPractice = ref(false)
  const typedAnswer = ref('')
  const feedbackText = ref('')
  const feedbackType = ref<FeedbackType>('')
  const explanation = ref<Explanation | null>(null)
  const questionStartTime = ref(0)
  const startedAt = ref(0)
  const typeFieldEl = ref<HTMLInputElement | null>(null)
  // what the user drew for kana they missed in draw mode, shown on the results screen
  const drawings = ref<Record<string, Array<Point[] | null>>>({})
  const timed = ref(false)  // set by the caller before start

  // kept from start() so re-asked questions are built the same way
  let sessionMode: QuizMode = 'kana-to-romaji'
  let fullPairs: KanaPair[] = []
  let distractorsFor: DistractorsFor = () => []
  let reaskCount: Record<string, number> = {}

  const currentQuestion = computed(() => questions.value[current.value] ?? null)

  const timeLimit = computed(() => {
    const q = currentQuestion.value
    return timed.value && q ? TIME_LIMITS[q.inputType] ?? 0 : 0
  })

  // intro cards aren't answered, so they don't count towards the score
  const scoredCount = computed(() => questions.value.filter(q => q.inputType !== 'intro').length)

  const progress = computed(() => {
    const total = questions.value.length
    return total > 0 ? (current.value / total) * 100 : 0
  })

  const resultScore = computed(() => {
    const total = scoredCount.value
    return total > 0 ? `${Math.round((correctCount.value / total) * 100)}%` : '0%'
  })

  const resultLabel = computed(() => {
    const total = scoredCount.value
    if (!total) return ''
    const pct = Math.round((correctCount.value / total) * 100)
    const tag =
      pct === 100 ? 'PERFECT — 完璧！' :
      pct >= 80   ? 'GREAT WORK — よくできました' :
      pct >= 60   ? 'KEEP PRACTICING — もう少し' :
                    'KEEP STUDYING — 頑張って！'
    return `${correctCount.value} / ${total} — ${tag}`
  })

  const uniqueMissedPairs = computed(() =>
    [...new Map(missedPairs.value.map(p => [p.kana, p])).values()]
  )

  function resetQuestion(): void {
    answered.value = false
    selectedOption.value = null
    typedAnswer.value = ''
    feedbackText.value = ''
    feedbackType.value = ''
    explanation.value = null
    questionStartTime.value = Date.now()
  }

  function focusTypeField(): void {
    nextTick(() => typeFieldEl.value?.focus())
  }

  function begin(build: () => QuizQuestion[], mode: QuizMode, errorMode: boolean, preferred: DistractorsFor): void {
    isErrorPractice.value = errorMode
    sessionMode = mode
    fullPairs = allPairs()
    distractorsFor = preferred
    reaskCount = {}
    questions.value = build()
    current.value = 0
    correctCount.value = 0
    wrongCount.value = 0
    missedPairs.value = []
    drawings.value = {}
    startedAt.value = Date.now()
    resetQuestion()
    if (questions.value[0]?.inputType === 'type') focusTypeField()
  }

  function start(pool: KanaPair[], total: number, mode: QuizMode, errorMode: boolean, preferred: DistractorsFor = () => []): void {
    begin(() => {
      let base = [...pool]
      while (base.length < total) base = [...base, ...pool]
      return shuffle(base).slice(0, total).map(pair => makeQuestion(pair, sessionMode, fullPairs, distractorsFor))
    }, mode, errorMode, preferred)
  }

  // keeps the given order, used by smart practice
  function startPlanned(items: PlannedItem[], mode: QuizMode, preferred: DistractorsFor): void {
    begin(
      () => items.map(i => i.intro ? makeIntro(i.pair) : makeQuestion(i.pair, sessionMode, fullPairs, distractorsFor)),
      mode, false, preferred,
    )
  }

  // a missed kana comes back a few questions later, up to MAX_REASKS times per session
  function queueReask(q: QuizQuestion): void {
    const n = reaskCount[q.kana] ?? 0
    if (n >= MAX_REASKS) return
    reaskCount[q.kana] = n + 1
    const offset = 3 + Math.floor(Math.random() * 4)
    const idx = Math.min(current.value + offset, questions.value.length)
    const pair = { kana: q.kana, romaji: q.romaji, script: q.script }
    questions.value.splice(idx, 0, makeQuestion(pair, sessionMode, fullPairs, distractorsFor))
  }

  function markCorrect(suffix = ''): void {
    correctCount.value++
    feedbackText.value = suffix ? `✓ CORRECT · ${suffix}` : '✓ CORRECT'
    feedbackType.value = 'correct'
  }

  function markWrong(q: QuizQuestion, text: string, explain: Explanation | null): void {
    wrongCount.value++
    missedPairs.value.push({ kana: q.kana, romaji: q.romaji, script: q.script })
    feedbackText.value = text
    feedbackType.value = 'wrong'
    explanation.value = explain
    queueReask(q)
  }

  function submitTyped(onRecord: RecordFn): void {
    if (answered.value) return
    const q = currentQuestion.value
    if (!q) return
    const typed = normalizeRomaji(typedAnswer.value)
    if (!typed) return

    answered.value = true
    const elapsed = Date.now() - questionStartTime.value
    const wasCorrect = matchesRomaji(typed, q.kana, q.romaji)
    const typo = !wasCorrect && isTypo(typed, q.kana, q.romaji)
    // a typo is still wrong, but it says nothing about which kana got mixed up
    onRecord({ kana: q.kana, romaji: q.romaji, script: q.script, direction: q.direction, correct: wasCorrect, given: typo ? '' : typed, elapsedMs: elapsed, typo })

    if (wasCorrect) {
      // show the Hepburn form when an alternate spelling was used
      markCorrect(typed === q.answer ? '' : q.answer)
    } else if (typo) {
      markWrong(q, `✗ Typo? Answer: ${q.answer}`, null)
    } else {
      const givenKana = kanaForRomaji(typed, q.script) ?? null
      markWrong(q, `✗ Answer: ${q.answer}`, {
        givenKana,
        givenLabel: typed,
        hint: givenKana ? lookalikeHint(q.kana, givenKana) : null,
      })
    }
  }

  function selectAnswer(chosen: string, onRecord: RecordFn): void {
    if (answered.value) return
    const q = currentQuestion.value
    if (!q) return

    answered.value = true
    selectedOption.value = chosen

    const elapsed = Date.now() - questionStartTime.value
    const wasCorrect = chosen === q.answer
    onRecord({ kana: q.kana, romaji: q.romaji, script: q.script, direction: q.direction, correct: wasCorrect, given: chosen, elapsedMs: elapsed })

    if (wasCorrect) {
      markCorrect()
    } else {
      markWrong(q, `✗ Answer: ${q.answer}`, {
        givenKana: chosen,
        givenLabel: pairFor(chosen)?.romaji ?? '',
        hint: lookalikeHint(q.kana, chosen),
      })
    }
  }

  function submitDrawing(result: DrawResult, onRecord: RecordFn): void {
    if (answered.value) return
    const q = currentQuestion.value
    if (!q) return

    answered.value = true
    const elapsed = Date.now() - questionStartTime.value
    onRecord({
      kana: q.kana, romaji: q.romaji, script: q.script, direction: q.direction,
      correct: result.correct, given: '', elapsedMs: elapsed,
      strokes: { errors: result.errors, faults: result.faults },
    })

    if (result.correct) {
      markCorrect()
      return
    }
    drawings.value[q.kana] = result.ink
    const why =
      result.faults.order ? 'stroke order' :
      result.faults.direction ? 'stroke direction' :
      'needed a hint'
    markWrong(q, `✗ ${q.kana}: ${why}`, null)
  }

  function timeOut(onRecord: RecordFn): void {
    if (answered.value) return
    const q = currentQuestion.value
    if (!q) return

    answered.value = true
    onRecord({
      kana: q.kana, romaji: q.romaji, script: q.script, direction: q.direction,
      correct: false, given: '', elapsedMs: timeLimit.value, timeout: true,
    })
    markWrong(q, `⏱ Too slow · ${q.answer}`, null)
  }

  function next(onResults: () => void): void {
    current.value++
    if (current.value >= questions.value.length) {
      onResults()
    } else {
      resetQuestion()
      if (currentQuestion.value?.inputType === 'type') focusTypeField()
    }
  }

  return {
    questions, current, correctCount, wrongCount, answered, selectedOption,
    missedPairs, isErrorPractice, typedAnswer, feedbackText, feedbackType, explanation, startedAt, typeFieldEl, drawings,
    timed, timeLimit,
    currentQuestion, progress, resultScore, resultLabel, uniqueMissedPairs,
    start, startPlanned, submitTyped, selectAnswer, submitDrawing, timeOut, next,
  }
}
