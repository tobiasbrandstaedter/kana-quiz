<script setup lang="ts">
import { inject, computed } from 'vue'
import type { QuizDirection } from '../types'
import { QUIZ_KEY } from '../composables/useQuiz'
import { pairFor, kanaForRomaji } from '../data/kana'
import { lookalikesOf, lookalikeHint } from '../data/lookalikes'
import { mnemonicFor } from '../data/mnemonics'
import { dueAt, isDue, isSeen } from '../learning/scheduler'
import { playKana } from '../audio'
import { clock } from '../clock'
import { fromNow, stageOf, accuracy, accClass, STAGE_LABEL } from '../format'
import BottomSheet from './BottomSheet.vue'
import StrokeDemo from './StrokeDemo.vue'
import Icon from './Icon.vue'

const { detailKana, closeKana, statsData, startKanaPractice } = inject(QUIZ_KEY)!

const kana = computed(() => detailKana.value ?? '')
const pair = computed(() => pairFor(kana.value))
const entry = computed(() => statsData.value[kana.value])
const seen = computed(() => isSeen(entry.value))
const stage = computed(() => stageOf(entry.value?.box ?? 0, seen.value))
const others = computed(() => lookalikesOf(kana.value))

const DIRECTIONS: Array<[QuizDirection, string]> = [
  ['romaji-to-kana', 'Recognize'],
  ['kana-to-romaji', 'Read'],
  ['draw', 'Write'],
]

const directions = computed(() => DIRECTIONS.map(([d, label]) => {
  const s = entry.value?.byDirection[d]
  const tried = !!s && s.correct + s.incorrect > 0
  return { label, state: tried ? accClass(accuracy(s)) : 'none', text: tried ? `${s.correct} right, ${s.incorrect} wrong` : 'not tried' }
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

// the same moment the chart shows its due dot for
const reviewText = computed(() => {
  const e = entry.value
  if (!e) return ''
  return isDue(e, clock.value) ? 'Due now' : `Next review ${fromNow(dueAt(e), clock.value)}`
})

function practice(): void {
  const k = kana.value
  closeKana()
  startKanaPractice([k, ...lookalikesOf(k)])
}
</script>

<template>
  <BottomSheet v-if="detailKana && pair" :title="`${kana} ${pair.romaji}`" @close="closeKana()">
    <template #title><span lang="ja">{{ kana }}</span> {{ pair.romaji }}</template>
    <div class="kana-detail">
      <div class="kd-top">
        <div class="kd-glyph">
          <StrokeDemo :key="kana" :kana="kana" controls />
        </div>
        <!-- kana and romaji are the sheet title, so this row only adds what the title can't say -->
        <div class="kd-facts">
          <button class="icon-btn boxed butter" :aria-label="`Play ${pair.romaji}`" @click="playKana(kana)"><Icon name="speaker" :size="20" /></button>
          <div class="kd-stage" :class="stage">{{ STAGE_LABEL[stage] }}</div>
          <div v-if="seen && entry" class="kd-lines">
            <div class="kd-line">{{ reviewText }}</div>
            <div class="kd-line">
              {{ accuracy(entry) }}% right over {{ entry.correct + entry.incorrect }} answer{{ entry.correct + entry.incorrect === 1 ? '' : 's' }}
            </div>
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
          <span v-for="c in confusions" :key="c.kana" class="kd-chip"><span class="kana" lang="ja">{{ c.kana }}</span> {{ c.n }}×</span>
        </div>
      </div>

      <div v-if="others.length" class="kd-block">
        <div class="kd-block-title">Looks like <span class="kana" lang="ja">{{ others.join('・') }}</span></div>
        <div class="kd-hint">{{ lookalikeHint(kana, others[0]) }}</div>
      </div>

      <button class="btn btn-primary btn-lg btn-block" @click="practice()">Practice {{ others.length ? 'with lookalikes' : 'this kana' }}</button>
    </div>
  </BottomSheet>
</template>
