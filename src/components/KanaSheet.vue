<script setup lang="ts">
import { inject, computed } from 'vue'
import type { QuizDirection } from '../types'
import { QUIZ_KEY } from '../composables/useQuiz'
import { pairFor, kanaForRomaji } from '../data/kana'
import { lookalikesOf, lookalikeHint } from '../data/lookalikes'
import { mnemonicFor } from '../data/mnemonics'
import { kanaStrokes } from '../data/strokeGlyphs'
import { playKana } from '../audio'
import { fromNow, stageOf, STAGE_LABEL } from '../format'
import BottomSheet from './BottomSheet.vue'
import StrokeDemo from './StrokeDemo.vue'
import Icon from './Icon.vue'

const { detailKana, closeKana, statsData, startKanaPractice } = inject(QUIZ_KEY)!

const kana = computed(() => detailKana.value ?? '')
const pair = computed(() => pairFor(kana.value))
const entry = computed(() => statsData.value[kana.value])
const seen = computed(() => !!entry.value && entry.value.correct + entry.value.incorrect > 0)
const stage = computed(() => stageOf(entry.value?.box ?? 0, seen.value))
const others = computed(() => lookalikesOf(kana.value))

const DIRECTIONS: Array<[QuizDirection, string]> = [
  ['romaji-to-kana', 'Recognize'],
  ['kana-to-romaji', 'Read'],
  ['draw', 'Write'],
]

const directions = computed(() => DIRECTIONS.map(([d, label]) => {
  const s = entry.value?.byDirection[d]
  const state = !s || s.correct + s.incorrect === 0 ? 'none' : s.correct >= s.incorrect ? 'good' : 'bad'
  return { label, state, text: s ? `${s.correct} right, ${s.incorrect} wrong` : 'not tried' }
}))

// what the user answered instead, as kana where possible
const confusions = computed(() => {
  const e = entry.value
  if (!e) return []
  return Object.entries(e.confusions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([given, n]) => ({ kana: pairFor(given) ? given : kanaForRomaji(given, e.script) ?? given, n }))
})

const accuracy = computed(() => {
  const e = entry.value
  return e && seen.value ? Math.round((e.correct / (e.correct + e.incorrect)) * 100) : null
})

function practice(): void {
  const k = kana.value
  closeKana()
  startKanaPractice([k, ...lookalikesOf(k)])
}
</script>

<template>
  <BottomSheet v-if="detailKana && pair" :title="`${kana} ${pair.romaji}`" @close="closeKana()">
    <div class="kana-detail">
      <div class="kd-top">
        <div class="kd-glyph">
          <StrokeDemo v-if="kanaStrokes(kana)" :key="kana" :kana="kana" controls />
          <div v-else class="kd-kana">{{ kana }}</div>
        </div>
        <div class="kd-facts">
          <div class="kd-romaji">{{ pair.romaji }}</div>
          <button class="icon-btn boxed butter" :aria-label="`Play ${pair.romaji}`" @click="playKana(kana)"><Icon name="speaker" :size="20" /></button>
          <div class="kd-stage" :class="stage">{{ STAGE_LABEL[stage] }}</div>
          <div v-if="seen && entry" class="kd-line">
            {{ fromNow(entry.due) === 'now' ? 'Due now' : `Next review ${fromNow(entry.due)}` }}
          </div>
          <div v-if="accuracy !== null && entry" class="kd-line">
            {{ accuracy }}% right over {{ entry.correct + entry.incorrect }} answer{{ entry.correct + entry.incorrect === 1 ? '' : 's' }}
          </div>
        </div>
      </div>

      <div v-if="mnemonicFor(kana)" class="mnemonic"><Icon name="bulb" :size="20" /><span>{{ mnemonicFor(kana) }}</span></div>

      <div class="kd-dirs">
        <div v-for="d in directions" :key="d.label" class="kd-dir" :class="d.state">
          <span class="kd-dot" aria-hidden="true"></span>
          <span class="kd-dir-label">{{ d.label }}</span>
          <span class="kd-dir-text">{{ d.text }}</span>
        </div>
      </div>

      <div v-if="confusions.length" class="kd-block">
        <div class="kd-block-title">Mixed up with</div>
        <div class="kd-chips">
          <span v-for="c in confusions" :key="c.kana" class="kd-chip"><span class="kana">{{ c.kana }}</span> {{ c.n }}×</span>
        </div>
      </div>

      <div v-if="others.length" class="kd-block">
        <div class="kd-block-title">Looks like <span class="kana">{{ others.join('・') }}</span></div>
        <div class="kd-hint">{{ lookalikeHint(kana, others[0]) }}</div>
      </div>

      <button class="btn btn-primary btn-lg btn-block" @click="practice()">Practice {{ others.length ? 'with lookalikes' : 'this kana' }}</button>
    </div>
  </BottomSheet>
</template>
