<script setup lang="ts">
import { inject, ref, computed } from 'vue'
import { QUIZ_KEY } from '../composables/useQuiz'
import { pairFor } from '../data/kana'
import { lookalikesOf } from '../data/lookalikes'
import { playKana } from '../audio'
import type { DrawResult } from '../types'
import StrokeDemo from './StrokeDemo.vue'
import StrokeCanvas from './StrokeCanvas.vue'

const { strokeColumns } = inject(QUIZ_KEY)!

const allKana = computed(() => strokeColumns.value.flatMap(c => c.kana))
const picked = ref<string>('')

// falls back to the first kana when the selection changes under it
const current = computed(() => allKana.value.includes(picked.value) ? picked.value : allKana.value[0] ?? '')
const romaji = computed(() => pairFor(current.value)?.romaji ?? '')
const lookalikes = computed(() => lookalikesOf(current.value).join('・'))

// watch the animation, trace over it, then write it from memory
type View = 'watch' | 'trace' | 'recall'
const VIEWS: Array<[View, string]> = [['watch', 'Watch'], ['trace', 'Trace'], ['recall', 'Write']]
const view = ref<View>('watch')
const attempt = ref(0)  // bumped to give the canvas a fresh start
const outcome = ref<DrawResult | null>(null)

// writing from memory is pointless with the answer on screen
const hideKana = computed(() => view.value === 'recall' && !outcome.value)

function setView(v: View): void {
  view.value = v
  retry()
}

function retry(): void {
  outcome.value = null
  attempt.value++
}

const panelEl = ref<HTMLElement | null>(null)

// the grid can be long on a phone, bring the demo back into view
function pick(k: string): void {
  picked.value = k
  outcome.value = null
  panelEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function move(delta: number): void {
  const list = allKana.value
  const i = list.indexOf(current.value)
  picked.value = list[(i + delta + list.length) % list.length]
  outcome.value = null
}
</script>

<template>
  <div>
    <div v-if="current" ref="panelEl" class="stroke-panel">
      <div class="stroke-stage">
        <div class="stroke-views" role="group" aria-label="Practice mode">
          <button
            v-for="[v, label] in VIEWS" :key="v"
            class="stroke-view" :class="{ active: view === v }"
            @click="setView(v)"
          >{{ label }}</button>
        </div>
        <StrokeDemo v-if="view === 'watch'" :kana="current" controls />
        <template v-else>
          <StrokeCanvas :key="`${current}-${attempt}`" :kana="current" :mode="view" @done="outcome = $event" />
          <div v-if="outcome" class="stroke-outcome" :class="{ good: outcome.correct }">
            {{ outcome.correct ? '✓ Clean, every stroke in order' : 'Done, with some help. Once more?' }}
            <button class="stroke-ctl" @click="retry()">AGAIN</button>
          </div>
        </template>
      </div>
      <div class="stroke-info">
        <div class="stroke-kana kana" :class="{ hidden: hideKana }">{{ hideKana ? '?' : current }}</div>
        <div class="stroke-romaji">{{ romaji }}</div>
        <button class="stroke-audio" :aria-label="`Play ${romaji}`" @click="playKana(current)">🔊</button>
        <div v-if="lookalikes && !hideKana" class="stroke-lookalikes">Don't mix up with <span class="kana">{{ lookalikes }}</span></div>
        <div class="stroke-nav">
          <button class="stroke-ctl" @click="move(-1)">◀ PREV</button>
          <button class="stroke-ctl" @click="move(1)">NEXT ▶</button>
        </div>
      </div>
    </div>

    <div class="section-label">Pick a kana</div>
    <div class="stroke-note">Shows the columns selected on the Practice tab, or all of them if none is selected. Combinations are written as the base kana followed by the small ya, yu or yo.</div>
    <div v-for="col in strokeColumns" :key="col.id" class="stroke-row">
      <span class="stroke-row-label">{{ col.label }}</span>
      <button
        v-for="k in col.kana" :key="k"
        class="stroke-pick kana" :class="{ active: k === current }"
        @click="pick(k)"
      >{{ k }}</button>
    </div>

    <div class="credit">
      Stroke data from <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a>
      by Ulrich Apel, licensed under
      <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>.
    </div>
  </div>
</template>
