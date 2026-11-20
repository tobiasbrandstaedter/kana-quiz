<script setup lang="ts">
import { inject, ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { QUIZ_KEY } from '../composables/useQuiz'
import { useKanji } from '../composables/useKanji'
import { courseEntries, groupById, kanjiEntry, kanjiLookalikeHint, kanjiLookalikes, kanjiStrokes, sameForm, wordById } from '../data/kanjiData'
import { isSeen } from '../learning/scheduler'
import { optionText, spellDiff } from '../learning/kanjiCards'
import { glyphShift, polylinePoints } from '../data/strokeGlyphs'
import { setCourse } from '../kanjiShell'
import { cardGroup, kanjiId } from '../kanjiKeys'
import StrokeDemo from './StrokeDemo.vue'
import StrokeCanvas from './StrokeCanvas.vue'
import Icon from './Icon.vue'
import SpeakButton from './SpeakButton.vue'
import GroupTable from './GroupTable.vue'
import BottomSheet from './BottomSheet.vue'
import ReadingInput from './ReadingInput.vue'

const { notify, screen } = inject(QUIZ_KEY)!
const {
  statOf, cards, current, card, answered, pickedOption, gaveUp, mistake, correct, correctCount, wrongCount, startedAt, progress,
  verdict, drawn, resumedWrite, cueOf,
  choose, giveUp, submitWrite, next, goHome, resume,
} = useKanji()

// a word card carries its word, a kanji card its kanji, a table card the group that opens
// with it; `entry` is the kanji, for a word its home kanji, for a table card the counter
const word = computed(() => card.value ? wordById(card.value.id) : null)
const newGroup = computed(() => {
  const id = card.value ? cardGroup(card.value.id) : null
  return id ? groupById(id) : null
})
const entry = computed(() => card.value ? kanjiEntry(card.value.home) : null)
const isIntro = computed(() => card.value?.type === 'intro')
const kanjiIntro = computed(() => isIntro.value && !word.value && !newGroup.value)
const isWrite = computed(() => card.value?.type === 'write')
const strokes = computed(() => kanjiIntro.value || isWrite.value ? kanjiStrokes(card.value!.home) ?? undefined : undefined)
// the reading of the kanji's first word as a second cue, once that word is met (W1)
const cue = computed(() => isWrite.value ? cueOf(card.value!.home) : null)
// after a write: the drawing next to the kanji, whose stroke demo replays on a tap or with Replay
const writeDemo = ref<InstanceType<typeof StrokeDemo> | null>(null)

// a word of a group: the group, whether it is one of the irregular ones or the question word (KR77)
const wordGroup = computed(() => word.value?.group ? groupById(word.value.group) : null)
const irregular = computed(() => !!wordGroup.value?.members.find(m => m.word === word.value!.id)?.irregular)
const questionWord = computed(() => !!word.value && wordGroup.value?.question === word.value.id)

// the table of a word's group in a sheet over the card. The quiz keys stay off while it is
// open, closing it gives the focus back to the button that opened it
const wordTableOpen = ref(false)
watch(card, () => { wordTableOpen.value = false })
const isTyped = computed(() => card.value?.type === 'read-type')

// the word is the kanji standing alone: its intro only says so, the kanji intro came just before
const aloneAsWord = computed(() => !!word.value && word.value.form === word.value.home)
// Another word is written the same way: a reading card names which one it asks (KR78).
// Usually by the meaning, a group word by its table: 十 read two ways means ten both times.
const hasTwin = computed(() => word.value ? sameForm(word.value).length > 0 : false)
const twinHint = computed(() => wordGroup.value?.title ?? word.value?.gloss ?? '')

// first contact: watch the strokes, then trace once over the guide. Not scored.
const introStep = ref<'watch' | 'trace' | 'traced'>('watch')
watch(card, () => { introStep.value = 'watch' })

// the index starts over with every session, so it alone would hand a new card an old canvas
const cardKey = computed(() => `${startedAt.value}-${current.value}`)

// every card says in words what it asks (KR71), kanji and word questions apart
const label = computed(() => {
  const c = card.value
  if (!c) return ''
  if (c.type === 'intro') {
    if (newGroup.value) return 'New table'
    if (word.value) return aloneAsWord.value ? 'As a word' : 'New word'
    return introStep.value === 'watch' ? 'New kanji' : 'Now trace it'
  }
  return {
    meaning: 'What does this kanji mean?',
    recognize: 'Which kanji means',
    'word-meaning': 'What does this word mean?',
    'read-choice': 'How is this word read?',
    'read-type': 'How is this word read? Type it',
    spell: 'How is this word written?',
    write: 'Write the kanji for',
  }[c.type]
})

const parts = computed(() => courseEntries(entry.value?.parts ?? []))

// one line per kanji of the word: its meaning in this word where the course gives one, else its keyword
const wordKanji = computed(() => word.value?.kanji.map(k => ({ kanji: k, meaning: word.value!.meanings[k] ?? kanjiEntry(k)?.keyword ?? '' })) ?? [])

// lookalikes the learner knows or meets in this session, the rest would be noise
const introWarning = computed(() => {
  const c = card.value
  if (!c || !kanjiIntro.value) return null
  const met = (k: string) => isSeen(statOf(kanjiId(k))) || cards.value.some(x => x.id === kanjiId(k))
  const others = kanjiLookalikes(c.home).filter(met)
  if (others.length === 0) return null
  return { others, hint: kanjiLookalikeHint(c.home, others[0]) }
})

// picked against right after a miss (KR35), only the right one after "Don't know". For a
// written form the kanji that differs, each with its keyword
const explanation = computed(() => {
  const c = card.value
  if (!c || !answered.value || correct.value) return null
  if (c.type === 'meaning' || c.type === 'recognize') {
    const yours = pickedOption.value ? kanjiEntry(pickedOption.value) : null
    const right = entry.value!
    return {
      yours: yours && { text: yours.kanji, meaning: yours.keyword },
      right: { text: right.kanji, meaning: right.keyword },
      hint: yours ? kanjiLookalikeHint(c.home, yours.kanji) : null,
    }
  }
  const diff = c.type === 'spell' && pickedOption.value ? spellDiff(c.answer, pickedOption.value) : null
  if (diff) {
    return {
      yours: { text: pickedOption.value!, meaning: kanjiEntry(diff.given)!.keyword },
      right: { text: c.answer, meaning: kanjiEntry(diff.right)!.keyword },
      hint: kanjiLookalikeHint(diff.right, diff.given),
    }
  }
  return null
})

// the word that another reading comes from, for "that is how X is read in Y" (KR33)
const mistakeWord = computed(() => mistake.value?.kind === 'other-reading' ? wordById(mistake.value.word)?.form ?? null : null)

const feedbackText = computed(() => {
  if (!answered.value) return ''
  if (correct.value) return 'Correct'
  // the same words as for kana: what made the drawing not count
  if (isWrite.value && drawn.value) {
    const { faults, correct: clean } = drawn.value
    if (clean && resumedWrite.value) return 'Clean, counted as practice'
    return faults.order ? 'Not quite: stroke order' : faults.direction ? 'Not quite: stroke direction' : 'Not quite: needed a hint'
  }
  if (verdict.value?.result === 'wrong' && verdict.value.typo) return 'Looks like a typo again'
  return gaveUp.value ? 'Here it is' : 'Not quite'
})

// right with a reading that isn't the one shown first: name that one too
const otherReading = computed(() => verdict.value?.result === 'right' && verdict.value.kana !== card.value?.answer)

// the typed reading field of a read-type card, its Check runs from the action bar
const readingInput = ref<InstanceType<typeof ReadingInput> | null>(null)

// the hook on first contact with a kanji and after a missed kanji
const hook = computed(() => {
  if (!entry.value || word.value) return null
  return (kanjiIntro.value && introStep.value === 'watch') || (answered.value && !correct.value) ? entry.value.hook : null
})

const isLast = computed(() => current.value >= cards.value.length - 1)

// a missed item is queued again and the counter grows: say so, or it looks like a glitch
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
  if (kanjiIntro.value) {
    // nothing to trace without stroke data, the card is done once it is seen
    if (introStep.value === 'watch' && strokes.value) return { label: 'Trace it', run: () => { introStep.value = 'trace' } }
    if (introStep.value === 'trace') return { label: 'Got it', run: next, enabled: false }
    return { label: 'Got it', run: next }
  }
  if (isIntro.value) return { label: 'Got it', run: next }
  if (answered.value) return { label: isLast.value ? 'Results' : 'Next', run: next }
  if (isTyped.value) return { label: 'Check', run: () => readingInput.value?.check(), enabled: !!readingInput.value?.canSend }
  return null
})

const secondary = computed((): Action | null => {
  if (!card.value || answered.value) return null
  if (isIntro.value) {
    if (!kanjiIntro.value || introStep.value === 'traced' || !strokes.value) return null
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
  // an Enter inside a composition confirms it. The table sheet takes the keys while it is
  // open, the card behind it must not answer or move on
  if (e.isComposing || wordTableOpen.value) return
  // a focused field, link or button other than the main one does its own thing with the
  // key: the reading field checks, Show the table opens the table
  const target = e.target instanceof Element ? e.target.closest('button, a, input, textarea, select') : null
  if (target && !target.classList.contains('action-primary')) return
  // Cmd+1 switches browser tabs, and a held key must not run through the cards
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
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

const optionClass = (opt: string) => ({
  correct: answered.value && opt === card.value?.answer,
  wrong: answered.value && opt === pickedOption.value && opt !== card.value?.answer,
  dim: answered.value && opt !== card.value?.answer && opt !== pickedOption.value,
})

const optionsClass = computed(() => {
  const type = card.value?.type
  if (type === 'recognize') return 'options-grid kanji-grid'
  if (type === 'spell') return 'options-grid form-grid'
  return 'options-list'
})
const englishOptions = computed(() => card.value?.type === 'meaning' || card.value?.type === 'word-meaning')
// the longest form sets the size of all four, so they stay alike
const formLength = computed(() => Math.max(1, ...(card.value?.options ?? []).map(o => [...o].length)))
</script>

<template>
  <div class="quiz" :class="{ compact, 'q-trace': kanjiIntro, 'q-write': isWrite && !answered, 'q-resumed': resumedWrite }">
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
          <span v-if="added" class="count-added" role="status">+{{ added }}<span class="sr-only"> card{{ added === 1 ? '' : 's' }} for the missed one</span></span>
        </span>
        <span class="score-pill" :aria-label="`${correctCount} correct, ${wrongCount} wrong`">
          <Icon name="check" :size="14" />{{ correctCount }}
        </span>
      </div>
    </div>

    <div v-if="card && entry" class="quiz-body" :class="{ wide: isWrite || (kanjiIntro && introStep !== 'watch') }">
      <div class="question-card" :class="{ slim: isWrite || (kanjiIntro && introStep !== 'watch') }">
        <div class="q-label">
          <span v-if="card.reask" class="reask-tag">again</span>{{ label }}
        </div>

        <!-- the table of a group that opens: shown once, not scored (KR76) -->
        <template v-if="newGroup">
          <div class="table-title">{{ newGroup.title }}</div>
          <GroupTable :group="newGroup" />
        </template>

        <!-- a word: intro, or the word shown for its meaning or reading, or reading and meaning to spell -->
        <template v-else-if="word && card.type === 'spell'">
          <div class="q-reading" :style="{ '--len': word.reading.length }" lang="ja">{{ word.reading }}</div>
          <div class="word-gloss">{{ word.gloss }}</div>
        </template>
        <template v-else-if="word">
          <div class="q-main q-word" :style="{ '--len': [...word.form].length }" lang="ja">{{ word.form }}</div>
          <template v-if="isIntro">
            <div class="intro-reading-row">
              <span class="intro-reading" lang="ja">{{ word.reading }}</span>
              <SpeakButton :reading="word.reading" />
            </div>
            <div class="intro-keyword">{{ word.gloss }}</div>
          </template>
          <!-- two words written alike: the one meant is told by what the question doesn't ask -->
          <div v-else-if="hasTwin && (card.type === 'read-choice' || isTyped)" class="word-gloss">{{ twinHint }}</div>
          <div v-else-if="hasTwin" class="word-gloss" lang="ja">{{ word.reading }}</div>
        </template>

        <template v-else-if="isIntro">
          <StrokeDemo v-if="introStep === 'watch' && strokes" :kana="card.home" :glyph="strokes" class="intro-strokes" />
          <div v-else class="q-main" :class="{ 'intro-small': introStep !== 'watch' }" lang="ja">{{ card.home }}</div>
          <div class="intro-keyword">{{ entry.keyword }}</div>
        </template>

        <!-- write it from memory: the keyword, and the reading of its first word once that is met -->
        <template v-else-if="isWrite">
          <div class="kanji-keyword write-keyword">{{ entry.keyword }}</div>
          <div v-if="cue" class="write-cue">as in the word <span class="kana" lang="ja">{{ cue }}</span></div>
        </template>

        <div v-else-if="card.type === 'meaning'" class="q-main" lang="ja">{{ card.home }}</div>
        <div v-else-if="card.type === 'recognize'" class="kanji-keyword">{{ entry.keyword }}</div>
      </div>

      <div class="answer-area">
        <StrokeCanvas
          v-if="kanjiIntro && introStep !== 'watch' && strokes"
          :key="`trace${cardKey}`" :kana="card.home" :glyph="strokes" mode="trace"
          @done="introStep = 'traced'"
        />

        <template v-if="isWrite && strokes">
          <!-- the keyword names the canvas, the kanji itself would give the answer away to a screen reader -->
          <p v-if="resumedWrite" class="write-left-note">You left this card, so it counts as practice.</p>
          <StrokeCanvas v-if="!answered" :key="`write${cardKey}`" :kana="entry.keyword" :glyph="strokes" mode="recall" @done="submitWrite" />
          <template v-else>
            <div class="write-compare" :class="{ alone: !drawn }">
              <figure v-if="drawn" class="write-side">
                <!-- what was drawn, strokes the app had to draw in red -->
                <svg class="write-drawing" :viewBox="`0 0 ${strokes.width} 109`" role="img" :aria-label="`Your drawing of ${entry.keyword}`">
                  <template v-for="(stroke, i) in drawn.ink" :key="i">
                    <polyline v-if="stroke" class="ink" :points="polylinePoints(stroke)" />
                    <path v-else class="given" :d="strokes.strokes[i].d" :transform="glyphShift(strokes.strokes[i].dx)" />
                  </template>
                </svg>
                <figcaption>Yours</figcaption>
              </figure>
              <figure class="write-side">
                <StrokeDemo ref="writeDemo" :key="`demo${cardKey}`" :kana="card.home" :glyph="strokes" />
                <figcaption>Stroke order</figcaption>
              </figure>
            </div>
            <div class="write-replay">
              <button class="stroke-ctl" @click="writeDemo?.replay()"><Icon name="replay" :size="18" />Replay</button>
            </div>
          </template>
        </template>

        <template v-if="word && isIntro">
          <p v-if="aloneAsWord" class="intro-note">This kanji is also a word on its own, read like this.</p>
          <div v-else class="word-kanji">
            <div v-for="k in wordKanji" :key="k.kanji" class="word-kanji-row">
              <span class="kana" lang="ja">{{ k.kanji }}</span><span>{{ k.meaning }}</span>
            </div>
          </div>
          <p v-if="word.special" class="intro-note">A special reading: it belongs to the word as a whole, not to each kanji.</p>
          <div v-if="wordGroup" class="intro-group-note">
            <p class="intro-note">
              From the table {{ wordGroup.title }}.
              <template v-if="irregular">One of the irregular ones, marked in the table: learn it as it is.</template>
              <template v-else-if="questionWord">It asks which one.</template>
              <template v-else-if="wordGroup.practice === 'irregular'">It follows the pattern.</template>
            </p>
            <button class="btn btn-sm" @click="wordTableOpen = true">Show the table</button>
          </div>
        </template>

        <ReadingInput
          v-if="isTyped && word" ref="readingInput" :key="`type${cardKey}`"
          :gloss="word.gloss" :group="wordGroup" @table="wordTableOpen = true"
        />

        <div
          v-if="card.options.length"
          :class="optionsClass" :style="card.type === 'spell' ? { '--len': formLength } : undefined"
          :lang="englishOptions ? undefined : 'ja'"
        >
          <button
            v-for="(opt, i) in card.options" :key="opt"
            class="option-btn"
            :class="[{ 'keyword-option': englishOptions, 'reading-option': card.type === 'read-choice' }, optionClass(opt)]"
            :disabled="answered" :aria-keyshortcuts="String(i + 1)"
            @click="choose(opt)"
          >
            <span class="opt-n" aria-hidden="true">{{ i + 1 }}</span>{{ optionText(card, opt) }}
            <span v-if="answered && opt === card.answer" class="opt-mark"><Icon name="check" :size="16" /></span>
            <span v-else-if="answered && opt === pickedOption" class="opt-mark"><Icon name="x" :size="16" /></span>
          </button>
        </div>

        <div
          class="feedback" role="status" aria-live="polite"
          :class="{ show: !!feedbackText, correct: correct, wrong: answered && !correct }"
        >
          <span v-if="feedbackText" class="feedback-icon"><Icon :name="correct ? 'check' : 'x'" :size="18" /></span>
          <span class="feedback-text">
            {{ feedbackText }}
            <span v-if="otherReading" class="feedback-sub">Usually read <span class="kana" lang="ja">{{ card.answer }}</span>.</span>
          </span>
        </div>

        <!-- a typed reading that was missed: the right one in large hiragana (KR33) -->
        <div v-if="isTyped && answered && !correct" class="typed-answer" :style="{ '--len': card.answer.length }" lang="ja">{{ card.answer }}</div>

        <!-- after any word question: the word with its reading and meaning (KR34) -->
        <div v-if="word && answered" class="explain word-line">
          <span class="word-line-form" lang="ja">{{ word.form }}</span>
          <span class="word-line-reading" lang="ja">{{ word.reading }}</span>
          <span class="word-line-gloss">{{ word.gloss }}</span>
          <SpeakButton :reading="word.reading" />
          <button v-if="wordGroup" class="btn btn-sm" @click="wordTableOpen = true">Show the table</button>
          <!-- a wrong reading names its kind (KR33) -->
          <div v-if="mistake" class="explain-hint">
            <template v-if="mistake.kind === 'long-vowel'">Close, but a vowel is held too long or too short.</template>
            <template v-else-if="mistake.kind === 'vowel-kana'">Close, but the long vowel is written with another kana.</template>
            <template v-else-if="mistake.kind === 'small-tsu'">Close, but check the small <span class="kana" lang="ja">っ</span>, the short stop before a sound.</template>
            <template v-else-if="mistake.kind === 'voicing'">Close, but check the voicing marks, as in <span class="kana" lang="ja">か</span> and <span class="kana" lang="ja">が</span> or <span class="kana" lang="ja">は</span> and <span class="kana" lang="ja">ぱ</span>.</template>
            <template v-else-if="mistake.kind === 'other-reading'">
              That is how <span class="kana" lang="ja">{{ mistake.kanji }}</span> is read<template v-if="mistakeWord"> in <span class="kana" lang="ja">{{ mistakeWord }}</span></template>,
              here it is <span class="kana" lang="ja">{{ mistake.right }}</span>.
            </template>
          </div>
        </div>

        <div v-if="explanation" class="explain">
          <div class="explain-pair">
            <div v-if="explanation.yours" class="explain-item yours">
              <span class="tag">yours</span>
              <span class="k" lang="ja">{{ explanation.yours.text }}</span>
              <span class="r">{{ explanation.yours.meaning }}</span>
            </div>
            <div class="explain-item right">
              <span class="tag">correct</span>
              <span class="k" lang="ja">{{ explanation.right.text }}</span>
              <span class="r">{{ explanation.right.meaning }}</span>
            </div>
          </div>
          <div v-if="explanation.hint" class="explain-hint">{{ explanation.hint }}</div>
        </div>

        <div v-if="hook" class="mnemonic"><Icon name="bulb" :size="20" /><span>{{ hook }}</span></div>

        <template v-if="kanjiIntro && introStep === 'watch'">
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
      >{{ primary.label }}<Icon v-if="primary.label !== 'Check'" name="arrow" :size="20" /></button>
    </div>

    <BottomSheet v-if="wordTableOpen && wordGroup" :title="wordGroup.title" @close="wordTableOpen = false">
      <GroupTable :group="wordGroup" :current="word?.id" />
    </BottomSheet>
  </div>
</template>
