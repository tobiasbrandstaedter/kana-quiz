import { ref, computed } from 'vue'
import type { StatsMap, StatEntry, AnswerInput, AnswerRecord, StrokeFault } from '../types'
import { normalizeStats, newEntry } from '../learning/statsMigration'
import { review, recentErrors, MASTERED_BOX } from '../learning/scheduler'

const LS_STATS = 'kana_stats_v3'
const LS_STATS_V2 = 'kana_stats_v2'
const LS_ANSWERS = 'kana_answers_v1'
const MAX_ANSWERS = 1000

function readJson(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null }
}

function loadStats(): StatsMap {
  // first run after the upgrade: take the v2 data along, leave the old key in place
  const raw = readJson(LS_STATS) ?? readJson(LS_STATS_V2)
  return normalizeStats(raw)
}

function saveStats(data: StatsMap): void {
  try { localStorage.setItem(LS_STATS, JSON.stringify(data)) } catch {}
}

function loadAnswers(): AnswerRecord[] {
  const raw = readJson(LS_ANSWERS)
  return Array.isArray(raw) ? raw : []
}

function saveAnswers(log: AnswerRecord[]): void {
  try { localStorage.setItem(LS_ANSWERS, JSON.stringify(log)) } catch {}
}

export function useStats() {
  const statsData = ref<StatsMap>(loadStats())
  const answerLog = ref<AnswerRecord[]>(loadAnswers())

  const recentErrorMap = computed(() => recentErrors(answerLog.value))

  function recentErrorCount(kana: string): number {
    return recentErrorMap.value.get(kana)?.errors ?? 0
  }

  // unresolved errors only: once a kana climbs back to a mastered box it drops off
  const errorPairs = computed<StatEntry[]>(() =>
    Object.values(statsData.value)
      .filter(e => e.incorrect > 0 && e.box < MASTERED_BOX)
      .sort((a, b) => recentErrorCount(b.kana) - recentErrorCount(a.kana) || b.incorrect - a.incorrect)
  )

  const maxErrorCount = computed(() => errorPairs.value[0]?.incorrect ?? 0)
  const errorTabCount = computed(() => errorPairs.value.length)
  const statsTabCount = computed(() => Object.keys(statsData.value).length)

  const errorKanaSet = computed(() => new Set(errorPairs.value.map(e => e.kana)))

  function recordAnswer(a: AnswerInput): void {
    const now = Date.now()
    const data = loadStats()
    const e = data[a.kana] ?? (data[a.kana] = newEntry({ kana: a.kana, romaji: a.romaji, script: a.script }))

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
    if (!a.typo) Object.assign(e, review(e, a.correct, now))
    // drawing takes far longer than reading, keep it out of the reaction times
    if (a.direction !== 'draw' && a.elapsedMs > 0 && a.elapsedMs < 30_000) {
      e.totalMs += a.elapsedMs
      e.count++
    }
    saveStats(data)
    statsData.value = data

    const log = loadAnswers()
    log.push({ kana: a.kana, direction: a.direction, correct: a.correct, given: a.given, ms: a.elapsedMs, t: now })
    if (log.length > MAX_ANSWERS) log.splice(0, log.length - MAX_ANSWERS)
    saveAnswers(log)
    answerLog.value = log
  }

  function removeErrorEntry(kana: string): void {
    const data = loadStats()
    delete data[kana]
    saveStats(data)
    statsData.value = { ...data }
  }

  function clearAll(): void {
    localStorage.removeItem(LS_STATS)
    localStorage.removeItem(LS_STATS_V2)
    localStorage.removeItem(LS_ANSWERS)
    statsData.value = {}
    answerLog.value = []
  }

  function confirmClearErrors(): void {
    if (confirm('Clear all error history? This cannot be undone.')) clearAll()
  }

  function confirmClearStats(): void {
    if (confirm('Reset all statistics? This cannot be undone.')) clearAll()
  }

  function refresh(): void {
    statsData.value = loadStats()
    answerLog.value = loadAnswers()
  }

  return {
    statsData, answerLog, errorPairs, maxErrorCount, errorTabCount, statsTabCount, errorKanaSet, recentErrorCount,
    recordAnswer, removeErrorEntry, confirmClearErrors, confirmClearStats, refresh,
  }
}
