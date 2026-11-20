<script setup lang="ts">
import { provide, onMounted, watch, computed } from 'vue'
import { useQuiz, QUIZ_KEY } from './composables/useQuiz'
import { useAppUpdate } from './composables/useAppUpdate'
import { course, kanjiScreen } from './kanjiShell'
import SetupScreen from './components/SetupScreen.vue'
import QuizScreen from './components/QuizScreen.vue'
import ResultsScreen from './components/ResultsScreen.vue'
import KanaSheet from './components/KanaSheet.vue'
import KanjiPart from './components/KanjiPart.vue'

const quiz = useQuiz()
provide(QUIZ_KEY, quiz)
const { screen, activeTab, notice, noticeAction, runNoticeAction } = quiz

// what is on screen: the shared setup screen, or a quiz or results screen of the course
const view = computed(() => {
  if (course.value === 'kana') return screen.value
  return kanjiScreen.value === 'setup' ? 'setup' : `kanji-${kanjiScreen.value}`
})

const { needRefresh, apply } = useAppUpdate()
// Nothing to lose on the Practice tab, so switch over right away. Anywhere else a reload
// would wipe something: a quiz, a drawing on the Writing tab, an open sheet. There the
// banner asks, and the reload happens by itself once the learner is back on the Practice tab.
watch([needRefresh, view, activeTab], ([ready, v, tab]) => {
  if (ready && v === 'setup' && tab === 'practice' && !document.body.classList.contains('sheet-open')) apply()
})

// a fresh screen starts at the top, not where the last one was scrolled to
watch(view, () => window.scrollTo(0, 0))

onMounted(() => quiz.init())
</script>

<template>
  <div class="container">
    <SetupScreen v-show="view === 'setup'" />
    <QuizScreen  v-show="view === 'quiz'" />
    <ResultsScreen v-show="view === 'results'" />
    <KanjiPart v-if="view === 'kanji-quiz'" part="KanjiQuiz" />
    <KanjiPart v-else-if="view === 'kanji-results'" part="KanjiResults" />
  </div>
  <KanaSheet />
  <div v-if="notice" class="notice" role="status">
    <span>{{ notice }}</span>
    <button v-if="noticeAction" @click="runNoticeAction()">{{ noticeAction.label }}</button>
  </div>
  <div v-if="needRefresh" class="update-banner" role="status">
    <span>New version ready</span>
    <button @click="apply()">Update</button>
  </div>
</template>
