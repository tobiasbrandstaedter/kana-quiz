<script setup lang="ts">
import { inject } from 'vue'
import { QUIZ_KEY } from '../composables/useQuiz'

const {
  errorPairs, maxErrorCount,
  removeErrorEntry, confirmClearErrors, startQuiz,
} = inject(QUIZ_KEY)!

function accuracy(e: { correct: number; incorrect: number }): number {
  const seen = e.correct + e.incorrect
  return seen > 0 ? Math.round((e.correct / seen) * 100) : 0
}
</script>

<template>
  <div>
    <div class="errors-header">
      <div class="section-label" style="margin-bottom:0">Error Tracker</div>
      <button class="clear-errors-btn" @click="confirmClearErrors()">CLEAR ALL</button>
    </div>

    <div v-if="errorPairs.length === 0" class="no-errors-state">
      <div class="big">✓</div>
      <div class="msg">No errors tracked yet</div>
    </div>
    <div v-else class="error-table">
      <div class="error-table-header">
        <span>Kana</span><span>Romaji</span><span>Errors</span><span style="text-align:right">Accuracy</span><span></span>
      </div>
      <div v-for="e in errorPairs" :key="e.kana" class="error-row">
        <span class="error-kana">{{ e.kana }}</span>
        <span class="error-romaji">{{ e.romaji }}</span>
        <div class="error-bar-wrap">
          <div class="error-bar-bg">
            <div class="error-bar-fill" :style="{ width: maxErrorCount > 0 ? `${Math.round((e.incorrect / maxErrorCount) * 100)}%` : '0%' }"></div>
          </div>
          <span class="error-count-label">{{ e.incorrect }}</span>
        </div>
        <span class="error-accuracy" :class="{ good: accuracy(e) >= 80, ok: accuracy(e) >= 50 && accuracy(e) < 80 }">
          {{ accuracy(e) }}% acc
        </span>
        <button class="error-remove-btn" title="Remove" @click="removeErrorEntry(e.kana)">✕</button>
      </div>
    </div>

    <button class="practice-all-btn" :disabled="errorPairs.length === 0" @click="startQuiz(true)">PRACTICE ERRORS</button>
  </div>
</template>
