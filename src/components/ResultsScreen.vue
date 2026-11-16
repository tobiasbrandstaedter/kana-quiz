<script setup lang="ts">
import { inject } from 'vue'
import type { Point } from '../types'
import { QUIZ_KEY } from '../composables/useQuiz'
import { kanaStrokes } from '../data/strokeGlyphs'
import PatternCards from './PatternCards.vue'

const {
  resultScore, resultLabel, uniqueMissedPairs, errorPairs, roundPatterns, drawings,
  restartQuiz, startQuiz, startPatternPractice, goHome,
} = inject(QUIZ_KEY)!

function at(dx: number): string {
  return `translate(${dx} 0)`
}

function polyline(points: Point[]): string {
  return points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}
</script>

<template>
  <div style="text-align:center">
    <div class="section-label">Quiz Complete</div>
    <div class="result-score">{{ resultScore }}</div>
    <div class="result-label">{{ resultLabel }}</div>

    <div v-if="uniqueMissedPairs.length > 0" class="missed-section">
      <div class="missed-title">Missed This Round</div>
      <div class="missed-grid">
        <div v-for="p in uniqueMissedPairs" :key="p.kana" class="missed-item">
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
        </div>
      </div>
    </div>

    <PatternCards
      v-if="roundPatterns.length > 0"
      :patterns="roundPatterns"
      title="Patterns this round"
      @practice="startPatternPractice"
    />

    <div class="result-btns">
      <button class="restart-btn" @click="restartQuiz()">TRY AGAIN</button>
      <button class="practice-errors-btn" :disabled="errorPairs.length === 0" @click="startQuiz(true)">PRACTICE ERRORS</button>
      <button class="back-btn" @click="goHome()">HOME</button>
    </div>
  </div>
</template>
