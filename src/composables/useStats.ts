import { ref, computed } from 'vue'
import type { StatsMap, StatEntry, ScriptName } from '../types'

const LS_STATS = 'kana_stats_v2'

function loadStats(): StatsMap {
  try { return JSON.parse(localStorage.getItem(LS_STATS) ?? '{}') } catch { return {} }
}

function saveStats(data: StatsMap): void {
  try { localStorage.setItem(LS_STATS, JSON.stringify(data)) } catch {}
}

export function useStats() {
  const statsData = ref<StatsMap>(loadStats())

  const errorPairs = computed<StatEntry[]>(() =>
    Object.values(statsData.value)
      .filter(e => e.incorrect > 0)
      .sort((a, b) => b.incorrect - a.incorrect)
  )

  const maxErrorCount = computed(() => errorPairs.value[0]?.incorrect ?? 0)
  const errorTabCount = computed(() => errorPairs.value.length)
  const statsTabCount = computed(() => Object.keys(statsData.value).length)

  const errorKanaSet = computed(() =>
    new Set(Object.values(statsData.value).filter(e => e.incorrect > 0).map(e => e.kana))
  )

  function recordAnswer(kana: string, romaji: string, script: ScriptName, wasCorrect: boolean, elapsedMs: number): void {
    const data = loadStats()
    if (!data[kana]) data[kana] = { kana, romaji, script, correct: 0, incorrect: 0, totalMs: 0, count: 0 }
    data[kana].correct   += wasCorrect ? 1 : 0
    data[kana].incorrect += wasCorrect ? 0 : 1
    if (elapsedMs > 0 && elapsedMs < 30_000) {
      data[kana].totalMs += elapsedMs
      data[kana].count++
    }
    saveStats(data)
    statsData.value = data
  }

  function removeErrorEntry(kana: string): void {
    const data = loadStats()
    delete data[kana]
    saveStats(data)
    statsData.value = { ...data }
  }

  function clearAll(): void {
    localStorage.removeItem(LS_STATS)
    statsData.value = {}
  }

  function confirmClearErrors(): void {
    if (confirm('Clear all error history? This cannot be undone.')) clearAll()
  }

  function confirmClearStats(): void {
    if (confirm('Reset all statistics? This cannot be undone.')) clearAll()
  }

  function refresh(): void {
    statsData.value = loadStats()
  }

  return {
    statsData, errorPairs, maxErrorCount, errorTabCount, statsTabCount, errorKanaSet,
    recordAnswer, removeErrorEntry, confirmClearErrors, confirmClearStats, refresh,
  }
}
