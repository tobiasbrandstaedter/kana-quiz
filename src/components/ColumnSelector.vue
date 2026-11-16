<script setup lang="ts">
import type { KanaData, ScriptName } from '../types'
import type { ColumnProgress } from '../learning/scheduler'
import { GROUP_NAMES } from '../data/kana'

defineProps<{
  selectorScripts: Array<[ScriptName, KanaData]>
  selectedCols: Set<string>
  errorKanaSet: Set<string>
  progress: Record<string, ColumnProgress>
}>()

function pct(part: number, total: number): string {
  return `${Math.round((part / total) * 100)}%`
}

function progressTitle(p: ColumnProgress | undefined): string {
  if (!p || p.seen === 0) return 'Not started'
  return `${p.mastered}/${p.total} mastered, ${p.seen - p.mastered} learning, ${p.due} due`
}

const emit = defineEmits<{
  toggle: [id: string]
  selectAll: []
  selectNone: []
  selectGroup: [group: string]
}>()
</script>

<template>
  <div class="selector-panel">
    <div class="quick-row">
      <button class="quick-btn" @click="emit('selectAll')">All</button>
      <button class="quick-btn" @click="emit('selectNone')">None</button>
      <button class="quick-btn" @click="emit('selectGroup', 'main')">Main</button>
      <button class="quick-btn" @click="emit('selectGroup', 'dakuten')">Dakuten</button>
      <button class="quick-btn" @click="emit('selectGroup', 'combo')">Combos</button>
    </div>

    <!-- touch screens have no tooltips, so the bar colors are spelled out here -->
    <div class="selector-legend">
      <span class="legend-item"><span class="legend-swatch mastered"></span>Mastered</span>
      <span class="legend-item"><span class="legend-swatch learning"></span>Learning</span>
      <span class="legend-item"><span class="legend-error"></span>Open errors</span>
    </div>

    <template v-for="([scriptName, columns], si) in selectorScripts" :key="scriptName">
      <div v-if="selectorScripts.length > 1" class="script-title" :class="{ first: si === 0 }">
        {{ scriptName === 'hiragana' ? 'Hiragana (ひらがな)' : 'Katakana (カタカナ)' }}
      </div>

      <template v-for="[group, cols] in Object.entries(columns)" :key="group">
        <div class="group-title">
          {{ GROUP_NAMES[group] }}
        </div>
        <div class="column-grid">
          <button
            v-for="col in cols" :key="col.id"
            class="col-btn"
            :class="{
              active: selectedCols.has(col.id),
              'has-errors': col.kana.some(k => errorKanaSet.has(k)),
              mastered: progress[col.id]?.mastered === col.kana.length,
            }"
            :title="progressTitle(progress[col.id])"
            :aria-pressed="selectedCols.has(col.id)"
            :aria-label="`${col.label}, ${progressTitle(progress[col.id])}`"
            @click="emit('toggle', col.id)"
          >
            <span class="kana-sample">{{ col.sample }}</span>
            <!-- romaji, so the rows can be told apart before the kana can be read -->
            <span class="romaji-label">{{ col.romaji[0] }}</span>
            <span class="error-dot"></span>
            <span v-if="progress[col.id]?.seen" class="col-progress" aria-hidden="true">
              <span class="mastered" :style="{ width: pct(progress[col.id].mastered, col.kana.length) }"></span>
              <span class="learning" :style="{ width: pct(progress[col.id].seen - progress[col.id].mastered, col.kana.length) }"></span>
            </span>
          </button>
        </div>
      </template>
    </template>
  </div>
</template>
