import { ref, computed, effectScope } from 'vue'
import type { KanjiAnswerRecord, KanjiCard, KanjiEntry, KanjiMode, KanjiQuestionType, KanjiStatsMap } from '../types'
import { allKanji, kanjiLookalikes, tooClose } from '../data/kanjiData'
import { applyKanjiAnswer, normalizeKanjiStats } from '../learning/kanjiStats'
import { planKanji, CARDS_PER_NEW } from '../learning/kanjiPlan'
import { kanjiQuestionType, makeKanjiCard, noteResult, pickKanjiOptions, summarizeRound } from '../learning/kanjiQuiz'
import type { RoundResults } from '../learning/kanjiQuiz'
import { orderSession, planReask, dueOutlook, isSeen, MASTERED_BOX } from '../learning/scheduler'
import { KANJI_ANSWERS_KEY, KANJI_STATS_KEY, kanjiId, kanjiOfId } from '../kanjiKeys'
import { kanjiScreen, kanjiRevision, loadKanjiPrefs, saveKanjiPrefs, onKanjiReset, readJson, writeJson } from '../kanjiShell'
import { countAnswer } from '../days'
import { clock } from '../clock'
import type { BoxMove } from './useStats'

const MAX_ANSWERS = 1000

const loadStats = () => normalizeKanjiStats(readJson(KANJI_STATS_KEY))

function loadLog(): KanjiAnswerRecord[] {
  const raw = readJson(KANJI_ANSWERS_KEY)
  return Array.isArray(raw) ? raw : []
}

function createKanji() {
  const prefs = loadKanjiPrefs()
  const mode = ref<KanjiMode>(prefs.mode ?? 'mixed')
  const smartSize = prefs.smartSize ?? 20
  const smartNew = prefs.smartNew ?? 3

  const stats = ref<KanjiStatsMap>(loadStats())
  const log = ref<KanjiAnswerRecord[]>(loadLog())

  const kanjiList = allKanji()
  const kanjiIds = kanjiList.map(k => k.id)
  const byId = new Map(kanjiList.map(k => [k.id, k]))

  const planAt = (now: number) => planKanji(stats.value, log.value, kanjiIds, smartSize, now, smartNew)
  const plan = computed(() => planAt(clock.value))

  const seenEntries = computed(() => kanjiIds.map(id => stats.value[id]).filter(isSeen))

  const summary = computed(() => {
    const p = plan.value
    return {
      seen: seenEntries.value.length,
      weak: p.weak.length, fresh: p.fresh.length, fill: p.fill.length,
      cards: p.due.length + p.weak.length + p.fill.length + p.fresh.length * CARDS_PER_NEW,
      nextNew: p.fresh.map(id => byId.get(id)!.kanji),
      outlook: dueOutlook(seenEntries.value, clock.value),
      newBlocked: p.newBlocked,
    }
  })

  function setMode(m: KanjiMode): void {
    mode.value = m
    saveKanjiPrefs({ mode: m })
  }

  // --- session ---

  const cards = ref<KanjiCard[]>([])
  const current = ref(0)
  const answered = ref(false)
  const picked = ref<string | null>(null)  // the option chosen on the current card
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

  // what the learner picked for this kanji before, most often first
  function confusedWith(id: string): string[] {
    const e = stats.value[id]
    if (!e) return []
    return Object.entries(e.confusions)
      .sort((a, b) => b[1] - a[1])
      .map(([given]) => kanjiOfId(given))
      .filter((k): k is string => k !== null)
  }

  function buildCard(k: KanjiEntry, type: KanjiQuestionType): KanjiCard {
    const wrong = pickKanjiOptions(k, kanjiList, [...confusedWith(k.id), ...kanjiLookalikes(k.kanji)], known, tooClose)
    return makeKanjiCard(k, type, wrong)
  }

  const cardFor = (k: KanjiEntry) => buildCard(k, kanjiQuestionType(stats.value[k.id], mode.value))

  function resetCard(): void {
    answered.value = false
    picked.value = null
    gaveUp.value = false
    questionStart = Date.now()
  }

  /** False when there is nothing to practice. */
  function startSmart(): boolean {
    const items = orderSession(planAt(Date.now()))
    if (items.length === 0) return false
    known = new Set([...seenEntries.value.map(e => e.id), ...items.map(i => i.pair)].map(id => byId.get(id)!.kanji))
    reasked = {}
    moves.value = {}
    results.value = {}
    correctCount.value = 0
    wrongCount.value = 0
    cards.value = items.map(i => {
      const k = byId.get(i.pair)!
      return i.intro ? { id: k.id, kanji: k.kanji, type: 'intro', options: [] } : cardFor(k)
    })
    current.value = 0
    startedAt.value = Date.now()
    resetCard()
    kanjiScreen.value = 'quiz'
    return true
  }

  function record(id: string, type: KanjiQuestionType, correct: boolean, given: string): void {
    const now = Date.now()
    const ms = now - questionStart
    // read storage again, another tab may have written in between
    const data = loadStats()
    const from = data[id]?.box ?? 0
    data[id] = applyKanjiAnswer(data[id], {
      id, type, correct, given, ms,
      // right on the re-ask, seconds after seeing the answer, is no reason to promote
      holdBox: correct && !!results.value[id]?.missed,
    }, now)
    writeJson(KANJI_STATS_KEY, data)
    stats.value = data

    const nextLog = loadLog()
    nextLog.push({ id, type, correct, given, ms, t: now })
    if (nextLog.length > MAX_ANSWERS) nextLog.splice(0, nextLog.length - MAX_ANSWERS)
    writeJson(KANJI_ANSWERS_KEY, nextLog)
    log.value = nextLog

    countAnswer(now)
    kanjiRevision.value++

    const prev = moves.value[id]
    moves.value = { ...moves.value, [id]: { from: prev?.from ?? from, to: data[id].box } }
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
    picked.value = given
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
    questionStart = Date.now()
    kanjiScreen.value = 'quiz'
  }

  const roundSummary = computed(() => summarizeRound(results.value))

  const resultScore = computed(() => {
    const { total, first } = roundSummary.value
    return total ? `${Math.round((first / total) * 100)}%` : '0%'
  })

  const resultLabel = computed(() => {
    const { total, first, fixed, open } = roundSummary.value
    if (!total) return { title: 'Nothing scored', jp: '', detail: 'This round only had intro cards.' }
    const pct = Math.round((first / total) * 100)
    const [title, jp] =
      pct === 100 ? ['Perfect!', '完璧！'] :
      open === 0  ? ['Got there!', 'できた！'] :
      pct >= 80   ? ['Great work', 'よくできました'] :
      pct >= 60   ? ['Keep practicing', 'もう少し'] :
                    ['Keep studying', '頑張って！']
    const parts = [`${first} of ${total} kanji on the first try`]
    if (fixed) parts.push(`${fixed} right on retry`)
    if (open) parts.push(`${open} still open`)
    return { title, jp, detail: parts.join(' · ') }
  })

  const missed = computed(() => Object.entries(results.value)
    .filter(([, r]) => r.missed)
    .map(([id]) => byId.get(id)!))

  const roundOutcome = computed(() => {
    const all = Object.entries(moves.value)
    const kanji = (id: string) => byId.get(id)!.kanji
    const mastered = (m: BoxMove) => m.from < MASTERED_BOX && m.to >= MASTERED_BOX
    return {
      // moving up only counts when it isn't also listed as mastered
      up: all.filter(([, m]) => m.to > m.from && !mastered(m)).map(([id]) => kanji(id)),
      down: all.filter(([, m]) => m.to < m.from).map(([id]) => kanji(id)),
      mastered: all.filter(([, m]) => mastered(m)).map(([id]) => kanji(id)),
      outlook: summary.value.outlook,
    }
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
    mode, setMode, stats, summary,
    cards, current, card, answered, picked, gaveUp, correctCount, wrongCount, startedAt, progress,
    startSmart, choose, giveUp, next, goHome, resume,
    resultScore, resultLabel, missed, roundOutcome,
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
