<script setup lang="ts">
import { computed } from 'vue'
import { useKanji } from '../composables/useKanji'
import { fromNow } from '../format'
import Icon from './Icon.vue'

const { resultScore, resultLabel, missed, roundOutcome, startSmart, goHome } = useKanji()

const outlookText = computed(() => {
  const o = roundOutcome.value.outlook
  if (o.now) return `${o.now} kanji ${o.now === 1 ? 'is' : 'are'} due now.`
  if (o.soon) return `${o.soon} kanji come back within a day.`
  if (o.nextAt) return `Next review ${fromNow(o.nextAt)}.`
  return ''
})

// nothing left to plan: back to the Practice tab, it says why
function again(): void {
  if (!startSmart()) goHome()
}
</script>

<template>
  <div class="results">
    <section class="result-card">
      <span class="eyebrow">Session complete</span>
      <div class="result-score">{{ resultScore }}</div>
      <div class="result-title">{{ resultLabel.title }} <span v-if="resultLabel.jp" class="kana" lang="ja">{{ resultLabel.jp }}</span></div>
      <div class="result-detail">{{ resultLabel.detail }}</div>
    </section>

    <div class="outcome-section">
      <div v-if="roundOutcome.mastered.length" class="outcome-line mastered">
        <span class="outcome-tag">Mastered</span>
        <span class="kana" lang="ja">{{ roundOutcome.mastered.join(' ') }}</span>
      </div>
      <div v-if="roundOutcome.up.length" class="outcome-line up">
        <span class="outcome-tag">Moved up</span>
        <span class="kana" lang="ja">{{ roundOutcome.up.join(' ') }}</span>
      </div>
      <div v-if="roundOutcome.down.length" class="outcome-line down">
        <span class="outcome-tag">Back to learning</span>
        <span class="kana" lang="ja">{{ roundOutcome.down.join(' ') }}</span>
      </div>
      <div v-if="!roundOutcome.up.length && !roundOutcome.down.length && !roundOutcome.mastered.length" class="outcome-line quiet">
        Nothing moved: kanji only move up when they are due, extra practice still sharpens them.
      </div>
      <div v-if="outlookText" class="outcome-next">{{ outlookText }}</div>
    </div>

    <div v-if="missed.length" class="missed-section">
      <div class="missed-title">Missed this round</div>
      <div class="missed-grid">
        <div v-for="k in missed" :key="k.id" class="missed-entry">
          <span class="k" lang="ja">{{ k.kanji }}</span>
          <span class="r">{{ k.keyword }}</span>
        </div>
      </div>
    </div>

    <div class="result-btns">
      <button class="btn btn-action btn-lg" @click="again()"><Icon name="replay" :size="20" />Keep going</button>
      <button class="btn btn-lg" @click="goHome()"><Icon name="home" :size="20" />Home</button>
    </div>
  </div>
</template>
