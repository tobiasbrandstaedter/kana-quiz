<script setup lang="ts">
import { inject, ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { QUIZ_KEY } from '../composables/useQuiz'
import { playKana } from '../audio'
import { lookalikesOf, lookalikeHint } from '../data/lookalikes'
import { mnemonicFor } from '../data/mnemonics'
import { kanaStrokes } from '../data/strokeGlyphs'
import StrokeDemo from './StrokeDemo.vue'
import StrokeCanvas from './StrokeCanvas.vue'
import Icon from './Icon.vue'

const {
  screen, isErrorPractice, progress, current, questions, correctCount, wrongCount,
  currentQuestion, answered, gaveUp, feedbackText, feedbackType, explanation,
  typedAnswer, typeFieldEl, selectedOption, timeLimit,
  submitTyped, selectAnswer, submitDrawing, giveUp, nextQuestion, goHome, quizMode,
} = inject(QUIZ_KEY)!

const isIntro = computed(() => currentQuestion.value?.inputType === 'intro')
const isDraw = computed(() => currentQuestion.value?.inputType === 'draw')
const isChoice = computed(() => currentQuestion.value?.inputType === 'choice')
const isType = computed(() => currentQuestion.value?.inputType === 'type')
const hasStrokes = computed(() => !!currentQuestion.value && !!kanaStrokes(currentQuestion.value.kana))

// first contact: watch the strokes, then trace once over the guide. Not scored.
const introStep = ref<'watch' | 'trace' | 'traced'>('watch')

const LABELS = {
  'kana-to-romaji': 'Type the romaji for',
  'romaji-to-kana': 'Which kana is',
  draw: 'Write the kana for',
}

const isListen = computed(() => !!currentQuestion.value?.listen)
const label = computed(() => {
  const q = currentQuestion.value
  if (!q) return ''
  if (isIntro.value) return introStep.value === 'watch' ? 'New kana' : 'Now trace it'
  return isListen.value ? 'Write what you hear' : LABELS[q.direction]
})

// warn about lookalikes on first contact, before the mix-up gets learned
const introWarning = computed(() => {
  const q = currentQuestion.value
  if (!q || !isIntro.value) return null
  const others = lookalikesOf(q.kana)
  if (others.length === 0) return null
  return { others: others.join('・'), hint: lookalikeHint(q.kana, others[0]) }
})

// memory hook on first contact and after a miss
const mnemonic = computed(() => {
  const q = currentQuestion.value
  if (!q) return null
  return isIntro.value || (answered.value && feedbackType.value === 'wrong') ? mnemonicFor(q.kana) : null
})

const audioActive = ref(false)
// iOS can refuse to play until the next tap, listen mode then shows a tap target
const audioBlocked = ref(false)
function onAudioClick(kana: string) {
  playKana(kana).then(ok => { audioBlocked.value = !ok })
  audioActive.value = true
  setTimeout(() => { audioActive.value = false }, 250)
}

watch(currentQuestion, q => {
  introStep.value = 'watch'
  audioBlocked.value = false
  // in listen mode the sound is the question, so it plays by itself, intro cards included
  if (q && (q.listen || (q.inputType === 'intro' && quizMode.value === 'listen'))) onAudioClick(q.kana)
}, { immediate: true })

const isLast = computed(() => current.value >= questions.value.length - 1)

interface Action { label: string; run: () => void; enabled?: boolean }

// one place for the main button, so it never ends up below the fold
const primary = computed((): Action | null => {
  const q = currentQuestion.value
  if (!q) return null
  if (isIntro.value) {
    if (introStep.value === 'watch' && hasStrokes.value) return { label: 'Trace it', run: () => { introStep.value = 'trace' } }
    if (introStep.value === 'trace') return { label: 'Got it', run: nextQuestion, enabled: false }
    return { label: 'Got it', run: nextQuestion }
  }
  if (answered.value) return { label: isLast.value ? 'Results' : 'Next', run: nextQuestion }
  if (isType.value) return { label: 'Check', run: submitTyped, enabled: typedAnswer.value.trim() !== '' }
  return null
})

const secondary = computed((): Action | null => {
  if (!currentQuestion.value || answered.value) return null
  if (isIntro.value) return introStep.value === 'traced' ? null : { label: 'Skip', run: nextQuestion }
  return { label: "Don't know", run: giveUp }
})

function onTypedEnter(e: KeyboardEvent): void {
  if (e.isComposing) return
  if (answered.value) nextQuestion()
  else submitTyped()
}

// Enter continues, 1 to 4 pick a choice. Handy with an iPad keyboard.
function onKey(e: KeyboardEvent): void {
  if (screen.value !== 'quiz' || e.isComposing || e.target === typeFieldEl.value) return
  const q = currentQuestion.value
  if (!q) return
  if (e.key === 'Enter') {
    const p = primary.value
    if (p && p.enabled !== false) { e.preventDefault(); p.run() }
    return
  }
  const n = Number(e.key)
  if (isChoice.value && !answered.value && n >= 1 && n <= q.options.length) selectAnswer(q.options[n - 1])
}

// with the iOS keyboard up only the visual viewport shrinks, css can't see that
const compact = ref(false)
function onViewport(): void {
  compact.value = (window.visualViewport?.height ?? window.innerHeight) < 560
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.visualViewport?.addEventListener('resize', onViewport)
  onViewport()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.visualViewport?.removeEventListener('resize', onViewport)
})
</script>

<template>
  <div class="quiz" :class="{ compact }">
    <div class="quiz-top">
      <div class="quiz-topbar">
        <button class="icon-btn boxed" aria-label="End session" @click="goHome()"><Icon name="x" :size="20" /></button>
        <div
          class="progress-track"
          role="progressbar"
          :aria-valuenow="Math.round(progress)"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Session progress"
        >
          <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
        </div>
        <span class="quiz-count">{{ current + 1 }}/{{ questions.length }}</span>
        <span class="score-pill" :aria-label="`${correctCount} correct, ${wrongCount} wrong`">
          <Icon name="check" :size="14" />{{ correctCount }}
        </span>
      </div>

      <div v-show="isErrorPractice" class="mode-banner">Error practice</div>

      <!-- fluency countdown, restarts per question through :key and freezes once answered -->
      <div v-if="timeLimit" :key="current" class="countdown" aria-hidden="true">
        <div class="countdown-fill" :class="{ stopped: answered }" :style="{ animationDuration: `${timeLimit}ms` }"></div>
      </div>
    </div>

    <div class="quiz-body" :class="{ wide: isDraw || (isIntro && introStep !== 'watch') }">
      <div class="question-card" :class="{ slim: isDraw || (isIntro && introStep !== 'watch') }">
        <div class="q-label">
          <span v-if="currentQuestion?.reask" class="reask-tag">again</span>{{ label }}
        </div>

        <template v-if="isIntro && currentQuestion">
          <StrokeDemo v-if="introStep === 'watch' && hasStrokes" :kana="currentQuestion.kana" class="intro-strokes" />
          <div v-else class="q-main" :class="{ 'intro-small': introStep !== 'watch' }">{{ currentQuestion.kana }}</div>
          <div class="intro-romaji">{{ currentQuestion.romaji }}</div>
        </template>

        <!-- listening: the sound is the question, so the replay button takes the kana's place -->
        <template v-else-if="isListen && !answered && currentQuestion">
          <button class="listen-btn" :class="{ playing: audioActive, blocked: audioBlocked }" @click="onAudioClick(currentQuestion.kana)">
            <Icon name="speaker" :size="48" />
            <span>{{ audioBlocked ? 'Tap to hear' : 'Play again' }}</span>
          </button>
          <div class="listen-note">No sound? Check the silent switch.</div>
        </template>

        <div v-else class="q-main" :class="{ 'romaji-q': currentQuestion?.direction !== 'kana-to-romaji', 'draw-q': isDraw }">
          {{ currentQuestion?.question }}
        </div>

        <button
          v-if="currentQuestion && !(isListen && !answered)"
          class="audio-btn"
          :class="{ playing: audioActive }"
          @click="onAudioClick(currentQuestion.kana)"
          aria-label="Play pronunciation"
        >
          <Icon name="speaker" :size="22" />
        </button>
      </div>

      <div class="answer-area">
        <div class="type-input-wrap" :class="{ visible: isType }">
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
            enterkeyhint="go"
            placeholder="type romaji..."
            :readonly="answered"
            v-model="typedAnswer"
            @keydown.enter="onTypedEnter"
          />
        </div>

        <template v-if="isDraw && currentQuestion">
          <!-- gave up: show how it's written instead of an empty canvas -->
          <StrokeDemo v-if="gaveUp" :key="`demo${current}`" :kana="currentQuestion.kana" class="draw-demo" />
          <StrokeCanvas v-else :key="current" :kana="currentQuestion.kana" mode="recall" @done="submitDrawing" />
        </template>

        <StrokeCanvas
          v-if="isIntro && currentQuestion && introStep !== 'watch'"
          :key="`trace${current}`" :kana="currentQuestion.kana" mode="trace"
          @done="introStep = 'traced'"
        />

        <div v-if="isChoice && currentQuestion" class="options-grid">
          <button
            v-for="(opt, i) in currentQuestion.options" :key="opt"
            class="option-btn"
            :class="{
              correct: answered && opt === currentQuestion.answer,
              wrong:   answered && opt === selectedOption && opt !== currentQuestion.answer,
              dim:     answered && opt !== currentQuestion.answer && opt !== selectedOption,
              'romaji-opt': currentQuestion.direction === 'kana-to-romaji',
            }"
            :disabled="answered"
            :aria-keyshortcuts="String(i + 1)"
            @click="selectAnswer(opt)"
          >
            <span class="opt-n" aria-hidden="true">{{ i + 1 }}</span>{{ opt }}
            <span v-if="answered && opt === currentQuestion.answer" class="opt-mark"><Icon name="check" :size="16" /></span>
            <span v-else-if="answered && opt === selectedOption" class="opt-mark"><Icon name="x" :size="16" /></span>
          </button>
        </div>

        <div
          class="feedback"
          role="status"
          aria-live="polite"
          :class="{ show: !!feedbackText, correct: feedbackType === 'correct', wrong: feedbackType === 'wrong' }"
        >
          <span v-if="feedbackText" class="feedback-icon"><Icon :name="feedbackType === 'correct' ? 'check' : 'x'" :size="18" /></span>
          <span class="feedback-text">
            {{ feedbackText }}
            <!-- choice: both kana are already colored above, so only say what the picked one was -->
            <span v-if="answered && explanation && isChoice" class="feedback-sub">
              <span class="kana">{{ explanation.givenKana }}</span> is {{ explanation.givenLabel }}.
              <template v-if="explanation.hint">{{ explanation.hint }}</template>
            </span>
          </span>
        </div>

        <div v-if="mnemonic" class="mnemonic"><Icon name="bulb" :size="20" /><span>{{ mnemonic }}</span></div>

        <div v-if="introWarning" class="explain intro-warning">
          <div class="explain-hint">Easy to confuse with <span class="kana">{{ introWarning.others }}</span></div>
          <div v-if="introWarning.hint" class="explain-hint">{{ introWarning.hint }}</div>
        </div>

        <div v-if="answered && explanation && currentQuestion && !isChoice" class="explain">
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
      </div>
    </div>

    <div class="quiz-actions">
      <button v-if="secondary" class="action-secondary" @click="secondary.run()">{{ secondary.label }}</button>
      <button
        v-if="primary" class="action-primary" :class="{ intro: isIntro }"
        :disabled="primary.enabled === false"
        @click="primary.run()"
      >{{ primary.label }}<Icon v-if="primary.label !== 'Check'" name="arrow" :size="20" /></button>
    </div>
  </div>
</template>
