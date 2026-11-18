import { ref, computed } from 'vue'
import type { StatsMap, StatEntry, AnswerInput, AnswerRecord, StrokeFault } from '../types'
import { normalizeStats, newEntry } from '../learning/statsMigration'
import { review, recentErrors, MASTERED_BOX } from '../learning/scheduler'
import { dayKey, streak } from '../learning/progress'
import { clock } from '../clock'

const LS_STATS = 'kana_stats_v3'
const LS_STATS_V2 = 'kana_stats_v2'
const LS_ANSWERS = 'kana_answers_v1'
const LS_DAYS = 'kana_days_v1'
const MAX_ANSWERS = 1000

function readJson(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null }
}

function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

function loadStats(): StatsMap {
  // first run after the upgrade: take the v2 data along, leave the old key in place
  const raw = readJson(LS_STATS) ?? readJson(LS_STATS_V2)
  return normalizeStats(raw)
}

function loadAnswers(): AnswerRecord[] {
  const raw = readJson(LS_ANSWERS)
  return Array.isArray(raw) ? raw : []
}

// answers per local day, only for the streak. Tiny, so it is never trimmed.
function loadDays(): Record<string, number> {
  const raw = readJson(LS_DAYS)
  return raw && typeof raw === 'object' ? raw as Record<string, number> : {}
}

export interface BoxMove { from: number; to: number }

export function useStats() {
  const statsData = ref<StatsMap>(loadStats())
  const answerLog = ref<AnswerRecord[]>(loadAnswers())
  const days = ref<Record<string, number>>(loadDays())

  const recentErrorMap = computed(() => recentErrors(answerLog.value))

  function recentErrorCount(kana: string): number {
    return recentErrorMap.value.get(kana)?.errors ?? 0
  }

  // unresolved errors only: a kana drops off once it climbs back to a mastered box,
  // or when the user marked it as resolved and hasn't missed it since
  const errorPairs = computed<StatEntry[]>(() =>
    Object.values(statsData.value)
      .filter(e => e.incorrect > 0 && e.box < MASTERED_BOX && e.lastWrong >= e.resolvedAt)
      .sort((a, b) => recentErrorCount(b.kana) - recentErrorCount(a.kana) || b.incorrect - a.incorrect)
  )

  const kanaTracked = computed(() => Object.keys(statsData.value).length)

  const errorKanaSet = computed(() => new Set(errorPairs.value.map(e => e.kana)))

  const today = computed(() => {
    const now = clock.value
    return { answers: days.value[dayKey(now)] ?? 0, streak: streak(days.value, now) }
  })

  /** Returns how the kana's Leitner box moved, for the results screen. */
  function recordAnswer(a: AnswerInput): BoxMove {
    const now = Date.now()
    const data = loadStats()
    const e = data[a.kana] ?? (data[a.kana] = newEntry({ kana: a.kana, romaji: a.romaji, script: a.script }))
    const from = e.box

    const dir = e.byDirection[a.direction] ?? (e.byDirection[a.direction] = { correct: 0, incorrect: 0 })
    e.lastSeen = now
    if (a.correct) {
      e.correct++
      dir.correct++
      e.streak++
    } else {
      e.incorrect++
      dir.incorrect++
      e.streak = 0
      e.lastWrong = now
      if (a.given) e.confusions[a.given] = (e.confusions[a.given] ?? 0) + 1
    }
    if (a.strokes) {
      a.strokes.errors.forEach((n, i) => { e.strokeErrors[i] = (e.strokeErrors[i] ?? 0) + n })
      for (const [fault, n] of Object.entries(a.strokes.faults) as Array<[StrokeFault, number]>)
        e.strokeFaults[fault] = (e.strokeFaults[fault] ?? 0) + n
    }
    if (!a.typo && !a.timeout && !a.holdBox) Object.assign(e, review(e, a.correct, now))
    // drawing takes far longer than reading, keep it out of the reaction times
    if (a.direction !== 'draw' && a.elapsedMs > 0 && a.elapsedMs < 30_000) {
      e.totalMs += a.elapsedMs
      e.count++
    }
    writeJson(LS_STATS, data)
    statsData.value = data

    const log = loadAnswers()
    log.push({ kana: a.kana, direction: a.direction, correct: a.correct, given: a.given, ms: a.elapsedMs, t: now })
    if (log.length > MAX_ANSWERS) log.splice(0, log.length - MAX_ANSWERS)
    writeJson(LS_ANSWERS, log)
    answerLog.value = log

    const d = { ...loadDays() }
    d[dayKey(now)] = (d[dayKey(now)] ?? 0) + 1
    writeJson(LS_DAYS, d)
    days.value = d

    return { from, to: e.box }
  }

  // takes kana off the error list without touching what was learned
  function resolveErrors(kana: string[]): void {
    const data = loadStats()
    const now = Date.now()
    for (const k of kana) if (data[k]) data[k].resolvedAt = now
    writeJson(LS_STATS, data)
    statsData.value = data
  }

  // the one real reset, everything goes
  function resetAll(): void {
    for (const key of [LS_STATS, LS_STATS_V2, LS_ANSWERS, LS_DAYS]) {
      try { localStorage.removeItem(key) } catch {}
    }
    statsData.value = {}
    answerLog.value = []
    days.value = {}
  }

  function refresh(): void {
    statsData.value = loadStats()
    answerLog.value = loadAnswers()
    days.value = loadDays()
  }

  return {
    statsData, answerLog, errorPairs, kanaTracked, errorKanaSet, recentErrorCount, today,
    recordAnswer, resolveErrors, resetAll, refresh,
  }
}
