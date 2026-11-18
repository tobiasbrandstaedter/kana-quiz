<script setup lang="ts">
import { inject } from 'vue'
import type { StatsSortCol } from '../types'
import { QUIZ_KEY } from '../composables/useQuiz'
import { dueAt, isDue } from '../learning/scheduler'
import { clock } from '../clock'
import { fromNow, stageOf, accuracy, accClass, STAGE_LABEL } from '../format'
import PatternCards from './PatternCards.vue'
import KanaChart from './KanaChart.vue'
import Icon from './Icon.vue'

const {
  statsSummary, filteredStatsRows, statsSort, allPatterns, today,
  errorPairs, weakPool, slowPool,
  setStatsSort, openKana, resolveErrors, resolveAllErrors,
  startQuiz, startWorstPractice, startSlowestPractice, startPatternPractice,
} = inject(QUIZ_KEY)!

// a handful of kana is not a pool worth its own button
const MIN_POOL = 3

const COLUMNS: Array<[StatsSortCol, string]> = [
  ['kana', 'Kana'],
  ['acc', 'Accuracy'],
  ['box', 'Stage'],
  ['errors', 'Errors'],
  ['time', 'Avg time'],
]

function sortIcon(col: StatsSortCol): string {
  if (statsSort.value?.col !== col) return 'sort'
  return statsSort.value.dir === 'asc' ? 'up' : 'down'
}

function sortState(col: StatsSortCol): 'ascending' | 'descending' | 'none' {
  if (statsSort.value?.col !== col) return 'none'
  return statsSort.value.dir === 'asc' ? 'ascending' : 'descending'
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

    <div id="open-errors" class="errors-header">
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
          <span class="error-facts">
            {{ e.incorrect }} miss{{ e.incorrect === 1 ? '' : 'es' }}
            <span class="error-accuracy" :class="accClass(accuracy(e))">{{ accuracy(e) }}% right</span>
          </span>
          <button class="btn btn-sm" :aria-label="`Mark ${e.kana} as resolved`" @click="resolveErrors([e.kana])">Resolve</button>
        </div>
      </div>
      <button class="btn btn-bad btn-lg btn-block" @click="startQuiz(true)">Practice errors</button>
    </template>

    <h2 class="section-title spaced">All kana</h2>

    <!-- only once there is enough to practice, the errors and patterns above cover the rest -->
    <div v-if="weakPool.length >= MIN_POOL || slowPool.length >= MIN_POOL" class="stats-practice-row">
      <button v-if="weakPool.length >= MIN_POOL" class="btn btn-sm" @click="startWorstPractice()">
        Practice weak <span class="btn-badge">{{ weakPool.length }}</span>
      </button>
      <button v-if="slowPool.length >= MIN_POOL" class="btn btn-sm" @click="startSlowestPractice()">
        Practice slow <span class="btn-badge">{{ slowPool.length }}</span>
      </button>
    </div>

    <div v-if="filteredStatsRows.length === 0" class="no-stats-state">
      <div class="big">統</div>
      <div class="msg">No data yet, finish a session to see stats</div>
    </div>
    <div v-else class="stats-table">
      <div class="stats-table-header">
        <template v-for="[col, label] in COLUMNS" :key="col">
          <button
            class="stats-th" :class="{ active: statsSort?.col === col, end: col === 'time' }"
            :aria-label="`Sort by ${label.toLowerCase()}, ${sortState(col) === 'none' ? 'not sorted' : sortState(col)}`"
            @click="setStatsSort(col)"
          >{{ label }} <Icon :name="sortIcon(col)" :size="14" /></button>
          <span v-if="col === 'kana'">Romaji</span>
        </template>
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
          <small>{{ isDue(e, clock) ? 'due' : fromNow(dueAt(e), clock) }}</small>
        </span>
        <span class="stats-num" :class="e.incorrect > 0 ? 'bad' : 'good'">{{ e.incorrect }}</span>
        <span class="time-badge" :class="e.timeClass">{{ e.avgTime !== null ? `${e.avgTime}s` : '--' }}</span>
      </button>
    </div>
  </div>
</template>
