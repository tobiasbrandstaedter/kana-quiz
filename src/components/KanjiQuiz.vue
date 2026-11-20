<script setup lang="ts">
import { inject, ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { QUIZ_KEY } from '../composables/useQuiz'
import { useKanji } from '../composables/useKanji'
import { kanjiEntry, kanjiLookalikeHint, kanjiLookalikes, kanjiStrokes } from '../data/kanjiData'
import { isSeen } from '../learning/scheduler'
import type { KanjiEntry } from '../types'
import { setCourse } from '../kanjiShell'
import StrokeDemo from './StrokeDemo.vue'
import StrokeCanvas from './StrokeCanvas.vue'
import Icon from './Icon.vue'

const { notify, screen } = inject(QUIZ_KEY)!
const {
  statOf, cards, current, card, answered, pickedOption, gaveUp, correctCount, wrongCount, startedAt, progress,
  choose, giveUp, next, goHome, resume,
} = useKanji()

const entry = computed(() => card.value ? kanjiEntry(card.value.kanji) : null)
const strokes = computed(() => card.value ? kanjiStrokes(card.value.kanji) ?? undefined : undefined)
const isIntro = computed(() => card.value?.type === 'intro')
const correct = computed(() => answered.value && pickedOption.value === card.value?.kanji)

// first contact: watch the strokes, then trace once over the guide. Not scored.
const introStep = ref<'watch' | 'trace' | 'traced'>('watch')
watch(card, () => { introStep.value = 'watch' })

// the index starts over with every session, so it alone would hand a new card an old canvas
const cardKey = computed(() => `${startedAt.value}-${current.value}`)

// every card says in words what it asks (KR71)
const label = computed(() => {
  const c = card.value
  if (!c) return ''
  if (c.type === 'intro') return introStep.value === 'watch' ? 'New kanji' : 'Now trace it'
  return c.type === 'meaning' ? 'What does it mean?' : 'Which kanji means'
})

const parts = computed(() => entry.value?.parts.map(kanjiEntry).filter((p): p is KanjiEntry => !!p) ?? [])

// lookalikes the learner knows or meets in this session, the rest would be noise
const introWarning = computed(() => {
  const c = card.value
  if (!c || !isIntro.value) return null
  const met = (k: string) => isSeen(statOf(k)) || cards.value.some(x => x.kanji === k)
  const others = kanjiLookalikes(c.kanji).filter(met)
  if (others.length === 0) return null
  return { others, hint: kanjiLookalikeHint(c.kanji, others[0]) }
})

// picked against right after a miss (KR35), only the right one after "Don't know"
const explanation = computed(() => {
  const c = card.value
  if (!c || !answered.value || correct.value) return null
  const yours = pickedOption.value ? kanjiEntry(pickedOption.value) : null
  return { yours, right: entry.value, hint: yours ? kanjiLookalikeHint(c.kanji, yours.kanji) : null }
})

const feedbackText = computed(() => {
  if (!answered.value) return ''
  if (correct.value) return 'Correct'
  return gaveUp.value ? 'Here it is' : 'Not quite'
})

// the hook on first contact and after a miss
const hook = computed(() => {
  if (!entry.value) return null
  return (isIntro.value && introStep.value === 'watch') || (answered.value && !correct.value) ? entry.value.hook : null
})

const isLast = computed(() => current.value >= cards.value.length - 1)

// a missed kanji is queued again and the counter grows: say so, or it looks like a glitch
const added = ref(0)
let addedTimer: ReturnType<typeof setTimeout> | undefined
watch(() => [startedAt.value, cards.value.length] as const, ([id, n], [oldId, old]) => {
  if (id !== oldId || n <= old) return
  added.value = n - old
  clearTimeout(addedTimer)
  addedTimer = setTimeout(() => { added.value = 0 }, 2500)
})

interface Action { label: string; run: () => void; enabled?: boolean }

const primary = computed((): Action | null => {
  if (!card.value) return null
  if (isIntro.value) {
    // nothing to trace without stroke data, the card is done once it is seen
    if (introStep.value === 'watch' && strokes.value) return { label: 'Trace it', run: () => { introStep.value = 'trace' } }
    if (introStep.value === 'trace') return { label: 'Got it', run: next, enabled: false }
    return { label: 'Got it', run: next }
  }
  if (answered.value) return { label: isLast.value ? 'Results' : 'Next', run: next }
  return null
})

const secondary = computed((): Action | null => {
  if (!card.value || answered.value) return null
  if (isIntro.value) {
    if (introStep.value === 'traced' || !strokes.value) return null
    return { label: introStep.value === 'watch' ? 'Skip intro' : 'Skip tracing', run: next }
  }
  return { label: "Don't know", run: giveUp }
})

// the x is one tap in a corner, so leaving can be taken back for a moment
function endSession(): void {
  const n = correctCount.value + wrongCount.value
  const session = startedAt.value
  goHome()
  notify(n ? `Session ended, ${n} answer${n === 1 ? '' : 's'} saved` : 'Session ended', {
    label: 'Resume',
    run: () => {
      // a later kanji session or a reset replaced this one
      if (startedAt.value !== session) return
      // a kana quiz started in the meantime is closed here, else its key handler would answer along
      screen.value = 'setup'
      setCourse('kanji')
      resume()
    },
  })
}

// Enter runs the main button, 1 to 4 pick an option
function onKey(e: KeyboardEvent): void {
  if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
  const c = card.value
  if (!c) return
  if (e.key === 'Enter') {
    const p = primary.value
    if (p && p.enabled !== false) { e.preventDefault(); p.run() }
    return
  }
  const n = Number(e.key)
  if (c.type !== 'intro' && !answered.value && n >= 1 && n <= c.options.length) choose(c.options[n - 1])
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const optionClass = (opt: string) => ({
  correct: answered.value && opt === card.value?.kanji,
  wrong: answered.value && opt === pickedOption.value && opt !== card.value?.kanji,
  dim: answered.value && opt !== card.value?.kanji && opt !== pickedOption.value,
})
</script>

<template>
  <div class="quiz" :class="{ 'q-trace': isIntro }">
    <div class="quiz-top">
      <div class="quiz-topbar">
        <button class="icon-btn boxed" aria-label="End session" @click="endSession()"><Icon name="x" :size="20" /></button>
        <div
          class="progress-track" role="progressbar" :aria-valuenow="Math.round(progress)"
          aria-valuemin="0" aria-valuemax="100" aria-label="Session progress"
        >
          <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
        </div>
        <span class="quiz-count">
          {{ current + 1 }}/{{ cards.length }}
          <span v-if="added" class="count-added" role="status">+{{ added }}<span class="sr-only"> card{{ added === 1 ? '' : 's' }} for the missed kanji</span></span>
        </span>
        <span class="score-pill" :aria-label="`${correctCount} correct, ${wrongCount} wrong`">
          <Icon name="check" :size="14" />{{ correctCount }}
        </span>
      </div>
    </div>

    <div v-if="card && entry" class="quiz-body" :class="{ wide: isIntro && introStep !== 'watch' }">
      <div class="question-card" :class="{ slim: isIntro && introStep !== 'watch' }">
        <div class="q-label">
          <span v-if="card.reask" class="reask-tag">again</span>{{ label }}
        </div>

        <template v-if="isIntro">
          <StrokeDemo v-if="introStep === 'watch' && strokes" :kana="card.kanji" :glyph="strokes" class="intro-strokes" />
          <div v-else class="q-main" :class="{ 'intro-small': introStep !== 'watch' }" lang="ja">{{ card.kanji }}</div>
          <div class="intro-keyword">{{ entry.keyword }}</div>
        </template>

        <div v-else-if="card.type === 'meaning'" class="q-main" lang="ja">{{ card.kanji }}</div>
        <div v-else class="kanji-keyword">{{ entry.keyword }}</div>
      </div>

      <div class="answer-area">
        <StrokeCanvas
          v-if="isIntro && introStep !== 'watch' && strokes"
          :key="`trace${cardKey}`" :kana="card.kanji" :glyph="strokes" mode="trace"
          @done="introStep = 'traced'"
        />

        <!-- meaning: the keywords as full width buttons, recognize: the kanji in a grid -->
        <div
          v-if="card.type !== 'intro'"
          :class="card.type === 'meaning' ? 'options-list' : 'options-grid kanji-grid'"
          :lang="card.type === 'recognize' ? 'ja' : undefined"
        >
          <button
            v-for="(opt, i) in card.options" :key="opt"
            class="option-btn" :class="[{ 'keyword-option': card.type === 'meaning' }, optionClass(opt)]"
            :disabled="answered" :aria-keyshortcuts="String(i + 1)"
            @click="choose(opt)"
          >
            <span class="opt-n" aria-hidden="true">{{ i + 1 }}</span>{{ card.type === 'meaning' ? kanjiEntry(opt)?.keyword : opt }}
            <span v-if="answered && opt === card.kanji" class="opt-mark"><Icon name="check" :size="16" /></span>
            <span v-else-if="answered && opt === pickedOption" class="opt-mark"><Icon name="x" :size="16" /></span>
          </button>
        </div>

        <div
          class="feedback" role="status" aria-live="polite"
          :class="{ show: !!feedbackText, correct: correct, wrong: answered && !correct }"
        >
          <span v-if="feedbackText" class="feedback-icon"><Icon :name="correct ? 'check' : 'x'" :size="18" /></span>
          <span class="feedback-text">{{ feedbackText }}</span>
        </div>

        <div v-if="explanation && explanation.right" class="explain">
          <div class="explain-pair">
            <div v-if="explanation.yours" class="explain-item yours">
              <span class="tag">yours</span>
              <span class="k" lang="ja">{{ explanation.yours.kanji }}</span>
              <span class="r">{{ explanation.yours.keyword }}</span>
            </div>
            <div class="explain-item right">
              <span class="tag">correct</span>
              <span class="k" lang="ja">{{ explanation.right.kanji }}</span>
              <span class="r">{{ explanation.right.keyword }}</span>
            </div>
          </div>
          <div v-if="explanation.hint" class="explain-hint">{{ explanation.hint }}</div>
        </div>

        <div v-if="hook" class="mnemonic"><Icon name="bulb" :size="20" /><span>{{ hook }}</span></div>

        <template v-if="isIntro && introStep === 'watch'">
          <div v-if="parts.length" class="intro-parts">
            <span class="kd-block-title">Built from</span>
            <span class="kd-chips">
              <span v-for="p in parts" :key="p.kanji" class="kd-chip"><span class="kana" lang="ja">{{ p.kanji }}</span> {{ p.keyword }}</span>
            </span>
          </div>

          <div v-if="introWarning" class="explain intro-warning">
            <div class="explain-hint">Easy to confuse with <span class="kana" lang="ja">{{ introWarning.others.join('・') }}</span></div>
            <div v-if="introWarning.hint" class="explain-hint">{{ introWarning.hint }}</div>
          </div>
        </template>
      </div>
    </div>

    <div class="quiz-actions">
      <button v-if="secondary" class="action-secondary" @click="secondary.run()">{{ secondary.label }}</button>
      <button
        v-if="primary" class="action-primary" :class="{ intro: isIntro }"
        :disabled="primary.enabled === false"
        @click="primary.run()"
      >{{ primary.label }}<Icon name="arrow" :size="20" /></button>
    </div>
  </div>
</template>
