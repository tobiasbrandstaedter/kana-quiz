<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { DrawResult } from '../types'
import { useKanji } from '../composables/useKanji'
import { allKanji, courseEntries, kanjiEntry, kanjiLookalikes, kanjiStrokes, ownWords } from '../data/kanjiData'
import { openKanji } from '../kanjiShell'
import StrokeDemo from './StrokeDemo.vue'
import StrokeCanvas from './StrokeCanvas.vue'
import Icon from './Icon.vue'

const { sets } = useKanji()

const all = allKanji()
const picked = ref(all[0].kanji)

const entry = computed(() => kanjiEntry(picked.value)!)
const set = computed(() => sets.find(s => s.id === entry.value.set)!)
const strokes = computed(() => kanjiStrokes(picked.value) ?? undefined)

const parts = computed(() => courseEntries(entry.value.parts))
const lookalikes = computed(() => courseEntries(kanjiLookalikes(picked.value)))
const words = computed(() => ownWords(picked.value))

// writing from memory comes in a later release (KD11), watch and trace are here from the start
type View = 'watch' | 'trace'
const VIEWS: Array<[View, string]> = [['watch', 'Watch'], ['trace', 'Trace']]
const view = ref<View>('watch')
const attempt = ref(0)  // bumped to give the canvas a fresh start
const outcome = ref<DrawResult | null>(null)
const stageEl = ref<HTMLElement | null>(null)

function setView(v: View): void {
  view.value = v
  retry()
  // on a phone the canvas starts below the fold, and it can't be scrolled by dragging on it
  if (v === 'trace') nextTick(() => stageEl.value?.scrollIntoView({ block: 'start' }))
}

function retry(): void {
  outcome.value = null
  attempt.value++
}

function pick(kanji: string): void {
  // the canvas is keyed by the kanji, the same one again keeps it and so keeps its outcome too
  if (kanji === picked.value) return
  picked.value = kanji
  outcome.value = null
}

function move(delta: number): void {
  const i = all.findIndex(x => x.kanji === picked.value)
  pick(all[(i + delta + all.length) % all.length].kanji)
}

// keep the active set chip in view when stepping through with prev and next. Only the chip
// row scrolls, scrollIntoView would move the page too and push the canvas away
const setsEl = ref<HTMLElement | null>(null)
watch(set, s => {
  const row = setsEl.value
  const chip = row?.querySelector<HTMLElement>(`[data-set="${s.id}"]`)
  if (!row || !chip) return
  const offset = chip.getBoundingClientRect().left - row.getBoundingClientRect().left
  row.scrollTo({ left: row.scrollLeft + offset - (row.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' })
})
</script>

<template>
  <div>
    <div class="stroke-rows" ref="setsEl" role="tablist" aria-label="Sets">
      <button
        v-for="s in sets" :key="s.id" :data-set="s.id"
        class="row-chip" :class="{ active: s.id === set.id }"
        role="tab" :aria-selected="s.id === set.id"
        @click="pick(s.kanji[0])"
      ><span class="kana" lang="ja">{{ s.kanji[0] }}</span> {{ s.title }}</button>
    </div>
    <div class="stroke-picks">
      <button
        v-for="x in set.kanji" :key="x"
        class="stroke-pick kana" :class="{ active: x === picked }"
        :aria-pressed="x === picked"
        @click="pick(x)"
      ><span lang="ja">{{ x }}</span></button>
    </div>

    <div class="stroke-panel">
      <div class="stroke-info">
        <div class="stroke-kana kana" lang="ja">{{ entry.kanji }}</div>
        <div class="stroke-keyword">{{ entry.keyword }}</div>
        <div class="stroke-nav">
          <button class="icon-btn boxed" aria-label="Previous kanji" @click="move(-1)"><Icon name="left" :size="20" /></button>
          <button class="icon-btn boxed" aria-label="Next kanji" @click="move(1)"><Icon name="right" :size="20" /></button>
        </div>
      </div>
      <div class="stroke-tips">
        <div v-if="entry.hook" class="stroke-mnemonic">{{ entry.hook }}</div>
        <div v-if="parts.length" class="kd-block">
          <div class="kd-block-title">Built from</div>
          <div class="kd-chips">
            <button v-for="part in parts" :key="part.kanji" class="kanji-chip" @click="openKanji(part.kanji)">
              <span class="kc-kanji" lang="ja">{{ part.kanji }}</span> {{ part.keyword }}
            </button>
          </div>
        </div>
        <div v-if="words.length" class="kd-block">
          <div class="kd-block-title">Words</div>
          <div class="kd-words">
            <div v-for="w in words" :key="w.id" class="kd-word-main">
              <span class="kd-word-form" lang="ja">{{ w.form }}</span>
              <span class="kd-word-reading" lang="ja">{{ w.reading }}</span>
              <span class="kd-word-gloss">{{ w.gloss }}</span>
            </div>
          </div>
        </div>
        <div v-if="lookalikes.length" class="kd-block">
          <div class="kd-block-title">Don't mix up with</div>
          <div class="kd-chips">
            <button v-for="other in lookalikes" :key="other.kanji" class="kanji-chip" @click="openKanji(other.kanji)">
              <span class="kc-kanji" lang="ja">{{ other.kanji }}</span> {{ other.keyword }}
            </button>
          </div>
        </div>
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
        <template v-if="strokes">
          <StrokeDemo v-if="view === 'watch'" :key="picked" :kana="picked" :glyph="strokes" controls />
          <template v-else>
            <StrokeCanvas :key="`${picked}-${attempt}`" :kana="picked" :glyph="strokes" mode="trace" @done="outcome = $event" />
            <div v-if="outcome" class="stroke-outcome" :class="{ good: outcome.correct }">
              {{ outcome.correct ? 'Clean trace.' : 'Done, with some help. Once more?' }}
              <button v-if="outcome.correct" class="stroke-ctl" @click="move(1)">Next kanji</button>
              <button class="stroke-ctl" @click="retry()">Again</button>
            </div>
          </template>
        </template>
      </div>
    </div>

    <p class="stroke-note">Tap a part or a lookalike for its details. Writing kanji from memory comes in a later update.</p>

    <div class="credit">
      Stroke data from <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a>
      by Ulrich Apel, licensed under
      <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>.
    </div>
  </div>
</template>
