import { ref, computed, effectScope } from 'vue'
import type {
  KanjiAnswerRecord, KanjiCard, KanjiEntry, KanjiMode, KanjiQuestionType, KanjiSort, KanjiSortCol, KanjiStatEntry, KanjiStatsMap,
} from '../types'
import { allKanji, kanjiEntry, kanjiLookalikes, kanjiSets, tooClose } from '../data/kanjiData'
import { applyKanjiAnswer, confusedKanji, normalizeKanjiStats } from '../learning/kanjiStats'
import { planKanji, pickedKanjiIds, errorPracticeIds, singleKanjiOrder, CARDS_PER_NEW } from '../learning/kanjiPlan'
import { kanjiQuestionType, makeKanjiCard, noteResult, pickKanjiOptions, summarizeRound, resultScore, resultLabel, splitMoves } from '../learning/kanjiQuiz'
import type { RoundResults } from '../learning/kanjiQuiz'
import { kanjiRow, openKanjiErrors, sortKanjiRows } from '../learning/kanjiProgress'
import { orderSession, planReask, dueOutlook, columnProgress, isSeen, MASTERED_BOX } from '../learning/scheduler'
import type { ColumnProgress } from '../learning/scheduler'
import { shuffle } from '../learning/distractors'
import { KANJI_ANSWERS_KEY, KANJI_STATS_KEY, kanjiId } from '../kanjiKeys'
import { kanjiScreen, kanjiRevision, closeKanji, loadKanjiPrefs, saveKanjiPrefs, onKanjiReset, readJson, writeJson } from '../kanjiShell'
import { countAnswer } from '../days'
import { clock } from '../clock'
import { accuracy } from '../format'
import type { BoxMove } from './useStats'

const MAX_ANSWERS = 1000

const loadStats = () => normalizeKanjiStats(readJson(KANJI_STATS_KEY))

function loadLog(): KanjiAnswerRecord[] {
  const raw = readJson(KANJI_ANSWERS_KEY)
  return Array.isArray(raw) ? raw : []
}

/** The course entries of the kanji the course has, the rest is left out. */
export function courseEntries(kanji: string[]): KanjiEntry[] {
  return kanji.map(kanjiEntry).filter((entry): entry is KanjiEntry => !!entry)
}

function createKanji() {
  const sets = kanjiSets()
  const prefs = loadKanjiPrefs()
  const mode = ref<KanjiMode>(prefs.mode ?? 'mixed')
  const smartSize = ref(prefs.smartSize ?? 20)
  const smartNew = ref(prefs.smartNew ?? 3)
  // sets picked for the custom quiz, they also decide where new kanji come from
  const pickedSets = ref(new Set((prefs.sets ?? []).filter(id => sets.some(s => s.id === id))))

  const stats = ref<KanjiStatsMap>(loadStats())
  const log = ref<KanjiAnswerRecord[]>(loadLog())

  const kanjiList = allKanji()
  const kanjiIds = kanjiList.map(k => k.id)
  const byId = new Map(kanjiList.map(k => [k.id, k]))

  const statOf = (kanji: string): KanjiStatEntry | undefined => stats.value[kanjiId(kanji)]

  // every write goes through here, so the shell's counts read storage again
  function saveStats(data: KanjiStatsMap): void {
    writeJson(KANJI_STATS_KEY, data)
    stats.value = data
    kanjiRevision.value++
  }

  const planAt = (now: number) => {
    const newIds = pickedSets.value.size ? pickedKanjiIds(sets, pickedSets.value) : kanjiIds
    return planKanji(stats.value, log.value, kanjiIds, smartSize.value, now, smartNew.value, newIds)
  }
  const plan = computed(() => planAt(clock.value))

  const seenStats = computed(() => kanjiIds.map(id => stats.value[id]).filter(isSeen))

  const summary = computed(() => {
    const p = plan.value
    const seen = seenStats.value
    const correct = seen.reduce((n, stat) => n + stat.correct, 0)
    const incorrect = seen.reduce((n, stat) => n + stat.incorrect, 0)
    return {
      total: kanjiIds.length,
      seen: seen.length,
      mastered: seen.filter(stat => stat.box >= MASTERED_BOX).length,
      accuracy: `${accuracy({ correct, incorrect })}%`,
      weak: p.weak.length, fresh: p.fresh.length, fill: p.fill.length,
      cards: p.due.length + p.weak.length + p.fill.length + p.fresh.length * CARDS_PER_NEW,
      nextNew: p.fresh.map(id => byId.get(id)!.kanji),
      fromSelection: pickedSets.value.size > 0,
      outlook: dueOutlook(seen, clock.value),
      newBlocked: p.newBlocked,
    }
  })

  // seen, mastered and due per set, for the bars in the set picker
  const progressBySet = computed(() => {
    const now = clock.value
    const out: Record<string, ColumnProgress> = {}
    for (const s of sets) out[s.id] = columnProgress(s.kanji.map(kanjiId), stats.value, now)
    return out
  })

  function setMode(m: KanjiMode): void {
    mode.value = m
    saveKanjiPrefs({ mode: m })
  }

  function setSmartSize(n: number): void {
    smartSize.value = n
    saveKanjiPrefs({ smartSize: n })
  }

  function setSmartNew(n: number): void {
    smartNew.value = n
    saveKanjiPrefs({ smartNew: n })
  }

  function pickSets(ids: string[]): void {
    pickedSets.value = new Set(ids)
    saveKanjiPrefs({ sets: ids })
  }

  function toggleSet(id: string): void {
    const next = new Set(pickedSets.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    // stored in course order, not in the order they were tapped
    pickSets(sets.filter(s => next.has(s.id)).map(s => s.id))
  }

  const selectAllSets = () => pickSets(sets.map(s => s.id))
  const selectNoneSets = () => pickSets([])

  // --- progress ---

  const openErrors = computed(() => openKanjiErrors(stats.value, log.value, kanjiIds).map(stat => ({ ...stat, entry: byId.get(stat.id)! })))
  const errorIds = computed(() => new Set(openErrors.value.map(e => e.id)))
  const hasError = (kanji: string) => errorIds.value.has(kanjiId(kanji))

  // resolving only hides an error, boxes and counts stay
  function resolveErrors(ids: string[]): void {
    const data = loadStats()
    const now = Date.now()
    for (const id of ids) if (data[id]) data[id].resolvedAt = now
    saveStats(data)
  }

  const resolveAllErrors = () => resolveErrors(openErrors.value.map(e => e.id))

  const tableSort = ref<KanjiSort | null>(null)

  function setTableSort(col: KanjiSortCol): void {
    const s = tableSort.value
    if (s?.col === col) tableSort.value = { col, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    // errors go worst first on the first tap, like the kana table
    else tableSort.value = { col, dir: col === 'errors' ? 'desc' : 'asc' }
  }

  const rows = computed(() => sortKanjiRows(seenStats.value.map(stat => kanjiRow(byId.get(stat.id)!, stat)), tableSort.value))

  // set by the errors tile on the Practice tab, the Progress tab scrolls to its list and clears it
  const errorsScrollPending = ref(false)

  // --- session ---

  const cards = ref<KanjiCard[]>([])
  const current = ref(0)
  const answered = ref(false)
  const pickedOption = ref<string | null>(null)  // the option chosen on the current card
  const gaveUp = ref(false)
  const correctCount = ref(0)
  const wrongCount = ref(0)
  const startedAt = ref(0)
  const results = ref<RoundResults>({})
  const moves = ref<Record<string, BoxMove>>({})
  let questionStart = 0
  let reasked: Record<string, number> = {}
  // kanji the learner has met, the session's own included, for the wrong options
  let known = new Set<string>()

  const card = computed(() => cards.value[current.value] ?? null)
  const progress = computed(() => cards.value.length ? (current.value / cards.value.length) * 100 : 0)

  function buildCard(entry: KanjiEntry, type: KanjiQuestionType): KanjiCard {
    const preferred = [...confusedKanji(stats.value[entry.id]).map(c => c.kanji), ...kanjiLookalikes(entry.kanji)]
    return makeKanjiCard(entry, type, pickKanjiOptions(entry, kanjiList, preferred, known, tooClose))
  }

  const cardFor = (entry: KanjiEntry) => buildCard(entry, kanjiQuestionType(stats.value[entry.id], mode.value))

  function resetCard(): void {
    answered.value = false
    pickedOption.value = null
    gaveUp.value = false
    questionStart = Date.now()
  }

  function begin(items: Array<{ id: string; intro: boolean }>): void {
    const knownIds = [...seenStats.value.map(stat => stat.id), ...items.map(i => i.id)]
    known = new Set(knownIds.map(id => byId.get(id)!.kanji))
    reasked = {}
    moves.value = {}
    results.value = {}
    correctCount.value = 0
    wrongCount.value = 0
    cards.value = items.map(i => {
      const entry = byId.get(i.id)!
      return i.intro ? { id: entry.id, kanji: entry.kanji, type: 'intro', options: [] } : cardFor(entry)
    })
    current.value = 0
    startedAt.value = Date.now()
    resetCard()
    kanjiScreen.value = 'quiz'
  }

  const questionsOnly = (ids: string[]) => ids.map(id => ({ id, intro: false }))

  // what the first button on the results screen repeats
  let lastStart: () => boolean = startSmart
  const restartLabel = ref('Keep going')

  function remember(start: () => boolean, label: string): void {
    lastStart = start
    restartLabel.value = label
  }

  /** False when there is nothing to practice. */
  function startSmart(): boolean {
    const items = orderSession(planAt(Date.now()))
    if (items.length === 0) return false
    remember(startSmart, 'Keep going')
    begin(items.map(i => ({ id: i.pair, intro: i.intro })))
    return true
  }

  // every kanji of the picked sets once, no intro, a kanji not met yet is asked like any other
  function startCustom(): boolean {
    const ids = shuffle(pickedKanjiIds(sets, pickedSets.value))
    if (ids.length === 0) return false
    remember(startCustom, 'Again')
    begin(questionsOnly(ids))
    return true
  }

  function startErrors(): boolean {
    const ids = errorPracticeIds(openErrors.value, log.value)
    if (ids.length === 0) return false
    remember(startErrors, 'Again')
    begin(questionsOnly(ids))
    return true
  }

  // from the kanji sheet: this one kanji, with kanji the learner knows in between.
  // One never met gets its intro card first, like in smart practice.
  function startKanji(kanji: string): boolean {
    const id = kanjiId(kanji)
    const start = () => {
      const intro = isSeen(stats.value[id]) ? [] : [{ id, intro: true }]
      begin([...intro, ...questionsOnly(singleKanjiOrder(id, seenStats.value.map(stat => stat.id)))])
      return true
    }
    remember(start, 'Again')
    return start()
  }

  // the last kind of session again, smart practice when that has nothing left, home when neither has
  function restart(): void {
    if (lastStart() || startSmart()) return
    goHome()
  }

  /** Applies the answer to the stored stats and the log, returns how the box moved. */
  function saveAnswer(id: string, type: KanjiQuestionType, correct: boolean, given: string, holdBox: boolean): BoxMove {
    const now = Date.now()
    const ms = now - questionStart
    // read storage again, another tab may have written in between
    const data = loadStats()
    const from = data[id]?.box ?? 0
    data[id] = applyKanjiAnswer(data[id], { id, type, correct, given, ms, holdBox }, now)
    saveStats(data)

    const nextLog = loadLog()
    nextLog.push({ id, type, correct, given, ms, t: now })
    if (nextLog.length > MAX_ANSWERS) nextLog.splice(0, nextLog.length - MAX_ANSWERS)
    writeJson(KANJI_ANSWERS_KEY, nextLog)
    log.value = nextLog

    countAnswer(now)
    return { from, to: data[id].box }
  }

  function record(id: string, type: KanjiQuestionType, correct: boolean, given: string): void {
    // right on the re-ask, seconds after seeing the answer, is no reason to promote
    const move = saveAnswer(id, type, correct, given, correct && !!results.value[id]?.missed)
    const prev = moves.value[id]
    moves.value = { ...moves.value, [id]: { from: prev?.from ?? move.from, to: move.to } }
    results.value = noteResult(results.value, id, correct)
    if (correct) correctCount.value++
    else wrongCount.value++
  }

  // a missed kanji comes back a few cards later, in the type that was missed
  function queueReask(id: string, type: KanjiQuestionType): void {
    const qs = cards.value
    const asked = qs.filter(x => x.type !== 'intro')
    const slot = planReask(qs.map(x => x.id), current.value, id, asked.map(x => x.id), reasked[id] ?? 0)
    if (!slot) return
    reasked[id] = (reasked[id] ?? 0) + 1
    const padding = slot.pad.map(p => cardFor(byId.get(p)!))
    qs.splice(slot.index, 0, ...padding, { ...buildCard(byId.get(id)!, type), reask: true })
  }

  function answer(given: string | null): void {
    const c = card.value
    if (!c || c.type === 'intro' || answered.value) return
    answered.value = true
    pickedOption.value = given
    gaveUp.value = given === null
    const correct = given === c.kanji
    record(c.id, c.type, correct, given ? kanjiId(given) : '')
    if (!correct) {
      queueReask(c.id, c.type)
      return
    }
    // on to the next card shortly, unless Next was pressed first
    const session = startedAt.value
    const at = current.value
    setTimeout(() => {
      if (kanjiScreen.value === 'quiz' && startedAt.value === session && current.value === at) next()
    }, 400)
  }

  const choose = (kanji: string) => answer(kanji)
  const giveUp = () => answer(null)

  function next(): void {
    current.value++
    if (current.value >= cards.value.length) kanjiScreen.value = 'results'
    else resetCard()
  }

  // leaving keeps the session, resume() picks it up again
  function goHome(): void {
    kanjiScreen.value = 'setup'
  }

  function resume(): void {
    if (!startedAt.value || current.value >= cards.value.length) return
    // a sheet left open would sit over the quiz while its keys answer behind it
    closeKanji()
    questionStart = Date.now()
    kanjiScreen.value = 'quiz'
  }

  const roundSummary = computed(() => summarizeRound(results.value))
  const score = computed(() => resultScore(roundSummary.value))
  const label = computed(() => resultLabel(roundSummary.value))

  const missed = computed(() => Object.entries(results.value)
    .filter(([, r]) => r.missed)
    .map(([id]) => byId.get(id)!))

  const roundOutcome = computed(() => {
    const { up, down, mastered } = splitMoves(moves.value)
    const kanji = (ids: string[]) => ids.map(id => byId.get(id)!.kanji)
    return { up: kanji(up), down: kanji(down), mastered: kanji(mastered), outlook: summary.value.outlook }
  })

  // Reset in the settings: kanjiShell has wiped storage, drop what is held here too
  onKanjiReset(() => {
    stats.value = {}
    log.value = []
    cards.value = []
    results.value = {}
    moves.value = {}
    startedAt.value = 0
  })

  return {
    sets, mode, setMode, smartSize, smartNew, setSmartSize, setSmartNew,
    pickedSets, toggleSet, selectAllSets, selectNoneSets,
    statOf, hasError, summary, progressBySet,
    openErrors, resolveErrors, resolveAllErrors, rows, tableSort, setTableSort, errorsScrollPending,
    cards, current, card, answered, pickedOption, gaveUp, correctCount, wrongCount, startedAt, progress,
    startSmart, startCustom, startErrors, startKanji, restart, restartLabel,
    choose, giveUp, next, goHome, resume,
    resultScore: score, resultLabel: label, missed, roundOutcome,
  }
}

let instance: ReturnType<typeof createKanji> | null = null

/**
 * One instance for the whole app, made on first use inside the kanji chunk. Its computeds
 * live in a detached scope, so they keep working when the component that called first unmounts.
 */
export function useKanji() {
  return instance ??= effectScope(true).run(createKanji)!
}
