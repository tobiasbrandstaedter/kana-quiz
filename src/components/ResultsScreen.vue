<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Point } from '../types'
import { QUIZ_KEY } from '../composables/useQuiz'
import { kanaStrokes } from '../data/strokeGlyphs'
import { fromNow } from '../format'
import PatternCards from './PatternCards.vue'
import Icon from './Icon.vue'

const {
  resultScore, resultLabel, uniqueMissedPairs, errorPairs, roundPatterns, drawings, roundOutcome,
  restartQuiz, startQuiz, startPatternPractice, goHome, openKana,
} = inject(QUIZ_KEY)!

function at(dx: number): string {
  return `translate(${dx} 0)`
}

function polyline(points: Point[]): string {
  return points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

// what comes next, so the session ends with a reason to come back
const outlookText = computed(() => {
  const o = roundOutcome.value.outlook
  if (o.now) return `${o.now} kana are due now.`
  if (o.soon) return `${o.soon} kana come back within a day.`
  if (o.nextAt) return `Next review ${fromNow(o.nextAt)}.`
  return ''
})

// moving up only counts when it isn't also listed as mastered
const movedUp = computed(() => roundOutcome.value.up.filter(u => !roundOutcome.value.mastered.includes(u.kana)))
</script>

<template>
  <div class="results">
    <section class="result-card">
      <span class="eyebrow">Session complete</span>
      <div class="result-score">{{ resultScore }}</div>
      <div class="result-title">{{ resultLabel.title }} <span class="kana">{{ resultLabel.jp }}</span></div>
      <div class="result-detail">{{ resultLabel.detail }}</div>
    </section>

    <div class="outcome-section">
      <div v-if="roundOutcome.mastered.length" class="outcome-line mastered">
        <span class="outcome-tag">Mastered</span>
        <span class="kana">{{ roundOutcome.mastered.join(' ') }}</span>
      </div>
      <div v-if="movedUp.length" class="outcome-line up">
        <span class="outcome-tag">Moved up</span>
        <span class="kana">{{ movedUp.map(u => u.kana).join(' ') }}</span>
      </div>
      <div v-if="roundOutcome.down.length" class="outcome-line down">
        <span class="outcome-tag">Back to learning</span>
        <span class="kana">{{ roundOutcome.down.join(' ') }}</span>
      </div>
      <div v-if="!roundOutcome.up.length && !roundOutcome.down.length" class="outcome-line quiet">
        Nothing moved: kana only move up when they are due, extra practice still sharpens them.
      </div>
      <div v-if="outlookText" class="outcome-next">{{ outlookText }}</div>
    </div>

    <div v-if="uniqueMissedPairs.length > 0" class="missed-section">
      <div class="missed-title">Missed this round <span>tap for details</span></div>
      <div class="missed-grid">
        <button v-for="p in uniqueMissedPairs" :key="p.kana" class="missed-item" @click="openKana(p.kana)">
          <!-- your drawing over the reference, strokes the app had to draw in red -->
          <svg
            v-if="drawings[p.kana] && kanaStrokes(p.kana)" class="missed-drawing"
            :viewBox="`0 0 ${kanaStrokes(p.kana)!.width} 109`" :style="{ '--w': kanaStrokes(p.kana)!.width / 109 }" :aria-label="`Your drawing of ${p.kana}`"
          >
            <path v-for="(s, i) in kanaStrokes(p.kana)!.strokes" :key="`r${i}`" class="ref" :d="s.d" :transform="at(s.dx)" />
            <template v-for="(stroke, i) in drawings[p.kana]" :key="i">
              <polyline v-if="stroke" class="ink" :points="polyline(stroke)" />
              <path v-else class="given" :d="kanaStrokes(p.kana)!.strokes[i].d" :transform="at(kanaStrokes(p.kana)!.strokes[i].dx)" />
            </template>
          </svg>
          <span class="k">{{ p.kana }}</span>
          <span class="r">{{ p.romaji }}</span>
        </button>
      </div>
    </div>

    <PatternCards
      v-if="roundPatterns.length > 0"
      :patterns="roundPatterns"
      title="Patterns this round"
      @practice="startPatternPractice"
    />

    <div class="result-btns">
      <button class="btn btn-action btn-lg" @click="restartQuiz()"><Icon name="replay" :size="20" />Again</button>
      <button v-if="errorPairs.length" class="btn btn-bad btn-lg" @click="startQuiz(true)">Practice errors <span class="btn-badge">{{ errorPairs.length }}</span></button>
      <button class="btn btn-lg" @click="goHome()"><Icon name="home" :size="20" />Home</button>
    </div>
  </div>
</template>
