<script setup lang="ts">
import { provide, onMounted } from 'vue'
import { useQuiz, QUIZ_KEY } from './composables/useQuiz'
import SetupScreen from './components/SetupScreen.vue'
import QuizScreen from './components/QuizScreen.vue'
import ResultsScreen from './components/ResultsScreen.vue'

const quiz = useQuiz()
provide(QUIZ_KEY, quiz)
const { screen } = quiz

onMounted(quiz.init)
</script>

<template>
  <div class="container">
    <SetupScreen v-show="screen === 'setup'" />
    <QuizScreen  v-show="screen === 'quiz'" />
    <ResultsScreen v-show="screen === 'results'" />
  </div>
</template>
