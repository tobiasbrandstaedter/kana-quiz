<script setup lang="ts">
import { provide, onMounted } from 'vue'
import { useQuiz, QUIZ_KEY } from './composables/useQuiz'
import SetupScreen from './components/SetupScreen.vue'
import QuizScreen from './components/QuizScreen.vue'
import ResultsScreen from './components/ResultsScreen.vue'

const quiz = useQuiz()
provide(QUIZ_KEY, quiz)

onMounted(quiz.init)
</script>

<template>
  <div class="container">
    <SetupScreen v-show="quiz.screen === 'setup'" />
    <QuizScreen  v-show="quiz.screen === 'quiz'" />
    <ResultsScreen v-show="quiz.screen === 'results'" />
  </div>
</template>
