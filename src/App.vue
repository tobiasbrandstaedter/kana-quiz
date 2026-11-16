<script setup lang="ts">
import { provide, onMounted, watch } from 'vue'
import { useQuiz, QUIZ_KEY } from './composables/useQuiz'
import { useAppUpdate } from './composables/useAppUpdate'
import SetupScreen from './components/SetupScreen.vue'
import QuizScreen from './components/QuizScreen.vue'
import ResultsScreen from './components/ResultsScreen.vue'

const quiz = useQuiz()
provide(QUIZ_KEY, quiz)
const { screen } = quiz

const { needRefresh, apply } = useAppUpdate()
// nothing to lose on the setup screen, so switch over right away;
// mid-quiz the banner asks first and the reload happens once the round is over
watch([needRefresh, screen], ([ready, s]) => {
  if (ready && s === 'setup') apply()
})

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
  <div v-if="needRefresh" class="update-banner" role="status">
    <span>New version ready</span>
    <button @click="apply()">UPDATE</button>
  </div>
</template>
