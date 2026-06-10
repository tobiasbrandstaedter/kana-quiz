<script setup lang="ts">
import { inject, ref } from 'vue'
import { QUIZ_KEY } from '../composables/useQuiz'
import { playKana } from '../audio'

const {
  isErrorPractice, progress, current, questions, correctCount, wrongCount,
  currentQuestion, answered, feedbackText, feedbackType,
  typedAnswer, typeFieldEl, selectedOption,
  submitTyped, selectAnswer, nextQuestion, goHome,
} = inject(QUIZ_KEY)!

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
      <div class="q-label">{{ currentQuestion?.direction === 'kana-to-romaji' ? 'Type the romaji for' : 'Which kana is' }}</div>
      <div class="q-main" :class="{ 'romaji-q': currentQuestion?.direction === 'romaji-to-kana' }">
        {{ currentQuestion?.question }}
      </div>
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

    <button class="next-btn" :disabled="!answered" @click="nextQuestion()">NEXT →</button>
  </div>
</template>
