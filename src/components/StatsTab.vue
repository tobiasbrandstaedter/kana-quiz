<script setup lang="ts">
import { inject } from 'vue'
import type { StatsFilter } from '../types'
import { QUIZ_KEY } from '../composables/useQuiz'

const {
  statsSummary, filteredStatsRows, statsFilter,
  setStatsFilter, confirmClearStats,
} = inject(QUIZ_KEY)!

const FILTERS: Array<[StatsFilter, string]> = [
  ['all', 'ALL'],
  ['hiragana', 'HIRAGANA'],
  ['katakana', 'KATAKANA'],
  ['worst', 'WORST FIRST'],
  ['slowest', 'SLOWEST'],
]
</script>

<template>
  <div>
    <div class="stats-clear-row">
      <button class="clear-stats-btn" @click="confirmClearStats()">RESET STATS</button>
    </div>

    <div class="stats-summary">
      <div class="stat-card accent"><div class="sc-value">{{ statsSummary.kanaCount }}</div><div class="sc-label">Kana Seen</div></div>
      <div class="stat-card correct"><div class="sc-value">{{ statsSummary.accuracy }}</div><div class="sc-label">Accuracy</div></div>
      <div class="stat-card wrong"><div class="sc-value">{{ statsSummary.totalErrors }}</div><div class="sc-label">Total Errors</div></div>
      <div class="stat-card purple"><div class="sc-value">{{ statsSummary.avgTime }}</div><div class="sc-label">Avg Time</div></div>
    </div>

    <div class="stats-filters">
      <button
        v-for="[val, label] in FILTERS" :key="val"
        class="stats-filter-btn" :class="{ active: statsFilter === val }"
        @click="setStatsFilter(val)"
      >{{ label }}</button>
    </div>

    <div v-if="filteredStatsRows.length === 0" class="no-stats-state">
      <div class="big">{{ statsSummary.kanaCount === 0 ? '統' : '？' }}</div>
      <div class="msg">{{ statsSummary.kanaCount === 0 ? 'No data yet — complete a quiz to see stats' : 'No data for this filter' }}</div>
    </div>
    <div v-else class="stats-table">
      <div class="stats-table-header">
        <span>Kana</span><span>Romaji</span><span>Accuracy</span>
        <span class="stats-num">Seen</span><span class="stats-num">Errors</span><span style="text-align:right">Avg Time</span>
      </div>
      <div v-for="e in filteredStatsRows" :key="e.kana" class="stats-row">
        <span class="stats-kana-cell">{{ e.kana }}</span>
        <span class="stats-romaji-cell">{{ e.romaji }}</span>
        <div class="acc-bar-wrap">
          <div class="acc-bar-bg"><div class="acc-bar-fill" :class="e.accClass" :style="{ width: `${e.acc}%` }"></div></div>
          <span class="stats-num" :class="e.accClass" style="font-size:10px;min-width:34px;text-align:right">{{ e.acc }}%</span>
        </div>
        <span class="stats-num">{{ e.seen }}</span>
        <span class="stats-num" :class="e.incorrect > 0 ? 'bad' : 'good'">{{ e.incorrect }}</span>
        <span class="time-badge" :class="e.timeClass">{{ e.avgTime !== null ? `${e.avgTime}s` : '--' }}</span>
      </div>
    </div>
  </div>
</template>
