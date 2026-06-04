<script setup lang="ts">
import { inject } from 'vue'
import { QUIZ_KEY } from '../composables/useQuiz'

const {
  isErrorPractice, progress, current, questions, correctCount, wrongCount,
  currentQuestion, answered, feedbackText, feedbackType,
  typedAnswer, typeFieldEl, selectedOption,
  submitTyped, selectAnswer, nextQuestion,
} = inject(QUIZ_KEY)!
</script>

<template>
  <div>
    <div v-show="isErrorPractice" class="error-mode-banner">✦ Error Practice Mode</div>

    <div class="progress-bar-wrap">
      <div class="progress-bar-fill" :style="{ width: `${progress}%` }"></div>
    </div>

    <div class="stats-row-top">
      <span>{{ current + 1 }} / {{ questions.length }}</span>
      <span>
        <span class="stat-correct">{{ correctCount }}</span> correct &nbsp;
        <span class="stat-wrong">{{ wrongCount }}</span> wrong
      </span>
    </div>

    <div class="question-card">
      <div class="q-label">{{ currentQuestion?.direction === 'kana-to-romaji' ? 'Type the romaji for' : 'Which kana is' }}</div>
      <div class="q-main" :class="{ 'romaji-q': currentQuestion?.direction === 'romaji-to-kana' }">
        {{ currentQuestion?.question }}
      </div>
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
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        placeholder="type romaji..."
        :disabled="answered"
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
      :class="{ show: !!feedbackText, correct: feedbackType === 'correct', wrong: feedbackType === 'wrong' }"
    >{{ feedbackText }}</div>

    <button class="next-btn" :disabled="!answered" @click="nextQuestion()">NEXT →</button>
  </div>
</template>
