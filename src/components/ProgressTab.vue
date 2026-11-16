<script setup lang="ts">
import { inject } from 'vue'
import type { StatsFilter, StatsSortCol } from '../types'
import { QUIZ_KEY } from '../composables/useQuiz'
import { fromNow, stageOf, STAGE_LABEL } from '../format'
import PatternCards from './PatternCards.vue'
import KanaChart from './KanaChart.vue'
import Icon from './Icon.vue'

const {
  statsSummary, filteredStatsRows, statsFilter, statsSort, allPatterns, today,
  errorPairs, maxErrorCount, weakPool, slowPool,
  setStatsFilter, setStatsSort, openKana, resolveErrors, resolveAllErrors,
  startQuiz, startWorstPractice, startSlowestPractice, startPatternPractice,
} = inject(QUIZ_KEY)!

const FILTERS: Array<[StatsFilter, string]> = [
  ['all', 'All'],
  ['hiragana', 'Hiragana'],
  ['katakana', 'Katakana'],
]

function sortIcon(col: StatsSortCol): string {
  if (statsSort.value?.col !== col) return '↕'
  return statsSort.value.dir === 'asc' ? '↑' : '↓'
}

function accuracy(e: { correct: number; incorrect: number }): number {
  const seen = e.correct + e.incorrect
  return seen > 0 ? Math.round((e.correct / seen) * 100) : 0
}
</script>

<template>
  <div>
    <div class="stats-summary">
      <div class="stat-card correct"><div class="sc-value">{{ statsSummary.mastered }}</div><div class="sc-label">Mastered</div></div>
      <div class="stat-card accent"><div class="sc-value">{{ statsSummary.kanaCount }}</div><div class="sc-label">Kana seen</div></div>
      <div class="stat-card purple"><div class="sc-value">{{ today.streak }}</div><div class="sc-label">Day streak</div></div>
      <div class="stat-card"><div class="sc-value">{{ statsSummary.accuracy }}</div><div class="sc-label">Accuracy</div></div>
    </div>

    <h2 class="section-title">Kana chart</h2>
    <p class="section-note">Tap a kana to see how it's written, how you're doing with it and when it comes back.</p>
    <KanaChart />

    <PatternCards
      v-if="statsSummary.kanaCount > 0"
      :patterns="allPatterns"
      title="Detected patterns"
      empty-text="No patterns yet. Keep practicing, this fills in as errors pile up."
      @practice="startPatternPractice"
    />

    <div class="errors-header">
      <h2 class="section-title">Open errors <span class="count-tag">{{ errorPairs.length }}</span></h2>
      <button v-if="errorPairs.length" class="btn btn-sm" @click="resolveAllErrors()">Mark all resolved</button>
    </div>
    <p class="section-note">A kana leaves this list once you've mastered it again. Resolving only hides it here, your progress stays.</p>
    <div v-if="errorPairs.length === 0" class="no-errors-state">
      <div class="big"><Icon name="check" :size="40" /></div>
      <div class="msg">No open errors</div>
    </div>
    <template v-else>
      <div class="error-table">
        <div v-for="e in errorPairs" :key="e.kana" class="error-row">
          <button class="error-kana" :aria-label="`Details for ${e.kana}`" @click="openKana(e.kana)">{{ e.kana }}</button>
          <span class="error-romaji">{{ e.romaji }}</span>
          <div class="error-bar-wrap">
            <div class="error-bar-bg">
              <div class="error-bar-fill" :style="{ width: maxErrorCount > 0 ? `${Math.round((e.incorrect / maxErrorCount) * 100)}%` : '0%' }"></div>
            </div>
            <span class="error-count-label">{{ e.incorrect }}</span>
          </div>
          <span class="error-accuracy" :class="{ good: accuracy(e) >= 80, ok: accuracy(e) >= 50 && accuracy(e) < 80 }">
            {{ accuracy(e) }}%
          </span>
          <button class="error-remove-btn" :aria-label="`Mark ${e.kana} as resolved`" title="Mark as resolved" @click="resolveErrors([e.kana])"><Icon name="check" :size="20" /></button>
        </div>
      </div>
      <button class="btn btn-bad btn-lg btn-block" @click="startQuiz(true)">Practice errors</button>
    </template>

    <h2 class="section-title spaced">All kana</h2>
    <div class="stats-filters">
      <button
        v-for="[val, label] in FILTERS" :key="val"
        class="stats-filter-btn" :class="{ active: statsFilter === val }"
        :aria-pressed="statsFilter === val"
        @click="setStatsFilter(val)"
      >{{ label }}</button>
    </div>

    <div class="stats-practice-row">
      <button class="btn btn-sm" :disabled="weakPool.length === 0" @click="startWorstPractice()">
        Practice weak <span class="btn-badge">{{ weakPool.length }}</span>
      </button>
      <button class="btn btn-sm" :disabled="slowPool.length === 0" @click="startSlowestPractice()">
        Practice slow <span class="btn-badge">{{ slowPool.length }}</span>
      </button>
    </div>

    <div v-if="filteredStatsRows.length === 0" class="no-stats-state">
      <div class="big">{{ statsSummary.kanaCount === 0 ? '統' : '？' }}</div>
      <div class="msg">{{ statsSummary.kanaCount === 0 ? 'No data yet, finish a session to see stats' : 'No data for this filter' }}</div>
    </div>
    <div v-else class="stats-table">
      <div class="stats-table-header">
        <button class="stats-th" @click="setStatsSort('kana')">Kana <span class="sort-icon">{{ sortIcon('kana') }}</span></button>
        <span>Romaji</span>
        <button class="stats-th" @click="setStatsSort('acc')">Accuracy <span class="sort-icon">{{ sortIcon('acc') }}</span></button>
        <button class="stats-th" @click="setStatsSort('box')">Stage <span class="sort-icon">{{ sortIcon('box') }}</span></button>
        <button class="stats-th" @click="setStatsSort('errors')">Errors <span class="sort-icon">{{ sortIcon('errors') }}</span></button>
        <button class="stats-th" style="justify-content:flex-end" @click="setStatsSort('time')">Avg Time <span class="sort-icon">{{ sortIcon('time') }}</span></button>
      </div>
      <button v-for="e in filteredStatsRows" :key="e.kana" class="stats-row" @click="openKana(e.kana)">
        <span class="stats-kana-cell">{{ e.kana }}</span>
        <span class="stats-romaji-cell">{{ e.romaji }}</span>
        <div class="acc-bar-wrap">
          <div class="acc-bar-bg"><div class="acc-bar-fill" :class="e.accClass" :style="{ width: `${e.acc}%` }"></div></div>
          <span class="stats-num" :class="e.accClass">{{ e.acc }}%</span>
        </div>
        <span class="stats-stage" :class="stageOf(e.box, e.seen > 0)">
          {{ STAGE_LABEL[stageOf(e.box, e.seen > 0)] }}
          <small>{{ fromNow(e.due) === 'now' ? 'due' : fromNow(e.due) }}</small>
        </span>
        <span class="stats-num" :class="e.incorrect > 0 ? 'bad' : 'good'">{{ e.incorrect }}</span>
        <span class="time-badge" :class="e.timeClass">{{ e.avgTime !== null ? `${e.avgTime}s` : '--' }}</span>
      </button>
    </div>
  </div>
</template>
