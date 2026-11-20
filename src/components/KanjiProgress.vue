<script setup lang="ts">
import { inject, onMounted, nextTick } from 'vue'
import type { KanjiSortCol } from '../types'
import { QUIZ_KEY } from '../composables/useQuiz'
import { useKanji } from '../composables/useKanji'
import { dueAt, isDue } from '../learning/scheduler'
import { clock } from '../clock'
import { fromNow, stageOf, accuracy, accClass, STAGE_LABEL } from '../format'
import { openKanji } from '../kanjiShell'
import KanjiChart from './KanjiChart.vue'
import Icon from './Icon.vue'

const { today } = inject(QUIZ_KEY)!
const {
  summary, openErrors, resolveErrors, resolveAllErrors, startErrors,
  rows, tableSort, setTableSort, errorsScrollPending,
} = useKanji()

// the errors tile on the Practice tab led here
onMounted(() => {
  if (!errorsScrollPending.value) return
  errorsScrollPending.value = false
  nextTick(() => document.getElementById('open-errors')?.scrollIntoView({ block: 'start' }))
})

const COLUMNS: Array<[KanjiSortCol, string]> = [
  ['kanji', 'Kanji'],
  ['acc', 'Accuracy'],
  ['box', 'Stage'],
  ['errors', 'Errors'],
]

function sortIcon(col: KanjiSortCol): string {
  if (tableSort.value?.col !== col) return 'sort'
  return tableSort.value.dir === 'asc' ? 'up' : 'down'
}

function sortState(col: KanjiSortCol): string {
  if (tableSort.value?.col !== col) return 'not sorted'
  return tableSort.value.dir === 'asc' ? 'ascending' : 'descending'
}
</script>

<template>
  <div>
    <div class="stats-summary">
      <div class="stat-card correct"><div class="sc-value">{{ summary.mastered }}<small> / {{ summary.total }}</small></div><div class="sc-label">Mastered</div></div>
      <div class="stat-card accent"><div class="sc-value">{{ summary.seen }}<small> / {{ summary.total }}</small></div><div class="sc-label">Kanji seen</div></div>
      <div class="stat-card purple"><div class="sc-value">{{ today.streak }}</div><div class="sc-label">Day streak</div></div>
      <div class="stat-card"><div class="sc-value">{{ summary.accuracy }}</div><div class="sc-label">Accuracy</div></div>
    </div>

    <h2 class="section-title">Kanji chart</h2>
    <p class="section-note">Tap a kanji to see how it's written, how you're doing with it and when it comes back.</p>
    <KanjiChart />

    <div id="open-errors" class="errors-header">
      <h2 class="section-title">Open errors <span class="count-tag">{{ openErrors.length }}</span></h2>
      <button v-if="openErrors.length" class="btn btn-sm" @click="resolveAllErrors()">Mark all resolved</button>
    </div>
    <p class="section-note">A kanji leaves this list once you've mastered it again. Resolving only hides it here, your progress stays.</p>
    <div v-if="openErrors.length === 0" class="no-errors-state">
      <div class="big"><Icon name="check" :size="40" /></div>
      <div class="msg">No open errors</div>
    </div>
    <template v-else>
      <div class="error-table kanji-errors">
        <div v-for="stat in openErrors" :key="stat.id" class="error-row">
          <button class="error-kana" :aria-label="`Details for ${stat.entry.keyword}`" @click="openKanji(stat.entry.kanji)"><span lang="ja">{{ stat.entry.kanji }}</span></button>
          <span class="error-romaji">{{ stat.entry.keyword }}</span>
          <span class="error-facts">
            {{ stat.incorrect }} miss{{ stat.incorrect === 1 ? '' : 'es' }}
            <span class="error-accuracy" :class="accClass(accuracy(stat))">{{ accuracy(stat) }}% right</span>
          </span>
          <button class="btn btn-sm" :aria-label="`Mark ${stat.entry.keyword} as resolved`" @click="resolveErrors([stat.id])">Resolve</button>
        </div>
      </div>
      <button class="btn btn-bad btn-lg btn-block" @click="startErrors()">Practice errors</button>
    </template>

    <h2 class="section-title spaced">All kanji</h2>
    <div v-if="rows.length === 0" class="no-stats-state">
      <div class="big" lang="ja">統</div>
      <div class="msg">No data yet, finish a session to see stats</div>
    </div>
    <div v-else class="stats-table kanji-table">
      <div class="stats-table-header">
        <template v-for="[col, label] in COLUMNS" :key="col">
          <button
            class="stats-th" :class="{ active: tableSort?.col === col, 'col-errors': col === 'errors' }"
            :aria-label="`Sort by ${label.toLowerCase()}, ${sortState(col)}`"
            @click="setTableSort(col)"
          >{{ label }} <Icon :name="sortIcon(col)" :size="14" /></button>
          <span v-if="col === 'kanji'">Meaning</span>
        </template>
      </div>
      <button v-for="r in rows" :key="r.id" class="stats-row" @click="openKanji(r.kanji)">
        <span class="stats-kana-cell" lang="ja">{{ r.kanji }}</span>
        <span class="stats-romaji-cell">{{ r.keyword }}</span>
        <div class="acc-bar-wrap">
          <div class="acc-bar-bg"><div class="acc-bar-fill" :class="accClass(r.acc)" :style="{ width: `${r.acc}%` }"></div></div>
          <span class="stats-num" :class="accClass(r.acc)">{{ r.acc }}%</span>
        </div>
        <span class="stats-stage" :class="stageOf(r.box, true)">
          {{ STAGE_LABEL[stageOf(r.box, true)] }}
          <small>{{ isDue(r, clock) ? 'due' : fromNow(dueAt(r), clock) }}</small>
        </span>
        <span class="stats-num col-errors" :class="r.incorrect > 0 ? 'bad' : 'good'">{{ r.incorrect }}</span>
      </button>
    </div>
  </div>
</template>
