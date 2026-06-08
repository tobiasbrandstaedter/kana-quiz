import { ref, computed } from 'vue'
import type { InjectionKey } from 'vue'
import type { AppScreen, SetupTab, StatsFilter, StatsSort, StatsSortCol, StatRow, AccClass, TimeClass } from '../types'
import { useStats } from './useStats'
import { useSetup } from './useSetup'
import { useSession } from './useSession'

export function useQuiz() {
  const screen = ref<AppScreen>('setup')
  const activeTab = ref<SetupTab>('practice')
  const statsFilter = ref<StatsFilter>('all')
  const statsSort = ref<StatsSort | null>(null)

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

    const mapped: StatRow[] = rows.map(e => {
      const seen = e.correct + e.incorrect
      const acc  = seen > 0 ? Math.round((e.correct / seen) * 100) : 0
      const accClass: AccClass = acc >= 80 ? 'good' : acc >= 50 ? 'ok' : 'bad'
      const avgTime  = e.count > 0 ? (e.totalMs / e.count / 1000).toFixed(1) : null
      const timeClass: TimeClass = avgTime === null ? '' : parseFloat(avgTime) < 3 ? 'fast' : parseFloat(avgTime) < 6 ? 'ok' : 'slow'
      return { ...e, seen, acc, accClass, avgTime, timeClass }
    })

    const s = statsSort.value
    if (!s) return mapped.sort((a, b) => a.kana.charCodeAt(0) - b.kana.charCodeAt(0))

    const sign = s.dir === 'asc' ? 1 : -1
    return mapped.sort((a, b) => {
      if (s.col === 'kana')   return sign * (a.kana.charCodeAt(0) - b.kana.charCodeAt(0))
      if (s.col === 'acc')    return sign * (a.acc - b.acc)
      if (s.col === 'seen')   return sign * (a.seen - b.seen)
      if (s.col === 'errors') return sign * (a.incorrect - b.incorrect)
      // time: null (unseen) sorts to end regardless of direction
      const aMs = a.avgTime !== null ? parseFloat(a.avgTime) : (s.dir === 'asc' ? Infinity : -Infinity)
      const bMs = b.avgTime !== null ? parseFloat(b.avgTime) : (s.dir === 'asc' ? Infinity : -Infinity)
      return sign * (aMs - bMs)
    })
  })

  function showTab(tab: SetupTab): void {
    activeTab.value = tab
  }

  function setStatsFilter(filter: StatsFilter): void {
    statsFilter.value = filter
  }

  function setStatsSort(col: StatsSortCol): void {
    if (statsSort.value?.col === col) {
      statsSort.value = { col, dir: statsSort.value.dir === 'asc' ? 'desc' : 'asc' }
    } else {
      // errors and time default desc so worst/slowest appear on top on first click
      statsSort.value = { col, dir: col === 'errors' || col === 'time' ? 'desc' : 'asc' }
    }
  }

  function filteredEntries() {
    const all = Object.values(stats.statsData.value)
    if (statsFilter.value === 'hiragana')  return all.filter(e => e.script === 'hiragana')
    if (statsFilter.value === 'katakana') return all.filter(e => e.script === 'katakana')
    return all
  }

  function startWorstPractice(): void {
    const pool = filteredEntries()
      .filter(e => {
        const seen = e.correct + e.incorrect
        return seen > 0 && (e.correct / seen) < 0.8
      })
      .sort((a, b) => {
        const accA = a.correct / (a.correct + a.incorrect)
        const accB = b.correct / (b.correct + b.incorrect)
        return accA - accB
      })
      .map(e => ({ kana: e.kana, romaji: e.romaji, script: e.script }))
    if (pool.length === 0) { alert('No weak kana in this filter!'); return }
    session.start(pool, pool.length, setup.quizMode.value, false)
    screen.value = 'quiz'
  }

  function startSlowestPractice(): void {
    const pool = filteredEntries()
      .filter(e => e.count > 0 && (e.totalMs / e.count) > 3000)
      .sort((a, b) => (b.totalMs / b.count) - (a.totalMs / a.count))
      .map(e => ({ kana: e.kana, romaji: e.romaji, script: e.script }))
    if (pool.length === 0) { alert('No slow kana in this filter!'); return }
    session.start(pool, pool.length, setup.quizMode.value, false)
    screen.value = 'quiz'
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
    if (session.feedbackType.value === 'correct') setTimeout(nextQuestion, 350)
  }

  function selectAnswer(chosen: string): void {
    session.selectAnswer(chosen, stats.recordAnswer)
    if (session.feedbackType.value === 'correct') setTimeout(nextQuestion, 400)
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
    screen, activeTab, statsFilter, statsSort,
    statsSummary, filteredStatsRows,
    showTab, setStatsFilter, setStatsSort, startQuiz, startWorstPractice, startSlowestPractice,
    submitTyped, selectAnswer, nextQuestion, restartQuiz, goHome, init,
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
