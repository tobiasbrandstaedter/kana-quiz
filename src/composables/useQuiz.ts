import { ref, computed, watch } from 'vue'
import type { InjectionKey } from 'vue'
import type { AppScreen, SetupTab, StatsSort, StatsSortCol, StatRow, TimeClass, KanaPair, QuizMode, DrawResult, AnswerInput } from '../types'
import { pairFor, kanaForRomaji } from '../data/kana'
import { detectPatterns, statsFromLog } from '../learning/patterns'
import type { Pattern } from '../learning/patterns'
import { pickSmart, orderSession, columnProgress, dueOutlook, mixedDirection, isSeen, MASTERED_BOX, MAX_LEARNING } from '../learning/scheduler'
import type { ColumnProgress, PlannedItem } from '../learning/scheduler'
import { fluencyLimits, dayKey } from '../learning/progress'
import { shuffle } from '../learning/distractors'
import { accuracy, accClass } from '../format'
import { clock } from '../clock'
import { useStats } from './useStats'
import type { BoxMove } from './useStats'
import { useSetup } from './useSetup'
import { useSession } from './useSession'
import type { SessionHelpers } from './useSession'

export function useQuiz() {
  const screen = ref<AppScreen>('setup')
  const activeTab = ref<SetupTab>('practice')
  const statsSort = ref<StatsSort | null>(null)

  const stats = useStats()
  const setup = useSetup()
  const session = useSession()

  // what the first button on the results screen runs, and what it is called
  let replay: () => void = () => startQuiz(false)
  const replayLabel = ref('Again')
  function remember(run: () => void, label = 'Again'): void {
    replay = run
    replayLabel.value = label
  }

  // short message at the bottom of the screen, instead of alert()
  const notice = ref('')
  // optional button on the toast, e.g. to take back what it reports
  const noticeAction = ref<{ label: string; run: () => void } | null>(null)
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  function notify(text: string, action: { label: string; run: () => void } | null = null): void {
    notice.value = text
    noticeAction.value = action
    clearTimeout(noticeTimer)
    // a toast with a button stays longer, it has to be read and reached
    noticeTimer = setTimeout(() => { notice.value = '' }, action ? 7000 : 4000)
  }

  function runNoticeAction(): void {
    noticeAction.value?.run()
    notice.value = ''
  }

  const scriptsInPlay = computed(() => setup.selectorScripts.value.map(([script]) => script))

  // open errors follow the script toggle, like the tiles and the chart next to them
  const openErrors = computed(() => stats.errorPairs.value.filter(e => scriptsInPlay.value.includes(e.script)))

  function resolveAllErrors(): void {
    stats.resolveErrors(openErrors.value.map(e => e.kana))
  }

  function pairsInPlay(): KanaPair[] {
    return setup.selectorScripts.value.flatMap(([script, data]) =>
      Object.values(data).flatMap(cols => cols.flatMap(col => col.kana.map((k, i) => ({ kana: k, romaji: col.romaji[i], script })))))
  }

  function smartPicks(at: number) {
    // new kana come from the selection, or from the whole table in order when nothing is selected
    const selected = setup.buildPairsFromSelected()
    const candidates = selected.length > 0 ? selected : pairsInPlay()
    return pickSmart(stats.statsData.value, stats.answerLog.value, candidates, scriptsInPlay.value, setup.smartSize.value, at, setup.smartNew.value)
  }

  // why a session brings no new kana although some are left, so the hero can say it
  function newBlocked(freshCount: number, learning: number): 'off' | 'rows' | 'cap' | null {
    const isNew = (p: KanaPair) => !isSeen(stats.statsData.value[p.kana])
    if (freshCount > 0 || !pairsInPlay().some(isNew)) return null
    if (setup.smartNew.value === 0) return 'off'
    const selected = setup.buildPairsFromSelected()
    if (selected.length > 0 && !selected.some(isNew)) return 'rows'
    return learning >= MAX_LEARNING ? 'cap' : null
  }

  const smartSummary = computed(() => {
    const now = clock.value
    const p = smartPicks(now)
    const inPlay = Object.values(stats.statsData.value).filter(e => scriptsInPlay.value.includes(e.script) && isSeen(e))
    return {
      total: pairsInPlay().length,
      due: p.due.length, weak: p.weak.length, fresh: p.fresh.length, fill: p.fill.length,
      // what the session counter will show: every review once, a new kana as intro plus two tests
      cards: p.due.length + p.weak.length + p.fill.length + p.fresh.length * 3,
      nextNew: p.fresh.map(x => x.kana),
      fromSelection: setup.selectedCount.value > 0,
      outlook: dueOutlook(stats.statsData.value, scriptsInPlay.value, now),
      mastered: inPlay.filter(e => e.box >= MASTERED_BOX).length,
      seen: inPlay.length,
      newBlocked: newBlocked(p.fresh.length, inPlay.filter(e => e.box <= 1).length),
    }
  })

  const columnProgressMap = computed(() => {
    const now = clock.value
    const out: Record<string, ColumnProgress> = {}
    for (const [, data] of setup.selectorScripts.value)
      for (const cols of Object.values(data))
        for (const col of cols) out[col.id] = columnProgress(col.kana, stats.statsData.value, now)
    return out
  })

  // the whole Progress tab follows the script toggle: cards, chart, errors, table and the pools
  const entriesInPlay = computed(() => Object.values(stats.statsData.value).filter(e => scriptsInPlay.value.includes(e.script)))

  const statsSummary = computed(() => {
    const all = entriesInPlay.value
    const correct = all.reduce((s, e) => s + e.correct, 0)
    const incorrect = all.reduce((s, e) => s + e.incorrect, 0)
    return {
      kanaCount: all.length,
      mastered: all.filter(e => e.box >= MASTERED_BOX).length,
      accuracy: `${accuracy({ correct, incorrect })}%`,
    }
  })

  const filteredStatsRows = computed((): StatRow[] => {
    const mapped: StatRow[] = entriesInPlay.value.map(e => {
      const acc = accuracy(e)
      const avgTime  = e.count > 0 ? (e.totalMs / e.count / 1000).toFixed(1) : null
      const timeClass: TimeClass = avgTime === null ? '' : parseFloat(avgTime) < 3 ? 'fast' : parseFloat(avgTime) < 6 ? 'ok' : 'slow'
      return { ...e, seen: e.correct + e.incorrect, acc, accClass: accClass(acc), avgTime, timeClass }
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
      ...Object.values(data).filter(isSeen).map(e => e.kana),
      ...pool.map(p => p.kana),
    ])
    return {
      distractorsFor: confusedWith,
      directionFor: pair => mixedDirection(stats.statsData.value[pair.kana]),
      known,
    }
  }

  // how each kana's Leitner box moved this round, first "from" and latest "to"
  const roundMoves = ref<Record<string, BoxMove>>({})
  let missedThisRound = new Set<string>()

  function record(a: AnswerInput): void {
    if (!a.correct) missedThisRound.add(a.kana)
    // right on the re-ask, seconds after seeing the answer, is no reason to promote
    const move = stats.recordAnswer({ ...a, holdBox: a.correct && missedThisRound.has(a.kana) })
    const prev = roundMoves.value[a.kana]
    roundMoves.value[a.kana] = { from: prev?.from ?? move.from, to: move.to }
  }

  const roundOutcome = computed(() => {
    const moves = Object.entries(roundMoves.value)
    const outlook = dueOutlook(stats.statsData.value, scriptsInPlay.value, clock.value)
    return {
      up: moves.filter(([, m]) => m.to > m.from).map(([k, m]) => ({ kana: k, box: m.to })),
      down: moves.filter(([, m]) => m.to < m.from).map(([k]) => k),
      mastered: moves.filter(([, m]) => m.from < MASTERED_BOX && m.to >= MASTERED_BOX).map(([k]) => k),
      outlook,
    }
  })

  function beforeStart(): void {
    roundMoves.value = {}
    missedThisRound = new Set()
    session.limits.value = fluencyLimits(stats.statsData.value)
  }

  function beginSession(pool: KanaPair[], total: number, mode: QuizMode, errorMode: boolean, timed = setup.timed.value): void {
    beforeStart()
    session.timed.value = timed
    session.start(pool, total, mode, errorMode, helpers(pool))
    screen.value = 'quiz'
  }

  // a session whose cards are already in order
  function beginPlanned(items: PlannedItem[]): void {
    beforeStart()
    session.timed.value = setup.timed.value
    session.startPlanned(items, setup.quizMode.value, helpers(items.map(i => i.pair)))
    screen.value = 'quiz'
  }

  // fluency mode: one timer per question, cleared whenever the question changes
  let timer: ReturnType<typeof setTimeout> | undefined
  // bumped whenever the clock starts over on the same card, so the countdown bar can follow
  const timerRun = ref(0)
  function armTimer(): void {
    clearTimeout(timer)
    const q = session.currentQuestion.value
    const limit = session.timeLimit.value
    if (!q || screen.value !== 'quiz' || !limit || session.answered.value) return
    timer = setTimeout(() => {
      if (screen.value === 'quiz' && session.currentQuestion.value === q) session.timeOut(record)
    }, limit)
  }
  watch([session.currentQuestion, screen], armTimer)

  // a locked phone or another app is not a slow answer: stop the clock, start it over on return
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(timer); return }
    if (screen.value !== 'quiz' || session.answered.value) return
    session.questionStartTime.value = Date.now()
    timerRun.value++
    armTimer()
  })

  function startSmartPractice(): void {
    remember(startSmartPractice, 'Keep going')
    const picks = smartPicks(Date.now())
    const items = orderSession(picks)
    if (items.length === 0) { notify('Nothing to practice yet. Pick some columns below.'); return }
    beginPlanned(items)
  }

  function startPatternPractice(p: Pattern): void {
    if (p.practice.length === 0) return
    remember(() => startPatternPractice(p))
    beginSession(p.practice, Math.max(p.practice.length, 8), p.mode ?? setup.quizMode.value, false, p.timed ?? setup.timed.value)
  }

  // practice a handful of kana picked by hand, e.g. from the kana chart
  function startKanaPractice(kana: string[]): void {
    const pool = kana.map(pairFor).filter((p): p is KanaPair => !!p)
    if (pool.length === 0) return
    remember(() => startKanaPractice(kana))
    if (pool.length > 1) { beginSession(pool, Math.max(pool.length * 2, 6), setup.quizMode.value, false); return }
    // one kana alone would be the same card six times: ask it three times,
    // each followed by a kana the learner knows from that script
    const [only] = pool
    const known = shuffle(Object.values(stats.statsData.value).filter(e => isSeen(e) && e.script === only.script && e.kana !== only.kana))
    const cards = [0, 1, 2].flatMap(i => known[i] ? [only, { kana: known[i].kana, romaji: known[i].romaji, script: known[i].script }] : [only])
    beginPlanned(cards.map(pair => ({ pair, intro: false })))
  }

  function showTab(tab: SetupTab): void {
    activeTab.value = tab
  }

  function setStatsSort(col: StatsSortCol): void {
    if (statsSort.value?.col === col) {
      statsSort.value = { col, dir: statsSort.value.dir === 'asc' ? 'desc' : 'asc' }
    } else {
      // errors and time default desc so worst/slowest appear on top on first click
      statsSort.value = { col, dir: col === 'errors' || col === 'time' ? 'desc' : 'asc' }
    }
  }

  const weakPool = computed(() => entriesInPlay.value
    .filter(e => isSeen(e) && accuracy(e) < 80)
    .sort((a, b) => accuracy(a) - accuracy(b))
    .map(e => ({ kana: e.kana, romaji: e.romaji, script: e.script })))

  // one slow answer says little, three timed ones do
  const slowPool = computed(() => entriesInPlay.value
    .filter(e => e.count >= 3 && (e.totalMs / e.count) > 3000)
    .sort((a, b) => (b.totalMs / b.count) - (a.totalMs / a.count))
    .map(e => ({ kana: e.kana, romaji: e.romaji, script: e.script })))

  function startWorstPractice(): void {
    remember(startWorstPractice)
    const pool = weakPool.value
    if (pool.length === 0) return
    beginSession(pool, pool.length, setup.quizMode.value, false)
  }

  function startSlowestPractice(): void {
    remember(startSlowestPractice)
    const pool = slowPool.value
    if (pool.length === 0) return
    // slow kana are a fluency problem, so this one always runs against the clock
    beginSession(pool, pool.length, setup.quizMode.value, false, true)
  }

  function startQuiz(errorMode: boolean): void {
    remember(() => startQuiz(errorMode))
    let pool
    let total

    if (errorMode) {
      const ep = openErrors.value
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
    const id = session.startedAt.value
    const at = session.current.value
    // the session check matters when one is left and the next started within that moment
    setTimeout(() => {
      if (screen.value === 'quiz' && session.startedAt.value === id && session.current.value === at) nextQuestion()
    }, ms)
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

  /**
   * Writing from memory on the Writing tab: a clean result is a real answer, within limits.
   * A kana that isn't part of practice yet stays out, it should still get its intro card.
   * One write per kana and day counts, so "Again" can't pile up right answers.
   * `peeked` (the kana was on screen just before) is saved but can't move the kana up.
   */
  function recordWritePractice(kana: string, result: DrawResult, peeked: boolean): 'saved' | 'repeat' | 'new' | null {
    const pair = pairFor(kana)
    if (!pair || !result.correct) return null
    if (!isSeen(stats.statsData.value[kana])) return 'new'
    const today = dayKey(Date.now())
    // answers from this tab are the draw records without a time
    if (stats.answerLog.value.some(r => r.kana === kana && r.direction === 'draw' && r.correct && r.ms === 0 && dayKey(r.t) === today)) return 'repeat'
    stats.recordAnswer({
      ...pair, direction: 'draw', correct: true, given: '', elapsedMs: 0, holdBox: peeked,
      strokes: { errors: result.errors, faults: result.faults },
    })
    return 'saved'
  }

  function nextQuestion(): void {
    session.next(() => { screen.value = 'results' })
  }

  function restartQuiz(): void {
    const before = session.startedAt.value
    replay()
    // errors fixed, kana sped up: the pool of the last session can be empty by now
    if (session.startedAt.value === before) startSmartPractice()
    if (session.startedAt.value === before) screen.value = 'setup'
  }

  function goHome(): void {
    if (screen.value === 'quiz') {
      const answered = session.correctCount.value + session.wrongCount.value
      const id = session.startedAt.value
      // the x is one tap in a corner, so leaving can be taken back for a moment
      notify(answered ? `Session ended, ${answered} answer${answered === 1 ? '' : 's'} saved` : 'Session ended', {
        label: 'Resume',
        run: () => {
          if (session.startedAt.value !== id) return
          session.questionStartTime.value = Date.now()
          screen.value = 'quiz'
        },
      })
    }
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
    screen, activeTab, statsSort, notice, noticeAction, runNoticeAction, detailKana, openKana, closeKana, timerRun,
    statsSummary, filteredStatsRows, allPatterns, roundPatterns, smartSummary, columnProgressMap, roundOutcome,
    weakPool, slowPool, replayLabel,
    showTab, setStatsSort, startQuiz, startWorstPractice, startSlowestPractice, startPatternPractice, startSmartPractice, startKanaPractice,
    submitTyped, selectAnswer, submitDrawing, giveUp, recordWritePractice, nextQuestion, restartQuiz, goHome, resetAll, init,
    // stats
    statsData:          stats.statsData,
    errorPairs:         openErrors,
    resolveAllErrors,
    kanaTracked:        stats.kanaTracked,
    errorKanaSet:       stats.errorKanaSet,
    today:              stats.today,
    resolveErrors:      stats.resolveErrors,
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
    theme:              setup.theme,
    selectorScripts:    setup.selectorScripts,
    selectedCount:      setup.selectedCount,
    activeCols:         setup.activeCols,
    pickedCols:         setup.pickedCols,
    countHint:          setup.countHint,
    setKanaFont:        setup.setKanaFont,
    setTheme:           setup.setTheme,
    setScript:          setup.setScript,
    toggleCol:          setup.toggleCol,
    selectAll:          setup.selectAll,
    selectNone:         setup.selectNone,
    selectGroup:        setup.selectGroup,
    setMode:            setup.setMode,
    // session
    questions:          session.questions,
    current:            session.current,
    startedAt:          session.startedAt,
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
    typoRetry:          session.typoRetry,
  }
}

export type QuizContext = ReturnType<typeof useQuiz>
export const QUIZ_KEY: InjectionKey<QuizContext> = Symbol('quiz')
