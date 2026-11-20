<script setup lang="ts">
import { computed, ref } from 'vue'
import { useKanji } from '../composables/useKanji'
import { kanjiEntry } from '../data/kanjiData'
import { isDue, isSeen } from '../learning/scheduler'
import { openKanji } from '../kanjiShell'
import { clock } from '../clock'
import { stageOf, STAGE_LABEL } from '../format'
import Icon from './Icon.vue'

const { sets, statOf, hasError } = useKanji()

// sets nobody has started stay folded until the learner opens one, 17 grids of grey
// cells would push everything below off the screen
const opened = ref(new Set<string>())

const groups = computed(() => sets.map(s => ({
  ...s,
  open: opened.value.has(s.id) || s.kanji.some(k => isSeen(statOf(k))),
})))

function cellState(kanji: string) {
  const stat = statOf(kanji)
  return {
    stage: stageOf(stat?.box ?? 0, isSeen(stat)),
    due: isSeen(stat) && isDue(stat, clock.value),
    error: hasError(kanji),
  }
}

// English around the kanji, so the kanji itself sits in a lang="ja" span inside the button
function cellLabel(kanji: string): string {
  const s = cellState(kanji)
  return `${kanjiEntry(kanji)!.keyword}, ${STAGE_LABEL[s.stage]}${s.due ? ', due' : ''}${s.error ? ', open error' : ''}`
}

const counts = computed(() => {
  const out = { new: 0, learning: 0, reviewing: 0, mastered: 0 }
  for (const s of sets) for (const k of s.kanji) out[cellState(k).stage]++
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

    <template v-for="g in groups" :key="g.id">
      <template v-if="g.open">
        <div class="group-title">{{ g.title }}</div>
        <div class="chart-grid w5">
          <button
            v-for="k in g.kanji" :key="k"
            class="chart-cell" :class="[cellState(k).stage, { due: cellState(k).due, error: cellState(k).error }]"
            @click="openKanji(k)"
          >
            <span class="cc-kana" lang="ja">{{ k }}</span>
            <span class="sr-only">{{ cellLabel(k) }}</span>
          </button>
        </div>
      </template>
      <button v-else class="chart-more" @click="opened = new Set([...opened, g.id])">
        <span>{{ g.title }} <small>{{ g.kanji.length }} kanji, not started</small></span>
        <Icon name="down" :size="18" />
      </button>
    </template>
  </div>
</template>
