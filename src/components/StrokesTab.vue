<script setup lang="ts">
import { inject, ref, computed, watch, nextTick } from 'vue'
import { QUIZ_KEY } from '../composables/useQuiz'
import { pairFor } from '../data/kana'
import { lookalikesOf } from '../data/lookalikes'
import { mnemonicFor } from '../data/mnemonics'
import { playKana } from '../audio'
import type { DrawResult } from '../types'
import StrokeDemo from './StrokeDemo.vue'
import StrokeCanvas from './StrokeCanvas.vue'
import Icon from './Icon.vue'

// every row of the script on screen, whatever is picked for the custom quiz
const { activeCols: strokeColumns, statsData, recordWritePractice } = inject(QUIZ_KEY)!

const allKana = computed(() => strokeColumns.value.flatMap(c => c.kana))
const picked = ref<string>('')

// falls back to the first kana when the selection changes under it
const current = computed(() => allKana.value.includes(picked.value) ? picked.value : allKana.value[0] ?? '')
const romaji = computed(() => pairFor(current.value)?.romaji ?? '')
const lookalikes = computed(() => lookalikesOf(current.value).join('・'))
const currentCol = computed(() => strokeColumns.value.find(c => c.kana.includes(current.value)))

// watch the animation, trace over it, then write it from memory
type View = 'watch' | 'trace' | 'recall'
const VIEWS: Array<[View, string]> = [['watch', 'Watch'], ['trace', 'Trace'], ['recall', 'Write']]
const view = ref<View>('watch')
const attempt = ref(0)  // bumped to give the canvas a fresh start
const outcome = ref<DrawResult | null>(null)
// the current kana was on screen since it was picked, so a write isn't really from memory
let peeked = true
const saved = ref<ReturnType<typeof recordWritePractice>>(null)
const stageEl = ref<HTMLElement | null>(null)

// writing from memory is pointless with the answer on screen
const hideKana = computed(() => view.value === 'recall' && !outcome.value)

function setView(v: View): void {
  view.value = v
  if (v !== 'recall') peeked = true
  retry()
  // on a phone the canvas starts below the fold, and it can't be scrolled by dragging on it
  if (v !== 'watch') nextTick(() => stageEl.value?.scrollIntoView({ block: 'start' }))
}

function retry(): void {
  outcome.value = null
  attempt.value++
}

function onDone(result: DrawResult): void {
  outcome.value = result
  // only a clean write from memory counts as an answer, practice shouldn't cost a review box
  if (view.value === 'recall') saved.value = recordWritePractice(current.value, result, peeked)
  // the finished kana is shown, anything after this is a repeat with the answer seen
  peeked = true
}

const CLEAN_TEXT = {
  saved: 'Saved as a correct answer.',
  repeat: 'Clean again. One write a day counts per kana.',
  new: 'Clean! It will count once this kana is part of your practice.',
}

const outcomeText = computed(() => {
  if (!outcome.value?.correct) return 'Done, with some help. Once more?'
  if (view.value === 'trace') return 'Now try it from memory.'
  return saved.value ? CLEAN_TEXT[saved.value] : ''
})

function pick(k: string): void {
  picked.value = k
  outcome.value = null
  peeked = view.value !== 'recall'
}

function pickColumn(id: string): void {
  const col = strokeColumns.value.find(c => c.id === id)
  if (col) pick(col.kana[0])
}

function move(delta: number): void {
  const list = allKana.value
  const i = list.indexOf(current.value)
  pick(list[(i + delta + list.length) % list.length])
}

// ✓ once written cleanly from memory, anywhere in the app
function written(k: string): boolean {
  return (statsData.value[k]?.byDirection.draw?.correct ?? 0) > 0
}

// keep the active row chip in view when stepping through with prev and next
const rowsEl = ref<HTMLElement | null>(null)
watch(currentCol, col => {
  if (!col) return
  rowsEl.value?.querySelector<HTMLElement>(`[data-col="${col.id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
})
</script>

<template>
  <div>
    <div class="stroke-rows" ref="rowsEl" role="tablist" aria-label="Rows">
      <button
        v-for="col in strokeColumns" :key="col.id" :data-col="col.id"
        class="row-chip" :class="{ active: col.id === currentCol?.id }"
        role="tab" :aria-selected="col.id === currentCol?.id"
        @click="pickColumn(col.id)"
      ><span class="kana">{{ col.sample }}</span> {{ col.romaji[0] }}</button>
    </div>
    <div v-if="currentCol" class="stroke-picks">
      <button
        v-for="k in currentCol.kana" :key="k"
        class="stroke-pick kana" :class="{ active: k === current, written: written(k) }"
        :aria-label="hideKana && k === current ? 'The kana to write' : `${k}${written(k) ? ', written cleanly before' : ''}`"
        @click="pick(k)"
      >{{ hideKana && k === current ? '?' : k }}</button>
    </div>

    <div v-if="current" class="stroke-panel">
      <div class="stroke-info">
        <div class="stroke-kana kana" :class="{ hidden: hideKana }">{{ hideKana ? '?' : current }}</div>
        <div class="stroke-romaji">{{ romaji }}</div>
        <button class="icon-btn boxed butter" :aria-label="`Play ${romaji}`" @click="playKana(current)"><Icon name="speaker" :size="20" /></button>
        <div class="stroke-nav">
          <button class="icon-btn boxed" aria-label="Previous kana" @click="move(-1)"><Icon name="left" :size="20" /></button>
          <button class="icon-btn boxed" aria-label="Next kana" @click="move(1)"><Icon name="right" :size="20" /></button>
        </div>
      </div>
      <div v-if="!hideKana && (lookalikes || mnemonicFor(current))" class="stroke-tips">
        <div v-if="mnemonicFor(current)" class="stroke-mnemonic">{{ mnemonicFor(current) }}</div>
        <div v-if="lookalikes" class="stroke-lookalikes">Don't mix up with <span class="kana">{{ lookalikes }}</span></div>
      </div>

      <div ref="stageEl" class="stroke-stage">
        <div class="stroke-views" role="group" aria-label="Practice mode">
          <button
            v-for="[v, label] in VIEWS" :key="v"
            class="stroke-view" :class="{ active: view === v }"
            :aria-pressed="view === v"
            @click="setView(v)"
          >{{ label }}</button>
        </div>
        <StrokeDemo v-if="view === 'watch'" :kana="current" controls />
        <template v-else>
          <StrokeCanvas :key="`${current}-${attempt}`" :kana="current" :mode="view" @done="onDone" />
          <div v-if="outcome" class="stroke-outcome" :class="{ good: outcome.correct }">
            {{ outcomeText }}
            <button v-if="outcome.correct && view === 'trace'" class="stroke-ctl" @click="setView('recall')">Write it</button>
            <button v-else-if="outcome.correct" class="stroke-ctl" @click="move(1)">Next kana</button>
            <button class="stroke-ctl" @click="retry()">Again</button>
          </div>
        </template>
      </div>
    </div>

    <p class="stroke-note">
      ✓ marks kana you have written cleanly from memory. Combinations are the base kana followed by a small ya, yu or yo.
    </p>

    <div class="credit">
      Stroke data from <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a>
      by Ulrich Apel, licensed under
      <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>.
    </div>
  </div>
</template>
