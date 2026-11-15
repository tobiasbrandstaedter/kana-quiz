import { ref, computed } from 'vue'
import type { InjectionKey } from 'vue'
import type { AppScreen, SetupTab, StatsFilter, StatsSort, StatsSortCol, StatRow, AccClass, TimeClass, KanaPair, QuizMode, DrawResult } from '../types'
import { pairFor, kanaForRomaji } from '../data/kana'
import { detectPatterns, statsFromLog } from '../learning/patterns'
import type { Pattern } from '../learning/patterns'
import { pickSmart, orderSession, columnProgress } from '../learning/scheduler'
import type { ColumnProgress } from '../learning/scheduler'
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

  // what TRY AGAIN on the results screen should run
  let replay: () => void = () => startQuiz(false)

  const SMART_SIZE = 20

  function smartPicks() {
    const scripts = setup.selectorScripts.value.map(([script]) => script)
    // new kana come from the selection, or from the whole table in order when nothing is selected
    const selected = setup.buildPairsFromSelected()
    const candidates = selected.length > 0 ? selected : setup.selectorScripts.value.flatMap(([script, data]) =>
      Object.values(data).flatMap(cols => cols.flatMap(col => col.kana.map((k, i) => ({ kana: k, romaji: col.romaji[i], script })))))
    const size = parseInt(setup.questionCountText.value) || SMART_SIZE
    return pickSmart(stats.statsData.value, stats.answerLog.value, candidates, scripts, size, Date.now())
  }

  const smartSummary = computed(() => {
    const p = smartPicks()
    return { due: p.due.length, weak: p.weak.length, fresh: p.fresh.length, fill: p.fill.length }
  })

  const columnProgressMap = computed(() => {
    const now = Date.now()
    const out: Record<string, ColumnProgress> = {}
    for (const [, data] of setup.selectorScripts.value)
      for (const cols of Object.values(data))
        for (const col of cols) out[col.id] = columnProgress(col.kana, stats.statsData.value, now)
    return out
  })

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

  const allPatterns = computed(() => detectPatterns(stats.statsData.value, stats.answerLog.value, 'all'))

  const roundPatterns = computed(() => {
    const log = stats.answerLog.value.filter(r => r.t >= session.startedAt.value)
    return detectPatterns(statsFromLog(log), log, 'round')
  })

  // kana the user mixed this one up with before, most frequent first
  function confusedWith(kana: string): string[] {
    const e = stats.statsData.value[kana]
    if (!e) return []
    return Object.entries(e.confusions)
      .sort((a, b) => b[1] - a[1])
      .map(([given]) => pairFor(given) ? given : kanaForRomaji(given, e.script))
      .filter((k): k is string => !!k)
  }

  function beginSession(pool: KanaPair[], total: number, mode: QuizMode, errorMode: boolean): void {
    session.start(pool, total, mode, errorMode, confusedWith)
    screen.value = 'quiz'
  }

  function startSmartPractice(): void {
    replay = startSmartPractice
    const items = orderSession(smartPicks())
    if (items.length === 0) { alert('Nothing to practice. Raise the question count or select some columns.'); return }
    session.startPlanned(items, setup.quizMode.value, confusedWith)
    screen.value = 'quiz'
  }

  function startPatternPractice(p: Pattern): void {
    if (p.practice.length === 0) return
    replay = () => startPatternPractice(p)
    beginSession(p.practice, Math.max(p.practice.length, 8), p.mode ?? setup.quizMode.value, false)
  }

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
    replay = startWorstPractice
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
    beginSession(pool, pool.length, setup.quizMode.value, false)
  }

  function startSlowestPractice(): void {
    replay = startSlowestPractice
    const pool = filteredEntries()
      .filter(e => e.count > 0 && (e.totalMs / e.count) > 3000)
      .sort((a, b) => (b.totalMs / b.count) - (a.totalMs / a.count))
      .map(e => ({ kana: e.kana, romaji: e.romaji, script: e.script }))
    if (pool.length === 0) { alert('No slow kana in this filter!'); return }
    beginSession(pool, pool.length, setup.quizMode.value, false)
  }

  function startQuiz(errorMode: boolean): void {
    replay = () => startQuiz(errorMode)
    let pool
    let total

    if (errorMode) {
      const ep = stats.errorPairs.value
      if (ep.length === 0) { alert('No errors to practice yet!'); return }
      // weight by recent errors, not lifetime ones, so old mistakes stop dominating
      pool = ep.flatMap(e =>
        Array.from({ length: Math.min(3, Math.max(1, stats.recentErrorCount(e.kana))) }, () => ({ kana: e.kana, romaji: e.romaji, script: e.script }))
      )
      total = pool.length
    } else {
      pool = setup.buildPairsFromSelected()
      const requested = setup.questionCountText.value ? parseInt(setup.questionCountText.value) : null
      total = (requested && requested > 0) ? requested : pool.length
    }

    beginSession(pool, total, setup.quizMode.value, errorMode)
  }

  // skip ahead after a correct answer, unless the user already pressed NEXT
  function advanceSoon(ms: number): void {
    if (session.feedbackType.value !== 'correct') return
    const at = session.current.value
    setTimeout(() => { if (screen.value === 'quiz' && session.current.value === at) nextQuestion() }, ms)
  }

  function submitTyped(): void {
    session.submitTyped(stats.recordAnswer)
    advanceSoon(350)
  }

  function selectAnswer(chosen: string): void {
    session.selectAnswer(chosen, stats.recordAnswer)
    advanceSoon(400)
  }

  function submitDrawing(result: DrawResult): void {
    session.submitDrawing(result, stats.recordAnswer)
    // a bit longer than the others so the finished kana can be seen
    advanceSoon(900)
  }

  function nextQuestion(): void {
    session.next(() => { screen.value = 'results' })
  }

  function restartQuiz(): void {
    replay()
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
    statsSummary, filteredStatsRows, allPatterns, roundPatterns, smartSummary, columnProgressMap,
    showTab, setStatsFilter, setStatsSort, startQuiz, startWorstPractice, startSlowestPractice, startPatternPractice, startSmartPractice,
    submitTyped, selectAnswer, submitDrawing, nextQuestion, restartQuiz, goHome, init,
    // stats
    statsData:          stats.statsData,
    answerLog:          stats.answerLog,
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
    strokeColumns:      setup.strokeColumns,
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
    explanation:        session.explanation,
    typeFieldEl:        session.typeFieldEl,
    currentQuestion:    session.currentQuestion,
    progress:           session.progress,
    resultScore:        session.resultScore,
    resultLabel:        session.resultLabel,
    uniqueMissedPairs:  session.uniqueMissedPairs,
    drawings:           session.drawings,
  }
}

export type QuizContext = ReturnType<typeof useQuiz>
export const QUIZ_KEY: InjectionKey<QuizContext> = Symbol('quiz')
