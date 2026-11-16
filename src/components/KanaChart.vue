<script setup lang="ts">
import { inject, computed, ref } from 'vue'
import type { KanaColumn } from '../types'
import { QUIZ_KEY } from '../composables/useQuiz'
import { isDue, isSeen } from '../learning/scheduler'
import { clock } from '../clock'
import { stageOf, STAGE_LABEL } from '../format'
import Icon from './Icon.vue'

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

// dakuten and combos stay folded until the learner gets there or asks for them,
// 58 untouched cells would only push everything below off the screen
const opened = ref(new Set<string>())

const tables = computed(() => selectorScripts.value.map(([script, data]) => ({
  script,
  title: script === 'hiragana' ? 'Hiragana ひらがな' : 'Katakana カタカナ',
  groups: [
    { name: 'main', label: 'Main kana', rows: gojuon(data.main), width: 5 },
    { name: 'dakuten', label: 'Dakuten', rows: plain(data.dakuten), width: 5 },
    { name: 'combo', label: 'Combinations', rows: plain(data.combo), width: 3 },
  ].map(g => {
    const cells = g.rows.flat().filter((c): c is Cell => !!c)
    const key = `${script}:${g.name}`
    return { ...g, key, count: cells.length, open: g.name === 'main' || opened.value.has(key) || cells.some(c => isSeen(statsData.value[c.kana])) }
  }),
})))

function open(key: string): void {
  opened.value = new Set([...opened.value, key])
}

function cellState(kana: string) {
  const e = statsData.value[kana]
  return {
    stage: stageOf(e?.box ?? 0, isSeen(e)),
    due: isSeen(e) && isDue(e, clock.value),
    error: errorKanaSet.value.has(kana),
  }
}

function cellLabel(cell: Cell): string {
  const s = cellState(cell.kana)
  return `${cell.kana} ${cell.romaji}, ${STAGE_LABEL[s.stage]}${s.due ? ', due' : ''}${s.error ? ', open error' : ''}`
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
      <span class="legend-item"><span class="legend-error"></span>Open error</span>
    </div>

    <div v-for="t in tables" :key="t.script" class="chart-script">
      <div v-if="tables.length > 1" class="group-title">{{ t.title }}</div>
      <template v-for="g in t.groups" :key="g.name">
        <div v-if="g.open" class="chart-grid" :class="`w${g.width}`">
          <template v-for="(row, ri) in g.rows" :key="ri">
            <template v-for="(cell, ci) in row" :key="`${ri}-${ci}`">
              <button
                v-if="cell"
                class="chart-cell" :class="[cellState(cell.kana).stage, { due: cellState(cell.kana).due, error: cellState(cell.kana).error }]"
                :aria-label="cellLabel(cell)"
                @click="openKana(cell.kana)"
              >
                <span class="cc-kana">{{ cell.kana }}</span>
                <span class="cc-romaji">{{ cell.romaji }}</span>
              </button>
              <span v-else class="chart-gap" aria-hidden="true"></span>
            </template>
          </template>
        </div>
        <button v-else class="chart-more" @click="open(g.key)">
          <span>{{ g.label }} <small>{{ g.count }} kana, not started</small></span>
          <Icon name="down" :size="18" />
        </button>
      </template>
    </div>
  </div>
</template>
