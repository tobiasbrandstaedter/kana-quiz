<script setup lang="ts">
import { provide, onMounted, watch } from 'vue'
import { useQuiz, QUIZ_KEY } from './composables/useQuiz'
import { useAppUpdate } from './composables/useAppUpdate'
import SetupScreen from './components/SetupScreen.vue'
import QuizScreen from './components/QuizScreen.vue'
import ResultsScreen from './components/ResultsScreen.vue'
import KanaSheet from './components/KanaSheet.vue'

const quiz = useQuiz()
provide(QUIZ_KEY, quiz)
const { screen, notice } = quiz

const { needRefresh, apply } = useAppUpdate()
// nothing to lose on the setup screen, so switch over right away;
// mid-quiz the banner asks first and the reload happens once the round is over
watch([needRefresh, screen], ([ready, s]) => {
  if (ready && s === 'setup') apply()
})

// a fresh screen starts at the top, not where the last one was scrolled to
watch(screen, () => window.scrollTo(0, 0))

onMounted(() => {
  quiz.init()
  caches.delete('kana-audio').catch(() => {})
})
</script>

<template>
  <div class="container">
    <SetupScreen v-show="screen === 'setup'" />
    <QuizScreen  v-show="screen === 'quiz'" />
    <ResultsScreen v-show="screen === 'results'" />
  </div>
  <KanaSheet />
  <div v-if="notice" class="notice" role="status">{{ notice }}</div>
  <div v-if="needRefresh" class="update-banner" role="status">
    <span>New version ready</span>
    <button @click="apply()">Update</button>
  </div>
</template>
