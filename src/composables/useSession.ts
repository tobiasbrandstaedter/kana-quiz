import { ref, computed, nextTick } from 'vue'
import type { QuizQuestion, KanaPair, QuizMode, QuizDirection, FeedbackType, ScriptName } from '../types'
import { allPairs } from '../data/kana'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makeQuestion(pair: KanaPair, mode: QuizMode, full: KanaPair[]): QuizQuestion {
  const direction: QuizDirection = mode === 'mixed'
    ? (Math.random() < 0.5 ? 'kana-to-romaji' : 'romaji-to-kana')
    : mode

  if (direction === 'kana-to-romaji') {
    return { direction, inputType: 'type', question: pair.kana, answer: pair.romaji, kana: pair.kana, romaji: pair.romaji, script: pair.script, options: [] }
  }

  const correctVal = pair.kana
  const sameScript = full.filter(p => p.script === pair.script && p.kana !== correctVal)
  const pool = sameScript.length >= 3 ? sameScript : full.filter(p => p.kana !== correctVal)
  const others = shuffle(pool).slice(0, 3).map(p => p.kana)
  return { direction, inputType: 'choice', question: pair.romaji, answer: correctVal, kana: pair.kana, romaji: pair.romaji, script: pair.script, options: shuffle([correctVal, ...others]) }
}

type RecordFn = (kana: string, romaji: string, script: ScriptName, wasCorrect: boolean, elapsed: number) => void

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
  const questionStartTime = ref(0)
  const typeFieldEl = ref<HTMLInputElement | null>(null)

  const currentQuestion = computed(() => questions.value[current.value] ?? null)

  const progress = computed(() => {
    const total = questions.value.length
    return total > 0 ? (current.value / total) * 100 : 0
  })

  const resultScore = computed(() => {
    const total = questions.value.length
    return total > 0 ? `${Math.round((correctCount.value / total) * 100)}%` : '0%'
  })

  const resultLabel = computed(() => {
    const total = questions.value.length
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
    questionStartTime.value = Date.now()
  }

  function focusTypeField(): void {
    nextTick(() => typeFieldEl.value?.focus())
  }

  function start(pool: KanaPair[], total: number, mode: QuizMode, errorMode: boolean): void {
    isErrorPractice.value = errorMode
    const full = allPairs()
    let base = [...pool]
    while (base.length < total) base = [...base, ...pool]
    questions.value = shuffle(base).slice(0, total).map(pair => makeQuestion(pair, mode, full))
    current.value = 0
    correctCount.value = 0
    wrongCount.value = 0
    missedPairs.value = []
    resetQuestion()
    if (questions.value[0]?.inputType === 'type') focusTypeField()
  }

  function submitTyped(onRecord: RecordFn): void {
    if (answered.value) return
    const q = currentQuestion.value
    if (!q) return
    const typed = typedAnswer.value.trim().toLowerCase()
    if (!typed) return

    answered.value = true
    const elapsed = Date.now() - questionStartTime.value
    const wasCorrect = typed === q.answer.toLowerCase()
    onRecord(q.kana, q.romaji, q.script, wasCorrect, elapsed)

    if (wasCorrect) {
      correctCount.value++
      feedbackText.value = '✓ CORRECT'
      feedbackType.value = 'correct'
    } else {
      wrongCount.value++
      missedPairs.value.push({ kana: q.kana, romaji: q.romaji, script: q.script })
      feedbackText.value = `✗ Answer: ${q.answer}`
      feedbackType.value = 'wrong'
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
    onRecord(q.kana, q.romaji, q.script, wasCorrect, elapsed)

    if (wasCorrect) {
      correctCount.value++
      feedbackText.value = '✓ CORRECT'
      feedbackType.value = 'correct'
    } else {
      wrongCount.value++
      missedPairs.value.push({ kana: q.kana, romaji: q.romaji, script: q.script })
      feedbackText.value = `✗ Answer: ${q.answer}`
      feedbackType.value = 'wrong'
    }
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
    missedPairs, isErrorPractice, typedAnswer, feedbackText, feedbackType, typeFieldEl,
    currentQuestion, progress, resultScore, resultLabel, uniqueMissedPairs,
    start, submitTyped, selectAnswer, next,
  }
}
