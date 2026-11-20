<script setup lang="ts">
import { computed } from 'vue'
import { useKanji } from '../composables/useKanji'
import { fromNow } from '../format'
import { openKanji } from '../kanjiShell'
import Icon from './Icon.vue'

const { resultScore, resultLabel, missed, roundOutcome, restart, restartLabel, goHome } = useKanji()

const outlookText = computed(() => {
  const o = roundOutcome.value.outlook
  if (o.now) return `${o.now} kanji and words due now.`
  if (o.soon) return `${o.soon} kanji and words come back within a day.`
  if (o.nextAt) return `Next review ${fromNow(o.nextAt)}.`
  return ''
})

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
        Nothing moved: kanji and words only move up when they are due, extra practice still sharpens them.
      </div>
      <div v-if="outlookText" class="outcome-next">{{ outlookText }}</div>
    </div>

    <div v-if="missed.length" class="missed-section">
      <div class="missed-title">Missed this round <span>tap for details</span></div>
      <div class="missed-grid">
        <!-- a word opens the sheet of its home kanji, which lists it -->
        <button
          v-for="item in missed" :key="item.id" class="missed-item" :class="{ word: item.kind === 'word' }"
          @click="openKanji(item.home)"
        >
          <span class="k" lang="ja">{{ item.text }}</span>
          <span class="r">
            <span v-if="item.reading" class="missed-reading" lang="ja">{{ item.reading }}</span>
            {{ item.meaning }}
          </span>
        </button>
      </div>
    </div>

    <div class="result-btns">
      <button class="btn btn-action btn-lg" @click="restart()"><Icon name="replay" :size="20" />{{ restartLabel }}</button>
      <button class="btn btn-lg" @click="goHome()"><Icon name="home" :size="20" />Home</button>
    </div>
  </div>
</template>
