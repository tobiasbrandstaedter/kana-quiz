<script setup lang="ts">
import { onMounted, nextTick } from 'vue'
import type { KanjiSortCol } from '../types'
import { useKanji } from '../composables/useKanji'
import { dueAt, isDue } from '../learning/scheduler'
import { clock } from '../clock'
import { fromNow, stageOf, accuracy, accClass, STAGE_LABEL } from '../format'
import { openKanji } from '../kanjiShell'
import KanjiChart from './KanjiChart.vue'
import KanjiPatternCards from './KanjiPatternCards.vue'
import Icon from './Icon.vue'

const {
  summary, openErrors, resolveErrors, resolveAllErrors, startErrors,
  rows, tableShow, tableSort, setTableSort, errorsScrollPending, allPatterns, startPattern,
} = useKanji()

// the errors tile on the Practice tab led here
onMounted(() => {
  if (!errorsScrollPending.value) return
  errorsScrollPending.value = false
  nextTick(() => document.getElementById('open-errors')?.scrollIntoView({ block: 'start' }))
})

const COLUMNS: Array<[KanjiSortCol, string]> = [
  ['kanji', 'Item'],
  ['acc', 'Accuracy'],
  ['box', 'Stage'],
  ['errors', 'Errors'],
]

const SHOW = [['all', 'All'], ['kanji', 'Kanji'], ['words', 'Words']] as const

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
      <div class="stat-card purple"><div class="sc-value">{{ summary.wordsMastered }}</div><div class="sc-label">Words mastered</div></div>
      <div class="stat-card"><div class="sc-value">{{ summary.accuracy }}</div><div class="sc-label">Accuracy</div></div>
    </div>

    <h2 class="section-title">Kanji chart</h2>
    <p class="section-note">Tap a kanji to see how it's written, how you're doing with it and when it comes back.</p>
    <KanjiChart />

    <KanjiPatternCards
      v-if="summary.itemsSeen > 0"
      :patterns="allPatterns"
      title="Detected patterns"
      empty-text="No patterns yet. Keep practicing, this fills in as errors pile up."
      @practice="startPattern"
    />

    <div id="open-errors" class="errors-header">
      <h2 class="section-title">Open errors <span class="count-tag">{{ openErrors.length }}</span></h2>
      <button v-if="openErrors.length" class="btn btn-sm" @click="resolveAllErrors()">Mark all resolved</button>
    </div>
    <p class="section-note">Kanji and words leave this list once you've mastered them again. Resolving only hides them here, your progress stays.</p>
    <div v-if="openErrors.length === 0" class="no-errors-state">
      <div class="big"><Icon name="check" :size="40" /></div>
      <div class="msg">No open errors</div>
    </div>
    <template v-else>
      <div class="error-table kanji-errors">
        <div v-for="stat in openErrors" :key="stat.id" class="error-row">
          <button
            class="error-kana" :class="{ word: stat.item.kind === 'word' }" :style="{ '--len': [...stat.item.text].length }"
            :aria-label="`Details for ${stat.item.meaning}`" @click="openKanji(stat.item.home)"
          ><span lang="ja">{{ stat.item.text }}</span></button>
          <span class="error-romaji">
            <span v-if="stat.item.reading" class="error-reading" lang="ja">{{ stat.item.reading }}</span>
            {{ stat.item.meaning }}
          </span>
          <span class="error-facts">
            {{ stat.incorrect }} miss{{ stat.incorrect === 1 ? '' : 'es' }}
            <span class="error-accuracy" :class="accClass(accuracy(stat))">{{ accuracy(stat) }}% right</span>
          </span>
          <button class="btn btn-sm" :aria-label="`Mark ${stat.item.meaning} as resolved`" @click="resolveErrors([stat.id])">Resolve</button>
        </div>
      </div>
      <button class="btn btn-bad btn-lg btn-block" @click="startErrors()">Practice errors</button>
    </template>

    <div class="section-head">
      <h2 class="section-title">Kanji and words</h2>
    </div>
    <div class="chip-row table-show" role="group" aria-label="Show in the table">
      <button
        v-for="[value, text] in SHOW" :key="value" class="chip" :class="{ active: tableShow === value }"
        :aria-pressed="tableShow === value" @click="tableShow = value"
      >{{ text }}</button>
    </div>
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
      <button v-for="r in rows" :key="r.item.id" class="stats-row" @click="openKanji(r.item.home)">
        <span
          class="stats-kana-cell" :class="{ word: r.item.kind === 'word' }" :style="{ '--len': [...r.item.text].length }" lang="ja"
        >{{ r.item.text }}</span>
        <span class="stats-romaji-cell">
          <span v-if="r.item.reading" class="stats-reading" lang="ja">{{ r.item.reading }}</span>
          {{ r.item.meaning }}
        </span>
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
