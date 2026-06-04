import { ref, computed } from 'vue'
import type { InjectionKey } from 'vue'
import type { AppScreen, SetupTab, StatsFilter, StatRow, AccClass, TimeClass } from '../types'
import { useStats } from './useStats'
import { useSetup } from './useSetup'
import { useSession } from './useSession'

export function useQuiz() {
  const screen = ref<AppScreen>('setup')
  const activeTab = ref<SetupTab>('practice')
  const statsFilter = ref<StatsFilter>('all')

  const stats = useStats()
  const setup = useSetup()
  const session = useSession()

  const statsSummary = computed(() => {
    const all = Object.values(stats.statsData.value)
    const totalSeen    = all.reduce((s, e) => s + e.correct + e.incorrect, 0)
    const totalCorrect = all.reduce((s, e) => s + e.correct, 0)
    const totalErrors  = all.reduce((s, e) => s + e.incorrect, 0)
    const overallAcc   = totalSeen > 0 ? Math.round((totalCorrect / totalSeen) * 100) : 0
    const timed  = all.filter(e => e.count > 0)
    const avgMs  = timed.length > 0
      ? Math.round(timed.reduce((s, e) => s + e.totalMs / e.count, 0) / timed.length)
      : 0
    return {
      kanaCount: all.length,
      accuracy: `${overallAcc}%`,
      totalErrors,
      avgTime: avgMs > 0 ? `${(avgMs / 1000).toFixed(1)}s` : '--',
    }
  })

  const filteredStatsRows = computed((): StatRow[] => {
    let rows = Object.values(stats.statsData.value)
    if (statsFilter.value === 'hiragana')  rows = rows.filter(e => e.script === 'hiragana')
    else if (statsFilter.value === 'katakana') rows = rows.filter(e => e.script === 'katakana')
    else if (statsFilter.value === 'worst')    rows = rows.filter(e => e.incorrect > 0).sort((a, b) => b.incorrect - a.incorrect)
    else if (statsFilter.value === 'slowest')  rows = rows.filter(e => e.count > 0).sort((a, b) => (b.totalMs / b.count) - (a.totalMs / a.count))
    else rows = [...rows].sort((a, b) => a.kana.charCodeAt(0) - b.kana.charCodeAt(0))

    return rows.map(e => {
      const seen = e.correct + e.incorrect
      const acc  = seen > 0 ? Math.round((e.correct / seen) * 100) : 0
      const accClass: AccClass = acc >= 80 ? 'good' : acc >= 50 ? 'ok' : 'bad'
      const avgTime  = e.count > 0 ? (e.totalMs / e.count / 1000).toFixed(1) : null
      const timeClass: TimeClass = avgTime === null ? '' : parseFloat(avgTime) < 3 ? 'fast' : parseFloat(avgTime) < 6 ? 'ok' : 'slow'
      return { ...e, seen, acc, accClass, avgTime, timeClass }
    })
  })

  function showTab(tab: SetupTab): void {
    activeTab.value = tab
  }

  function setStatsFilter(filter: StatsFilter): void {
    statsFilter.value = filter
  }

  function startQuiz(errorMode: boolean): void {
    let pool
    let total

    if (errorMode) {
      const ep = stats.errorPairs.value
      if (ep.length === 0) { alert('No errors to practice yet!'); return }
      pool = ep.flatMap(e =>
        Array.from({ length: e.incorrect }, () => ({ kana: e.kana, romaji: e.romaji, script: e.script }))
      )
      total = pool.length
    } else {
      pool = setup.buildPairsFromSelected()
      const requested = setup.questionCountInput.value.trim() ? parseInt(setup.questionCountInput.value.trim()) : null
      total = (requested && requested > 0) ? requested : pool.length
    }

    session.start(pool, total, setup.quizMode.value, errorMode)
    screen.value = 'quiz'
  }

  function submitTyped(): void {
    session.submitTyped(stats.recordAnswer)
  }

  function selectAnswer(chosen: string): void {
    session.selectAnswer(chosen, stats.recordAnswer)
  }

  function nextQuestion(): void {
    session.next(() => { screen.value = 'results' })
  }

  function restartQuiz(): void {
    startQuiz(session.isErrorPractice.value)
  }

  function goHome(): void {
    screen.value = 'setup'
    stats.refresh()
  }

  function init(): void {
    setup.init()
  }

  return {
    // orchestration
    screen, activeTab, statsFilter,
    statsSummary, filteredStatsRows,
    showTab, setStatsFilter, startQuiz, submitTyped, selectAnswer, nextQuestion, restartQuiz, goHome, init,
    // stats
    statsData:          stats.statsData,
    errorPairs:         stats.errorPairs,
    maxErrorCount:      stats.maxErrorCount,
    errorTabCount:      stats.errorTabCount,
    statsTabCount:      stats.statsTabCount,
    errorKanaSet:       stats.errorKanaSet,
    removeErrorEntry:   stats.removeErrorEntry,
    confirmClearErrors: stats.confirmClearErrors,
    confirmClearStats:  stats.confirmClearStats,
    // setup
    activeScript:       setup.activeScript,
    selectedCols:       setup.selectedCols,
    quizMode:           setup.quizMode,
    questionCountInput: setup.questionCountInput,
    kanaFont:           setup.kanaFont,
    selectorScripts:    setup.selectorScripts,
    selectedCount:      setup.selectedCount,
    countHint:          setup.countHint,
    headerTitle:        setup.headerTitle,
    setKanaFont:        setup.setKanaFont,
    setScript:          setup.setScript,
    toggleCol:          setup.toggleCol,
    selectAll:          setup.selectAll,
    selectNone:         setup.selectNone,
    selectGroup:        setup.selectGroup,
    setMode:            setup.setMode,
    // session
    questions:          session.questions,
    current:            session.current,
    correctCount:       session.correctCount,
    wrongCount:         session.wrongCount,
    answered:           session.answered,
    selectedOption:     session.selectedOption,
    isErrorPractice:    session.isErrorPractice,
    typedAnswer:        session.typedAnswer,
    feedbackText:       session.feedbackText,
    feedbackType:       session.feedbackType,
    typeFieldEl:        session.typeFieldEl,
    currentQuestion:    session.currentQuestion,
    progress:           session.progress,
    resultScore:        session.resultScore,
    resultLabel:        session.resultLabel,
    uniqueMissedPairs:  session.uniqueMissedPairs,
  }
}

export type QuizContext = ReturnType<typeof useQuiz>
export const QUIZ_KEY: InjectionKey<QuizContext> = Symbol('quiz')
