import { ref, computed, effectScope } from 'vue'
import type {
  ItemInfo, KanjiAnswerInput, KanjiAnswerRecord, KanjiCard, KanjiMode, KanjiSort, KanjiSortCol, KanjiStatEntry, KanjiStatsMap, QuestionType,
} from '../types'
import { allKanji, groupById, kanjiSets } from '../data/kanjiData'
import { applyKanjiAnswer, normalizeKanjiStats } from '../learning/kanjiStats'
import {
  planKanji, planCards, pickedKanjiIds, pickedWordIds, errorPracticeIds, singleKanjiOrder, wordLock, groupLock,
} from '../learning/kanjiPlan'
import { orderKanjiSession, readyCard } from '../learning/kanjiSession'
import type { PlannedCard } from '../learning/kanjiSession'
import { noteResult, summarizeRound, resultScore, resultLabel, splitMoves } from '../learning/kanjiQuiz'
import type { RoundResults } from '../learning/kanjiQuiz'
import { itemInfo, itemOrder, makeCard, storedAnswer, wordReadingMistake, wordTypedVerdict, PATTERN_COURSE, PLAN_COURSE } from '../learning/kanjiCards'
import { detectKanjiPatterns, kanjiStatsFromLog, patternCards } from '../learning/kanjiPatterns'
import type { KanjiPattern } from '../learning/kanjiPatterns'
import { cleanTyped, hasKanji } from '../learning/kanaInput'
import type { ReadingMistake, TypedVerdict } from '../learning/readings'
import { isWordType } from '../learning/wordQuiz'
import { itemRow, openKanjiErrors, sortKanjiRows } from '../learning/kanjiProgress'
import { planReask, dueOutlook, columnProgress, isSeen, MASTERED_BOX } from '../learning/scheduler'
import type { ColumnProgress } from '../learning/scheduler'
import { shuffle } from '../learning/distractors'
import { KANJI_ANSWERS_KEY, KANJI_STATS_KEY, kanjiId, kanjiOfId } from '../kanjiKeys'
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
  const wordIds = PLAN_COURSE.words.map(w => w.id)
  const planWords = new Map(PLAN_COURSE.words.map(w => [w.id, w]))
  const itemIds = [...kanjiIds, ...wordIds]

  /** The stats of a kanji or word, by item id. */
  const statOf = (id: string): KanjiStatEntry | undefined => stats.value[id]
  /** What keeps a word from coming in yet, null once nothing does (KR29). */
  const lockOf = (wordId: string) => wordLock(planWords.get(wordId)!, stats.value)
  /** What keeps a group from opening, null once it is ready (KR76). */
  const groupLockOf = (groupId: string) => groupLock(PLAN_COURSE.groups.find(g => g.id === groupId)!, stats.value)

  // every write goes through here, so the shell's counts read storage again
  function saveStats(data: KanjiStatsMap): void {
    writeJson(KANJI_STATS_KEY, data)
    stats.value = data
    kanjiRevision.value++
  }

  const planAt = (now: number) => {
    const newIds = pickedSets.value.size ? pickedKanjiIds(sets, pickedSets.value) : kanjiIds
    return planKanji(stats.value, log.value, PLAN_COURSE, smartSize.value, now, smartNew.value, newIds)
  }
  const plan = computed(() => planAt(clock.value))

  const seenStats = computed(() => kanjiIds.map(id => stats.value[id]).filter(isSeen))
  const seenWords = computed(() => wordIds.map(id => stats.value[id]).filter(isSeen))

  const summary = computed(() => {
    const p = plan.value
    const seen = seenStats.value
    const items = [...seen, ...seenWords.value]
    const correct = items.reduce((n, stat) => n + stat.correct, 0)
    const incorrect = items.reduce((n, stat) => n + stat.incorrect, 0)
    const mastered = (list: KanjiStatEntry[]) => list.filter(stat => stat.box >= MASTERED_BOX).length
    return {
      total: kanjiIds.length,
      seen: seen.length,
      mastered: mastered(seen),
      wordsMastered: mastered(seenWords.value),
      // kanji and words together, for the tiles (KR45)
      itemsSeen: items.length,
      itemsMastered: mastered(items),
      accuracy: `${accuracy({ correct, incorrect })}%`,
      weak: p.weak.length, fresh: p.fresh.length, fill: p.fill.length,
      // group words are new words too
      newWords: p.waitingWords.length + Object.keys(p.firstWords).length + (p.group?.words.length ?? 0),
      newGroup: p.group ? groupById(p.group.id)!.title : null,
      outsideSets: p.outsideSets.map(kanjiOfId).filter((k): k is string => !!k),
      cards: planCards(p),
      nextNew: p.fresh.map(id => byId.get(id)!.kanji),
      fromSelection: pickedSets.value.size > 0,
      outlook: dueOutlook(items, clock.value),
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

  const openErrors = computed(() => openKanjiErrors(stats.value, log.value, itemIds).map(stat => ({ ...stat, item: itemInfo(stat.id)! })))
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

  // the table lists kanji and words, or only one of the two (KR53)
  const tableShow = ref<'all' | 'kanji' | 'words'>('all')

  const rows = computed(() => {
    const shown = [
      ...(tableShow.value === 'words' ? [] : seenStats.value),
      ...(tableShow.value === 'kanji' ? [] : seenWords.value),
    ]
    return sortKanjiRows(shown.map(stat => itemRow(itemInfo(stat.id)!, itemOrder(stat.id), stat)), tableSort.value)
  })

  const allPatterns = computed(() => detectKanjiPatterns(stats.value, log.value, 'all', PATTERN_COURSE, clock.value))

  // set by the errors tile on the Practice tab, the Progress tab scrolls to its list and clears it
  const errorsScrollPending = ref(false)

  // --- session ---

  const cards = ref<KanjiCard[]>([])
  const current = ref(0)
  const answered = ref(false)
  const pickedOption = ref<string | null>(null)  // the option chosen on the current card
  const gaveUp = ref(false)
  const mistake = ref<ReadingMistake | null>(null)  // the kind of a wrong reading on the current card
  const correct = ref(false)  // the current card was answered right
  // a typed reading (R2): what is in the field, whether a slip was let through on this card,
  // and the verdict on the last answer sent (the card's hints and feedback read it)
  const typedAnswer = ref('')
  const slipped = ref(false)
  const verdict = ref<TypedVerdict | null>(null)
  const correctCount = ref(0)
  const wrongCount = ref(0)
  const startedAt = ref(0)
  const results = ref<RoundResults>({})
  const moves = ref<Record<string, BoxMove>>({})
  let questionStart = 0
  let reasked: Record<string, number> = {}
  // items answered right in this session: a new kanji's first word needs its kanji in here
  let rightIds = new Set<string>()
  // kanji and words the learner has met, the session's own included, for the wrong options
  let knownKanji = new Set<string>()
  let knownWords = new Set<string>()

  const card = computed(() => cards.value[current.value] ?? null)
  const progress = computed(() => cards.value.length ? (current.value / cards.value.length) * 100 : 0)

  const buildCard = (item: PlannedCard): KanjiCard =>
    makeCard(item, { stats: stats.value, mode: mode.value, knownKanji, knownWords })

  function resetCard(): void {
    answered.value = false
    pickedOption.value = null
    gaveUp.value = false
    mistake.value = null
    correct.value = false
    typedAnswer.value = ''
    slipped.value = false
    verdict.value = null
    questionStart = Date.now()
  }

  function begin(items: PlannedCard[]): void {
    const ids = [...seenStats.value.map(stat => stat.id), ...seenWords.value.map(stat => stat.id), ...items.map(i => i.id)]
    knownKanji = new Set(ids.map(kanjiOfId).filter((k): k is string => !!k))
    knownWords = new Set(ids.filter(id => planWords.has(id)))
    reasked = {}
    rightIds = new Set()
    moves.value = {}
    results.value = {}
    correctCount.value = 0
    wrongCount.value = 0
    cards.value = items.map(buildCard)
    current.value = 0
    startedAt.value = Date.now()
    resetCard()
    kanjiScreen.value = 'quiz'
  }

  const questionsOnly = (ids: string[]): PlannedCard[] => ids.map(id => ({ id }))

  // what the first button on the results screen repeats
  let lastStart: () => boolean = startSmart
  const restartLabel = ref('Keep going')

  function remember(start: () => boolean, label: string): void {
    lastStart = start
    restartLabel.value = label
  }

  /** False when there is nothing to practice. */
  function startSmart(): boolean {
    const items = orderKanjiSession(planAt(Date.now()))
    if (items.length === 0) return false
    remember(startSmart, 'Keep going')
    begin(items)
    return true
  }

  // the word modes ask words, the custom quiz then runs over the words met so far (KR47)
  const wordMode = computed(() => isWordType(mode.value))

  // every kanji of the picked sets once, no intro, a kanji not met yet is asked like any other.
  // In a word mode every word of their kanji that has been introduced.
  function startCustom(): boolean {
    const kanji = pickedKanjiIds(sets, pickedSets.value)
    const ids = shuffle(wordMode.value ? pickedWordIds(kanji, PLAN_COURSE.words, stats.value) : kanji)
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

  function startPattern(p: KanjiPattern): boolean {
    const items = patternCards(p, stats.value)
    if (items.length === 0) return false
    remember(() => startPattern(p), 'Again')
    begin(items)
    return true
  }

  // from the kanji sheet: this one kanji, with kanji the learner knows in between.
  // One never met gets its intro card first, like in smart practice.
  function startKanji(kanji: string): boolean {
    const id = kanjiId(kanji)
    const start = () => {
      const intro: PlannedCard[] = isSeen(stats.value[id]) ? [] : [{ id, type: 'intro' }]
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
  function saveAnswer(a: Omit<KanjiAnswerInput, 'ms'>): BoxMove {
    const now = Date.now()
    const ms = now - questionStart
    // read storage again, another tab may have written in between
    const data = loadStats()
    const from = data[a.id]?.box ?? 0
    data[a.id] = applyKanjiAnswer(data[a.id], { ...a, ms }, now)
    saveStats(data)

    const nextLog = loadLog()
    nextLog.push({ id: a.id, type: a.type, correct: a.correct, given: a.given, ms, t: now, ...(a.mistake ? { mistake: a.mistake } : {}) })
    if (nextLog.length > MAX_ANSWERS) nextLog.splice(0, nextLog.length - MAX_ANSWERS)
    writeJson(KANJI_ANSWERS_KEY, nextLog)
    log.value = nextLog

    countAnswer(now)
    return { from, to: data[a.id].box }
  }

  // an answer as a card gives it, the time and whether the box is held are added on the way
  type CardAnswer = Omit<KanjiAnswerInput, 'ms' | 'holdBox'>

  function record(a: CardAnswer): void {
    // right on the re-ask, seconds after seeing the answer, is no reason to promote
    const move = saveAnswer({ ...a, holdBox: a.correct && !!results.value[a.id]?.missed })
    const prev = moves.value[a.id]
    moves.value = { ...moves.value, [a.id]: { from: prev?.from ?? move.from, to: move.to } }
    results.value = noteResult(results.value, a.id, a.correct)
    if (a.correct) {
      correctCount.value++
      rightIds.add(a.id)
    } else wrongCount.value++
  }

  // a missed item comes back a few cards later, in the type that was missed
  function queueReask(id: string, type: QuestionType): void {
    const qs = cards.value
    const asked = qs.filter(x => x.type !== 'intro')
    const slot = planReask(qs.map(x => x.id), current.value, id, asked.map(x => x.id), reasked[id] ?? 0)
    if (!slot) return
    reasked[id] = (reasked[id] ?? 0) + 1
    const padding = slot.pad.map(p => buildCard({ id: p }))
    qs.splice(slot.index, 0, ...padding, { ...buildCard({ id, type }), reask: true })
  }

  function settle(a: CardAnswer): void {
    answered.value = true
    correct.value = a.correct
    record(a)
    if (!a.correct) {
      queueReask(a.id, a.type)
      return
    }
    // A word card waits for Next: its reading and meaning are to be read (KR34), and a card
    // that changes under the finger would take the tap meant for Next. A kanji card moves on
    // shortly, unless Next was pressed first.
    if (!kanjiOfId(a.id)) return
    const session = startedAt.value
    const at = current.value
    setTimeout(() => {
      if (kanjiScreen.value === 'quiz' && startedAt.value === session && current.value === at) next()
    }, 400)
  }

  function answer(given: string | null): void {
    const c = card.value
    if (!c || c.type === 'intro' || answered.value) return
    pickedOption.value = given
    gaveUp.value = given === null
    const picked = given === c.answer
    if (!picked && given && c.type === 'read-choice') mistake.value = wordReadingMistake(c.id, given)
    settle({ id: c.id, type: c.type, correct: picked, given: storedAnswer(c, given), mistake: mistake.value?.kind })
  }

  // a typed reading: a homograph, kanji in the input or the first slip ask again and count nothing
  function submitTyped(): void {
    const c = card.value
    const typed = typedAnswer.value
    if (!c || c.type !== 'read-type' || answered.value || !(cleanTyped(typed) || hasKanji(typed))) return
    const v = wordTypedVerdict(c.id, typed, slipped.value)
    verdict.value = v
    if (v.result === 'slip') slipped.value = true
    else if (v.result === 'right') settle({ id: c.id, type: c.type, correct: true, given: v.kana })
    else if (v.result === 'wrong') {
      mistake.value = v.mistake
      settle({ id: c.id, type: c.type, correct: false, given: v.given, typo: v.typo, mistake: v.mistake?.kind })
    }
  }

  const choose = (option: string) => answer(option)
  const giveUp = () => answer(null)

  function next(): void {
    current.value++
    // a new kanji's first word only comes once the kanji was answered right (KR14)
    cards.value = readyCard(cards.value, current.value, rightIds)
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
    .map(([id]) => itemInfo(id))
    .filter((item): item is ItemInfo => !!item))

  const roundPatterns = computed(() => {
    const round = log.value.filter(r => r.t >= startedAt.value)
    return detectKanjiPatterns(kanjiStatsFromLog(round), round, 'round', PATTERN_COURSE)
  })

  const roundOutcome = computed(() => {
    const { up, down, mastered } = splitMoves(moves.value)
    const text = (ids: string[]) => ids.map(id => itemInfo(id)?.text ?? '')
    return { up: text(up), down: text(down), mastered: text(mastered), outlook: summary.value.outlook }
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
    sets, mode, setMode, wordMode, smartSize, smartNew, setSmartSize, setSmartNew,
    pickedSets, toggleSet, selectAllSets, selectNoneSets,
    statOf, lockOf, groupLockOf, hasError, summary, progressBySet,
    openErrors, resolveErrors, resolveAllErrors, rows, tableShow, tableSort, setTableSort, errorsScrollPending, allPatterns,
    cards, current, card, answered, pickedOption, gaveUp, mistake, correct, correctCount, wrongCount, startedAt, progress,
    typedAnswer, slipped, verdict,
    startSmart, startCustom, startErrors, startKanji, startPattern, restart, restartLabel,
    choose, giveUp, submitTyped, next, goHome, resume,
    resultScore: score, resultLabel: label, missed, roundOutcome, roundPatterns,
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
