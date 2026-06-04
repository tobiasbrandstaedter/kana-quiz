<script setup lang="ts">
import { inject } from 'vue'
import { QUIZ_KEY } from '../composables/useQuiz'

const {
  resultScore, resultLabel, uniqueMissedPairs, errorPairs,
  restartQuiz, startQuiz, goHome,
} = inject(QUIZ_KEY)!
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
          <span class="k">{{ p.kana }}</span>
          <span class="r">{{ p.romaji }}</span>
        </div>
      </div>
    </div>

    <div class="result-btns">
      <button class="restart-btn" @click="restartQuiz()">TRY AGAIN</button>
      <button class="practice-errors-btn" :disabled="errorPairs.length === 0" @click="startQuiz(true)">PRACTICE ERRORS</button>
      <button class="back-btn" @click="goHome()">SETTINGS</button>
    </div>
  </div>
</template>
