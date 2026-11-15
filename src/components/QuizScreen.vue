<script setup lang="ts">
import { inject, ref, computed } from 'vue'
import { QUIZ_KEY } from '../composables/useQuiz'
import { playKana } from '../audio'
import { lookalikesOf, lookalikeHint } from '../data/lookalikes'
import { STROKES } from '../data/strokes'
import StrokeDemo from './StrokeDemo.vue'
import StrokeCanvas from './StrokeCanvas.vue'

const {
  isErrorPractice, progress, current, questions, correctCount, wrongCount,
  currentQuestion, answered, feedbackText, feedbackType, explanation,
  typedAnswer, typeFieldEl, selectedOption,
  submitTyped, selectAnswer, submitDrawing, nextQuestion, goHome,
} = inject(QUIZ_KEY)!

const isIntro = computed(() => currentQuestion.value?.inputType === 'intro')
const isDraw = computed(() => currentQuestion.value?.inputType === 'draw')

const LABELS = {
  'kana-to-romaji': 'Type the romaji for',
  'romaji-to-kana': 'Which kana is',
  draw: 'Write the kana for',
}
// first contact shows how the kana is written, combos have no stroke data and stay plain text
const introStrokes = computed(() => isIntro.value && !!currentQuestion.value && !!STROKES[currentQuestion.value.kana])

// warn about lookalikes on first contact, before the mix-up gets learned
const introWarning = computed(() => {
  const q = currentQuestion.value
  if (!q || !isIntro.value) return null
  const others = lookalikesOf(q.kana)
  if (others.length === 0) return null
  return { others: others.join('・'), hint: lookalikeHint(q.kana, others[0]) }
})

const audioActive = ref(false)
function onAudioClick(kana: string) {
  playKana(kana)
  audioActive.value = true
  setTimeout(() => { audioActive.value = false }, 250)
}
</script>

<template>
  <div>
    <div v-show="isErrorPractice" class="error-mode-banner">✦ Error Practice Mode</div>

    <div
      class="progress-bar-wrap"
      role="progressbar"
      :aria-valuenow="Math.round(progress)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="progress-bar-fill" :style="{ width: `${progress}%` }"></div>
    </div>

    <div class="stats-row-top">
      <span>{{ current + 1 }} / {{ questions.length }}</span>
      <span>
        <span class="stat-correct">{{ correctCount }}</span> correct &nbsp;
        <span class="stat-wrong">{{ wrongCount }}</span> wrong
      </span>
      <button class="home-btn" @click="goHome()">HOME</button>
    </div>

    <div class="question-card">
      <div class="q-label">{{ isIntro ? 'New kana' : currentQuestion ? LABELS[currentQuestion.direction] : '' }}</div>
      <StrokeDemo v-if="introStrokes && currentQuestion" :kana="currentQuestion.kana" class="intro-strokes" />
      <div v-else class="q-main" :class="{ 'romaji-q': currentQuestion?.direction !== 'kana-to-romaji', 'draw-q': isDraw }">
        {{ currentQuestion?.question }}
      </div>
      <div v-if="isIntro" class="intro-romaji">{{ currentQuestion?.romaji }}</div>
      <button
        v-if="currentQuestion"
        class="audio-btn"
        :class="{ playing: audioActive }"
        @click="onAudioClick(currentQuestion.kana)"
        aria-label="Play pronunciation"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      </button>
    </div>

    <div class="type-input-wrap" :class="{ visible: currentQuestion?.inputType === 'type' }">
      <input
        ref="typeFieldEl"
        class="type-field"
        :class="{
          'input-correct': answered && feedbackType === 'correct',
          'input-wrong':   answered && feedbackType === 'wrong',
        }"
        type="text"
        aria-label="Type the romaji answer"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        placeholder="type romaji..."
        :readonly="answered"
        v-model="typedAnswer"
        @keydown.enter="submitTyped()"
      />
      <button class="submit-btn" :disabled="answered" @click="submitTyped()">CHECK →</button>
    </div>

    <StrokeCanvas
      v-if="isDraw && currentQuestion"
      :key="current" :kana="currentQuestion.kana" mode="recall"
      @done="submitDrawing"
    />

    <div v-if="currentQuestion?.inputType === 'choice'" class="options-grid">
      <button
        v-for="opt in currentQuestion.options" :key="opt"
        class="option-btn"
        :class="{
          correct: answered && opt === currentQuestion.answer,
          wrong:   answered && opt === selectedOption && opt !== currentQuestion.answer,
        }"
        :disabled="answered"
        @click="selectAnswer(opt)"
      >{{ opt }}</button>
    </div>

    <div
      class="feedback"
      role="status"
      aria-live="polite"
      :class="{ show: !!feedbackText, correct: feedbackType === 'correct', wrong: feedbackType === 'wrong' }"
    >{{ feedbackText }}</div>

    <div v-if="introWarning" class="explain intro-warning">
      <div class="explain-hint">Easy to confuse with <span class="kana">{{ introWarning.others }}</span></div>
      <div v-if="introWarning.hint" class="explain-hint">{{ introWarning.hint }}</div>
    </div>

    <div v-if="answered && explanation && currentQuestion" class="explain">
      <div class="explain-pair">
        <div class="explain-item yours">
          <span class="tag">yours</span>
          <span class="k">{{ explanation.givenKana ?? '?' }}</span>
          <span class="r">{{ explanation.givenLabel }}</span>
        </div>
        <div class="explain-item right">
          <span class="tag">correct</span>
          <span class="k">{{ currentQuestion.kana }}</span>
          <span class="r">{{ currentQuestion.romaji }}</span>
        </div>
      </div>
      <div v-if="explanation.hint" class="explain-hint">{{ explanation.hint }}</div>
    </div>

    <button
      class="next-btn" :class="{ intro: isIntro }"
      :disabled="!answered && !isIntro"
      @click="nextQuestion()"
    >{{ isIntro ? 'GOT IT →' : 'NEXT →' }}</button>
  </div>
</template>
