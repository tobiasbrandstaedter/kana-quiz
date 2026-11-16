import { ref, computed, nextTick } from 'vue'
import type { QuizQuestion, KanaPair, QuizMode, QuizDirection, FeedbackType, AnswerInput, DrawResult, Point } from '../types'
import { allPairs, pairFor, kanaForRomaji } from '../data/kana'
import { lookalikeHint } from '../data/lookalikes'
import { kanaStrokes } from '../data/strokeGlyphs'
import { matchesRomaji, normalizeRomaji, isTypo } from '../learning/romaji'
import { pickDistractors, shuffle } from '../learning/distractors'
import type { PlannedItem } from '../learning/scheduler'
import { DEFAULT_LIMITS } from '../learning/progress'
import type { FluencyLimits } from '../learning/progress'

// what the session needs to know about the learner, handed in so it doesn't depend on stats
export interface SessionHelpers {
  distractorsFor: (kana: string) => string[]   // past confusions, preferred as wrong options
  directionFor?: (pair: KanaPair, canDraw: boolean) => QuizDirection  // mixed mode
  known?: Set<string>                           // kana the user has met, for the other options
}

function makeIntro(pair: KanaPair): QuizQuestion {
  return { direction: 'kana-to-romaji', inputType: 'intro', question: pair.kana, answer: pair.romaji, kana: pair.kana, romaji: pair.romaji, script: pair.script, options: [] }
}

function pickDirection(pair: KanaPair, mode: QuizMode, helpers: SessionHelpers): QuizDirection {
  const canDraw = !!kanaStrokes(pair.kana)
  if (mode === 'mixed') {
    if (helpers.directionFor) return helpers.directionFor(pair, canDraw)
    const dirs: QuizDirection[] = canDraw ? ['kana-to-romaji', 'romaji-to-kana', 'draw'] : ['kana-to-romaji', 'romaji-to-kana']
    return dirs[Math.floor(Math.random() * dirs.length)]
  }
  if (mode === 'draw' || mode === 'listen') return canDraw ? 'draw' : 'romaji-to-kana'
  return mode
}

function makeQuestion(pair: KanaPair, mode: QuizMode, full: KanaPair[], helpers: SessionHelpers): QuizQuestion {
  const direction = pickDirection(pair, mode, helpers)

  if (direction === 'draw') {
    return { direction, inputType: 'draw', question: pair.romaji, answer: pair.kana, kana: pair.kana, romaji: pair.romaji, script: pair.script, options: [], listen: mode === 'listen' }
  }

  if (direction === 'kana-to-romaji') {
    return { direction, inputType: 'type', question: pair.kana, answer: pair.romaji, kana: pair.kana, romaji: pair.romaji, script: pair.script, options: [] }
  }

  const others = pickDistractors(pair, full, helpers.distractorsFor(pair.kana), Math.random, helpers.known)
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
  // fluency mode: answer within this time or it counts as too slow. Drawing is never timed.
  const limits = ref<FluencyLimits>(DEFAULT_LIMITS)
  const gaveUp = ref(false)  // "don't know" on the current question
  // first and latest answer per kana, so a miss fixed on the re-ask isn't scored twice
  const kanaResults = ref<Record<string, { first: boolean; last: boolean }>>({})

  // kept from start() so re-asked questions are built the same way
  let sessionMode: QuizMode = 'kana-to-romaji'
  let fullPairs: KanaPair[] = []
  let helpers: SessionHelpers = { distractorsFor: () => [] }
  let reaskCount: Record<string, number> = {}

  const currentQuestion = computed(() => questions.value[current.value] ?? null)

  const timeLimit = computed(() => {
    const q = currentQuestion.value
    if (!timed.value || !q) return 0
    return q.inputType === 'type' || q.inputType === 'choice' ? limits.value[q.inputType] : 0
  })

  const progress = computed(() => {
    const total = questions.value.length
    return total > 0 ? (current.value / total) * 100 : 0
  })

  const roundSummary = computed(() => {
    const all = Object.values(kanaResults.value)
    const first = all.filter(r => r.first).length
    const fixed = all.filter(r => !r.first && r.last).length
    return { total: all.length, first, fixed, open: all.length - first - fixed }
  })

  const resultScore = computed(() => {
    const { total, first } = roundSummary.value
    return total > 0 ? `${Math.round((first / total) * 100)}%` : '0%'
  })

  const resultLabel = computed(() => {
    const { total, first, fixed, open } = roundSummary.value
    if (!total) return { title: '', jp: '', detail: '' }
    const pct = Math.round((first / total) * 100)
    const [title, jp] =
      pct === 100 ? ['Perfect!', '完璧！'] :
      open === 0  ? ['All fixed!', 'できた！'] :
      pct >= 80   ? ['Great work', 'よくできました'] :
      pct >= 60   ? ['Keep practicing', 'もう少し'] :
                    ['Keep studying', '頑張って！']
    const parts = [`${first} of ${total} kana on the first try`]
    if (fixed) parts.push(`${fixed} fixed on retry`)
    if (open) parts.push(`${open} still open`)
    return { title, jp, detail: parts.join(' · ') }
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
    gaveUp.value = false
    questionStartTime.value = Date.now()
  }

  function focusTypeField(): void {
    nextTick(() => typeFieldEl.value?.focus())
  }

  function begin(build: () => QuizQuestion[], mode: QuizMode, errorMode: boolean, given: SessionHelpers): void {
    isErrorPractice.value = errorMode
    sessionMode = mode
    fullPairs = allPairs()
    helpers = given
    reaskCount = {}
    questions.value = build()
    current.value = 0
    correctCount.value = 0
    wrongCount.value = 0
    missedPairs.value = []
    drawings.value = {}
    kanaResults.value = {}
    startedAt.value = Date.now()
    resetQuestion()
    if (questions.value[0]?.inputType === 'type') focusTypeField()
  }

  function start(pool: KanaPair[], total: number, mode: QuizMode, errorMode: boolean, given: SessionHelpers = { distractorsFor: () => [] }): void {
    begin(() => {
      let base = [...pool]
      while (base.length < total) base = [...base, ...pool]
      return shuffle(base).slice(0, total).map(pair => makeQuestion(pair, sessionMode, fullPairs, helpers))
    }, mode, errorMode, given)
  }

  // keeps the given order, used by smart practice
  function startPlanned(items: PlannedItem[], mode: QuizMode, given: SessionHelpers): void {
    begin(
      () => items.map(i => i.intro ? makeIntro(i.pair) : makeQuestion(i.pair, sessionMode, fullPairs, helpers)),
      mode, false, given,
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
    questions.value.splice(idx, 0, { ...makeQuestion(pair, sessionMode, fullPairs, helpers), reask: true })
  }

  function noteResult(kana: string, correct: boolean): void {
    const r = kanaResults.value[kana]
    if (r) r.last = correct
    else kanaResults.value[kana] = { first: correct, last: correct }
  }

  function markCorrect(q: QuizQuestion, suffix = ''): void {
    noteResult(q.kana, true)
    correctCount.value++
    feedbackText.value = suffix ? `Correct · ${suffix}` : 'Correct'
    feedbackType.value = 'correct'
  }

  function markWrong(q: QuizQuestion, text: string, explain: Explanation | null): void {
    noteResult(q.kana, false)
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
      markCorrect(q, typed === q.answer ? '' : q.answer)
    } else if (typo) {
      markWrong(q, `Typo? Answer: ${q.answer}`, null)
    } else {
      // only worth a side by side when the typed reading is a real kana
      const givenKana = kanaForRomaji(typed, q.script) ?? null
      markWrong(q, `Answer: ${q.answer}`, givenKana ? {
        givenKana,
        givenLabel: typed,
        hint: lookalikeHint(q.kana, givenKana),
      } : null)
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
      markCorrect(q)
    } else {
      markWrong(q, `Answer: ${q.answer}`, {
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
      markCorrect(q)
      return
    }
    drawings.value[q.kana] = result.ink
    const why =
      result.faults.order ? 'stroke order' :
      result.faults.direction ? 'stroke direction' :
      'needed a hint'
    markWrong(q, `${q.kana}: ${why}`, null)
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
    markWrong(q, `Too slow · ${q.answer}`, null)
  }

  // honest "don't know" instead of a guess: wrong, but nothing to learn about confusions
  function giveUp(onRecord: RecordFn): void {
    if (answered.value) return
    const q = currentQuestion.value
    if (!q || q.inputType === 'intro') return

    answered.value = true
    gaveUp.value = true
    onRecord({
      kana: q.kana, romaji: q.romaji, script: q.script, direction: q.direction,
      correct: false, given: '', elapsedMs: Date.now() - questionStartTime.value,
    })
    markWrong(q, q.inputType === 'draw' ? `${q.kana} (${q.romaji})` : `Answer: ${q.answer}`, null)
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
    timed, limits, timeLimit, gaveUp,
    currentQuestion, progress, resultScore, resultLabel, roundSummary, uniqueMissedPairs,
    start, startPlanned, submitTyped, selectAnswer, submitDrawing, timeOut, giveUp, next,
  }
}
