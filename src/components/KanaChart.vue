<script setup lang="ts">
import { inject, computed } from 'vue'
import type { KanaColumn } from '../types'
import { QUIZ_KEY } from '../composables/useQuiz'
import { isDue } from '../learning/scheduler'
import { stageOf, STAGE_LABEL } from '../format'

const { selectorScripts, statsData, errorKanaSet, openKana } = inject(QUIZ_KEY)!

const VOWELS = ['a', 'i', 'u', 'e', 'o']

interface Cell { kana: string; romaji: string }

// the main table in the classic gojūon layout: one row per consonant, one column per vowel,
// gaps where や and わ have no kana, ん on its own at the end
function gojuon(cols: KanaColumn[]): Array<Array<Cell | null>> {
  const rows: Array<Array<Cell | null>> = []
  let n: Cell | null = null
  for (const col of cols) {
    const row: Array<Cell | null> = VOWELS.map(() => null)
    col.kana.forEach((k, i) => {
      const r = col.romaji[i]
      const v = VOWELS.indexOf(r[r.length - 1])
      if (v === -1) n = { kana: k, romaji: r }
      else row[v] = { kana: k, romaji: r }
    })
    rows.push(row)
  }
  if (n) rows.push([n, null, null, null, null])
  return rows
}

function plain(cols: KanaColumn[]): Array<Array<Cell | null>> {
  return cols.map(c => c.kana.map((k, i) => ({ kana: k, romaji: c.romaji[i] })))
}

const tables = computed(() => selectorScripts.value.map(([script, data]) => ({
  script,
  title: script === 'hiragana' ? 'Hiragana ひらがな' : 'Katakana カタカナ',
  groups: [
    { name: 'main', rows: gojuon(data.main), width: 5 },
    { name: 'dakuten', rows: plain(data.dakuten), width: 5 },
    { name: 'combo', rows: plain(data.combo), width: 3 },
  ],
})))

function cellState(kana: string) {
  const e = statsData.value[kana]
  const seen = !!e && e.correct + e.incorrect > 0
  return {
    stage: stageOf(e?.box ?? 0, seen),
    due: seen && isDue(e!, Date.now()),
    error: errorKanaSet.value.has(kana),
  }
}

const counts = computed(() => {
  const out = { new: 0, learning: 0, reviewing: 0, mastered: 0 }
  for (const t of tables.value)
    for (const g of t.groups)
      for (const row of g.rows)
        for (const c of row) if (c) out[cellState(c.kana).stage]++
  return out
})
</script>

<template>
  <div class="chart">
    <div class="chart-legend">
      <span v-for="s in (['mastered', 'reviewing', 'learning', 'new'] as const)" :key="s" class="legend-item">
        <span class="legend-swatch" :class="s"></span>{{ STAGE_LABEL[s] }} {{ counts[s] }}
      </span>
      <span class="legend-item"><span class="legend-due"></span>Due</span>
    </div>

    <div v-for="t in tables" :key="t.script" class="chart-script">
      <div v-if="tables.length > 1" class="group-title">{{ t.title }}</div>
      <div v-for="g in t.groups" :key="g.name" class="chart-grid" :class="`w${g.width}`">
        <template v-for="(row, ri) in g.rows" :key="ri">
          <template v-for="(cell, ci) in row" :key="`${ri}-${ci}`">
            <button
              v-if="cell"
              class="chart-cell" :class="[cellState(cell.kana).stage, { due: cellState(cell.kana).due, error: cellState(cell.kana).error }]"
              :aria-label="`${cell.kana} ${cell.romaji}, ${STAGE_LABEL[cellState(cell.kana).stage]}${cellState(cell.kana).due ? ', due' : ''}`"
              @click="openKana(cell.kana)"
            >
              <span class="cc-kana">{{ cell.kana }}</span>
              <span class="cc-romaji">{{ cell.romaji }}</span>
            </button>
            <span v-else class="chart-gap" aria-hidden="true"></span>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
