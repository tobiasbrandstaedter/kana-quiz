import { ref, computed, watch } from 'vue'
import type { InjectionKey } from 'vue'
import type { AppScreen, SetupTab, StatsFilter, StatsSort, StatsSortCol, StatRow, AccClass, TimeClass, KanaPair, QuizMode, DrawResult, AnswerInput } from '../types'
import { pairFor, kanaForRomaji } from '../data/kana'
import { detectPatterns, statsFromLog } from '../learning/patterns'
import type { Pattern } from '../learning/patterns'
import { pickSmart, orderSession, columnProgress, dueOutlook, mixedDirection, MASTERED_BOX, MAX_LEARNING } from '../learning/scheduler'
import type { ColumnProgress } from '../learning/scheduler'
import { fluencyLimits } from '../learning/progress'
import { useStats } from './useStats'
import type { BoxMove } from './useStats'
import { useSetup } from './useSetup'
import { useSession } from './useSession'
import type { SessionHelpers } from './useSession'

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

  // short message at the bottom of the screen, instead of alert()
  const notice = ref('')
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  function notify(text: string): void {
    notice.value = text
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => { notice.value = '' }, 4000)
  }

  const scriptsInPlay = computed(() => setup.selectorScripts.value.map(([script]) => script))

  function smartPicks() {
    // new kana come from the selection, or from the whole table in order when nothing is selected
    const selected = setup.buildPairsFromSelected()
    const candidates = selected.length > 0 ? selected : setup.selectorScripts.value.flatMap(([script, data]) =>
      Object.values(data).flatMap(cols => cols.flatMap(col => col.kana.map((k, i) => ({ kana: k, romaji: col.romaji[i], script })))))
    return pickSmart(stats.statsData.value, stats.answerLog.value, candidates, scriptsInPlay.value, setup.smartSize.value, Date.now(), setup.smartNew.value)
  }

  const smartSummary = computed(() => {
    const p = smartPicks()
    const now = Date.now()
    const inPlay = Object.values(stats.statsData.value).filter(e => scriptsInPlay.value.includes(e.script) && e.correct + e.incorrect > 0)
    return {
      due: p.due.length, weak: p.weak.length, fresh: p.fresh.length, fill: p.fill.length,
      nextNew: p.fresh.map(x => x.kana),
      fromSelection: setup.selectedCount.value > 0,
      outlook: dueOutlook(stats.statsData.value, scriptsInPlay.value, now),
      mastered: inPlay.filter(e => e.box >= MASTERED_BOX).length,
      seen: inPlay.length,
      // the scheduler holds new kana back while too many are shaky, say so instead of just showing none
      newHeldBack: setup.smartNew.value > 0 && inPlay.filter(e => e.box <= 1).length >= MAX_LEARNING,
    }
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
      mastered: all.filter(e => e.box >= MASTERED_BOX).length,
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
      if (s.col === 'box')    return sign * (a.box - b.box || a.due - b.due)
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

  function helpers(pool: KanaPair[]): SessionHelpers {
    const data = stats.statsData.value
    const known = new Set([
      ...Object.values(data).filter(e => e.correct + e.incorrect > 0).map(e => e.kana),
      ...pool.map(p => p.kana),
    ])
    return {
      distractorsFor: confusedWith,
      directionFor: (pair, canDraw) => mixedDirection(stats.statsData.value[pair.kana], canDraw),
      known,
    }
  }

  // how each kana's Leitner box moved this round, first "from" and latest "to"
  const roundMoves = ref<Record<string, BoxMove>>({})

  function record(a: AnswerInput): void {
    const move = stats.recordAnswer(a)
    const prev = roundMoves.value[a.kana]
    roundMoves.value[a.kana] = { from: prev?.from ?? move.from, to: move.to }
  }

  const roundOutcome = computed(() => {
    const moves = Object.entries(roundMoves.value)
    const outlook = dueOutlook(stats.statsData.value, scriptsInPlay.value, Date.now())
    return {
      up: moves.filter(([, m]) => m.to > m.from).map(([k, m]) => ({ kana: k, box: m.to })),
      down: moves.filter(([, m]) => m.to < m.from).map(([k]) => k),
      mastered: moves.filter(([, m]) => m.from < MASTERED_BOX && m.to >= MASTERED_BOX).map(([k]) => k),
      outlook,
    }
  })

  function beforeStart(): void {
    roundMoves.value = {}
    session.limits.value = fluencyLimits(stats.statsData.value)
  }

  function beginSession(pool: KanaPair[], total: number, mode: QuizMode, errorMode: boolean, timed = setup.timed.value): void {
    beforeStart()
    session.timed.value = timed
    session.start(pool, total, mode, errorMode, helpers(pool))
    screen.value = 'quiz'
  }

  // fluency mode: one timer per question, cleared whenever the question changes
  let timer: ReturnType<typeof setTimeout> | undefined
  watch([session.currentQuestion, screen], ([q, s]) => {
    clearTimeout(timer)
    const limit = session.timeLimit.value
    if (!q || s !== 'quiz' || !limit) return
    timer = setTimeout(() => {
      if (screen.value === 'quiz' && session.currentQuestion.value === q) session.timeOut(record)
    }, limit)
  })

  function startSmartPractice(): void {
    replay = startSmartPractice
    const picks = smartPicks()
    const items = orderSession(picks)
    if (items.length === 0) { notify('Nothing to practice yet. Pick some columns below.'); return }
    beforeStart()
    session.timed.value = setup.timed.value
    session.startPlanned(items, setup.quizMode.value, helpers(items.map(i => i.pair)))
    screen.value = 'quiz'
  }

  function startPatternPractice(p: Pattern): void {
    if (p.practice.length === 0) return
    replay = () => startPatternPractice(p)
    beginSession(p.practice, Math.max(p.practice.length, 8), p.mode ?? setup.quizMode.value, false, p.timed ?? setup.timed.value)
  }

  // practice a handful of kana picked by hand, e.g. from the kana chart
  function startKanaPractice(kana: string[]): void {
    const pool = kana.map(pairFor).filter((p): p is KanaPair => !!p)
    if (pool.length === 0) return
    replay = () => startKanaPractice(kana)
    beginSession(pool, Math.max(pool.length * 2, 6), setup.quizMode.value, false)
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

  const weakPool = computed(() => filteredEntries()
    .filter(e => {
      const seen = e.correct + e.incorrect
      return seen > 0 && (e.correct / seen) < 0.8
    })
    .sort((a, b) => {
      const accA = a.correct / (a.correct + a.incorrect)
      const accB = b.correct / (b.correct + b.incorrect)
      return accA - accB
    })
    .map(e => ({ kana: e.kana, romaji: e.romaji, script: e.script })))

  const slowPool = computed(() => filteredEntries()
    .filter(e => e.count > 0 && (e.totalMs / e.count) > 3000)
    .sort((a, b) => (b.totalMs / b.count) - (a.totalMs / a.count))
    .map(e => ({ kana: e.kana, romaji: e.romaji, script: e.script })))

  function startWorstPractice(): void {
    replay = startWorstPractice
    const pool = weakPool.value
    if (pool.length === 0) return
    beginSession(pool, pool.length, setup.quizMode.value, false)
  }

  function startSlowestPractice(): void {
    replay = startSlowestPractice
    const pool = slowPool.value
    if (pool.length === 0) return
    // slow kana are a fluency problem, so this one always runs against the clock
    beginSession(pool, pool.length, setup.quizMode.value, false, true)
  }

  function startQuiz(errorMode: boolean): void {
    replay = () => startQuiz(errorMode)
    let pool
    let total

    if (errorMode) {
      const ep = stats.errorPairs.value
      if (ep.length === 0) return
      // weight by recent errors, not lifetime ones, so old mistakes stop dominating
      pool = ep.flatMap(e =>
        Array.from({ length: Math.min(3, Math.max(1, stats.recentErrorCount(e.kana))) }, () => ({ kana: e.kana, romaji: e.romaji, script: e.script }))
      )
      total = pool.length
    } else {
      pool = setup.buildPairsFromSelected()
      if (pool.length === 0) { notify('Pick at least one column first.'); return }
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
    session.submitTyped(record)
    advanceSoon(350)
  }

  function selectAnswer(chosen: string): void {
    session.selectAnswer(chosen, record)
    advanceSoon(400)
  }

  function submitDrawing(result: DrawResult): void {
    session.submitDrawing(result, record)
    // longer than the others so the finished kana can be compared with the reference
    advanceSoon(1400)
  }

  function giveUp(): void {
    session.giveUp(record)
  }

  // writing from memory on the stroke order tab: a clean result is a real answer
  function recordWritePractice(kana: string, result: DrawResult): void {
    const pair = pairFor(kana)
    if (!pair || !result.correct) return
    stats.recordAnswer({
      ...pair, direction: 'draw', correct: true, given: '', elapsedMs: 0,
      strokes: { errors: result.errors, faults: result.faults },
    })
  }

  function nextQuestion(): void {
    session.next(() => { screen.value = 'results' })
  }

  function restartQuiz(): void {
    replay()
  }

  function goHome(): void {
    const answered = session.correctCount.value + session.wrongCount.value
    if (screen.value === 'quiz' && answered > 0) notify(`Session ended, ${answered} answer${answered === 1 ? '' : 's'} saved`)
    screen.value = 'setup'
    stats.refresh()
  }

  // kana detail sheet, opened from the chart, the stats table and the results
  const detailKana = ref<string | null>(null)
  function openKana(kana: string): void {
    detailKana.value = kana
  }
  function closeKana(): void {
    detailKana.value = null
  }

  function resetAll(): void {
    stats.resetAll()
    notify('All progress deleted')
  }

  function init(): void {
    setup.init()
  }

  return {
    // orchestration
    screen, activeTab, statsFilter, statsSort, notice, notify, detailKana, openKana, closeKana,
    statsSummary, filteredStatsRows, allPatterns, roundPatterns, smartSummary, columnProgressMap, roundOutcome,
    weakPool, slowPool, scriptsInPlay,
    showTab, setStatsFilter, setStatsSort, startQuiz, startWorstPractice, startSlowestPractice, startPatternPractice, startSmartPractice, startKanaPractice,
    submitTyped, selectAnswer, submitDrawing, giveUp, recordWritePractice, nextQuestion, restartQuiz, goHome, resetAll, init,
    // stats
    statsData:          stats.statsData,
    answerLog:          stats.answerLog,
    errorPairs:         stats.errorPairs,
    maxErrorCount:      stats.maxErrorCount,
    errorTabCount:      stats.errorTabCount,
    statsTabCount:      stats.statsTabCount,
    errorKanaSet:       stats.errorKanaSet,
    today:              stats.today,
    resolveErrors:      stats.resolveErrors,
    resolveAllErrors:   stats.resolveAllErrors,
    // setup
    activeScript:       setup.activeScript,
    selectedCols:       setup.selectedCols,
    quizMode:           setup.quizMode,
    timed:              setup.timed,
    toggleTimed:        setup.toggleTimed,
    smartSize:          setup.smartSize,
    smartNew:           setup.smartNew,
    setSmartSize:       setup.setSmartSize,
    setSmartNew:        setup.setSmartNew,
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
    timeLimit:          session.timeLimit,
    gaveUp:             session.gaveUp,
    roundSummary:       session.roundSummary,
  }
}

export type QuizContext = ReturnType<typeof useQuiz>
export const QUIZ_KEY: InjectionKey<QuizContext> = Symbol('quiz')
