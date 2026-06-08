<script setup lang="ts">
import { provide, onMounted } from 'vue'
import { useQuiz, QUIZ_KEY } from './composables/useQuiz'
import { precacheKanaAudio } from './audio'
import SetupScreen from './components/SetupScreen.vue'
import QuizScreen from './components/QuizScreen.vue'
import ResultsScreen from './components/ResultsScreen.vue'

const quiz = useQuiz()
provide(QUIZ_KEY, quiz)
const { screen } = quiz

onMounted(() => {
  quiz.init()
  // wait for SW to be active so the CacheFirst rule intercepts the fetches
  navigator.serviceWorker?.ready.then(precacheKanaAudio)
})
</script>

<template>
  <div class="container">
    <SetupScreen v-show="screen === 'setup'" />
    <QuizScreen  v-show="screen === 'quiz'" />
    <ResultsScreen v-show="screen === 'results'" />
  </div>
</template>
