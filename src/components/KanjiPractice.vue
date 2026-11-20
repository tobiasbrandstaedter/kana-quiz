<script setup lang="ts">
import { inject, computed, ref } from 'vue'
import type { KanjiMode } from '../types'
import type { ColumnProgress } from '../learning/scheduler'
import { QUIZ_KEY } from '../composables/useQuiz'
import { useKanji } from '../composables/useKanji'
import { HIRAGANA } from '../data/kana'
import { isSeen } from '../learning/scheduler'
import { MAX_KANJI_LEARNING } from '../learning/kanjiPlan'
import { fromNow } from '../format'
import BottomSheet from './BottomSheet.vue'
import Icon from './Icon.vue'

const { today, statsData, notify, showTab } = inject(QUIZ_KEY)!
const {
  sets, summary, mode, setMode, smartSize, smartNew, setSmartSize, setSmartNew,
  pickedSets, toggleSet, selectAllSets, selectNoneSets, progressBySet, openErrors, hasError, errorsScrollPending,
  startSmart, startCustom, wordMode,
} = useKanji()

const optionsOpen = ref(false)

// nothing due, weak or new: say so, and when the next reviews come back
const caughtUp = computed(() => summary.value.outlook.now + summary.value.weak + summary.value.fresh + summary.value.newWords === 0)
// nothing seen yet: the hero explains what is about to happen instead of counting
const firstRun = computed(() => summary.value.seen === 0 && summary.value.fresh > 0)

// readings come in hiragana later on, no lock, just the advice (KD12)
const BASIC_HIRAGANA = HIRAGANA.main.flatMap(c => c.kana)
const basicHiraganaUnseen = computed(() => BASIC_HIRAGANA.some(k => !isSeen(statsData.value[k])))

// the most pressing part of the plan is the headline, the rest goes underneath
const plan = computed(() => {
  const s = summary.value
  if (firstRun.value) return { headline: `Your first ${s.fresh} kanji`, rest: '' }
  const parts: Array<[number, string, string]> = [
    // everything that is due, kanji and words, not just what fits into one session
    [s.outlook.now, 'due for review', 'due'],
    [s.weak, 'weak ones to firm up', 'weak'],
    [s.fresh, `new kanji ready`, 'new kanji'],
    [s.newWords, `new word${s.newWords === 1 ? '' : 's'} ready`, `new word${s.newWords === 1 ? '' : 's'}`],
  ]
  const live = parts.filter(([n]) => n > 0)
  if (live.length === 0) return { headline: s.seen ? 'All caught up' : 'Nothing to practice yet', rest: '' }
  const [[n, long], ...others] = live
  return { headline: `${n} ${long}`, rest: others.map(([m, , short]) => `${m} ${short}`).join(', ') }
})

const caughtUpText = computed(() => {
  const o = summary.value.outlook
  if (o.soon) return `${o.soon} kanji and words come back within a day.`
  if (o.nextAt) return `Next review ${fromNow(o.nextAt)}.`
  return ''
})

// why nothing new comes although something is left
const NEW_BLOCKED = {
  off: 'New kanji and words are switched off in the session options.',
  sets: 'You have seen every kanji in the sets you picked, their next words come once those settle.',
  cap: `Nothing new for now: ${MAX_KANJI_LEARNING} or more kanji and words are still settling, they come first.`,
}

// picked sets also decide where new kanji come from, so say it on the card
const pickedText = computed(() => {
  const names = sets.filter(s => pickedSets.value.has(s.id)).map(s => s.title)
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
})

// how far into the course the learner is: it moves from the first session on, mastered takes days
const RING = 2 * Math.PI * 30
const seenArc = computed(() => (summary.value.seen / summary.value.total) * RING)

// the kanji modes leave words to Mixed and the word modes leave kanji to it
const MODES: Array<{ mode: KanjiMode; label: string; hint: string; icon: string; tint: string }> = [
  { mode: 'meaning', label: 'Meaning', hint: 'kanji, pick its meaning', icon: 'eye', tint: 'lilac' },
  { mode: 'recognize', label: 'Recognize', hint: 'meaning, pick the kanji', icon: 'pick', tint: 'mint' },
  { mode: 'word-meaning', label: 'Words', hint: 'word, pick its meaning', icon: 'bulb', tint: 'peach' },
  { mode: 'read-choice', label: 'Reading', hint: 'word, pick its reading', icon: 'speaker', tint: 'butter' },
  { mode: 'spell', label: 'Spelling', hint: 'reading, pick the kanji', icon: 'pen', tint: 'mint' },
  { mode: 'mixed', label: 'Mixed', hint: 'by how well you know each', icon: 'shuffle', tint: 'sky' },
]

const SIZES = [10, 20, 30]
const NEW_COUNTS = [0, 3, 5]

function start(): void {
  if (!startSmart()) notify('Nothing to practice right now, come back when reviews are due.')
}

function startQuiz(): void {
  if (!startCustom() && wordMode.value) notify('No words of these sets yet, they come with their kanji in Practice now.')
}

// the errors tile leads to the list, not to the top of a long tab
function showErrors(): void {
  errorsScrollPending.value = true
  showTab('progress')
}

const pct = (part: number, total: number) => `${Math.round((part / total) * 100)}%`

function progressText(p: ColumnProgress): string {
  if (p.seen === 0) return 'not started'
  return `${p.mastered} of ${p.total} mastered, ${p.seen - p.mastered} learning, ${p.due} due`
}
</script>

<template>
  <section class="hero" aria-labelledby="kanji-hero-title">
    <div class="hero-top">
      <div class="hero-text">
        <span class="eyebrow">{{ firstRun ? 'Start here' : today.answers ? `Keep going · ${today.answers} today` : 'Practice now' }}</span>
        <h2 id="kanji-hero-title" class="hero-title">{{ plan.headline }}</h2>
        <span v-if="firstRun" class="hero-sub">Watch each one, trace it once and pick its meaning. Then read a first word with it.</span>
        <span v-else-if="!caughtUp && plan.rest" class="hero-sub">plus {{ plan.rest }}</span>
        <span v-else-if="caughtUp" class="hero-sub">{{ caughtUpText }}</span>
      </div>
      <div class="ring" role="img" :aria-label="`${summary.seen} of ${summary.total} kanji seen`">
        <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
          <circle class="ring-track" cx="38" cy="38" r="30" />
          <circle
            v-if="seenArc > 0"
            class="ring-fill" cx="38" cy="38" r="30"
            :stroke-dasharray="`${seenArc} ${RING}`"
            transform="rotate(-90 38 38)"
          />
        </svg>
        <span class="ring-label" aria-hidden="true">
          <span class="ring-num">{{ summary.seen }}</span>
          <span class="ring-of">of {{ summary.total }}</span>
        </span>
      </div>
    </div>

    <div v-if="!caughtUp && summary.nextNew.length" class="hero-new">
      <span class="hero-new-label">New</span>
      <span v-for="k in summary.nextNew" :key="k" class="hero-kana kana" lang="ja">{{ k }}</span>
    </div>
    <div v-if="summary.newBlocked" class="hero-note">{{ NEW_BLOCKED[summary.newBlocked] }}</div>
    <div v-if="caughtUp && summary.fill" class="hero-note">
      You can review early, it won't move anything up before it is due.
    </div>
    <div v-if="summary.seen === 0 && basicHiraganaUnseen" class="hero-note">
      Kanji are read in hiragana later on, so finishing the basic hiragana first makes them easier.
    </div>

    <div v-if="summary.fromSelection && summary.newBlocked !== 'off'" class="hero-scope">
      <span>
        New kanji and words only from the sets picked below: {{ pickedText }}.
        <template v-if="summary.outsideSets.length">
          Some of their words need kanji from other sets first
          (<span class="kana" lang="ja">{{ summary.outsideSets.join('・') }}</span>), those come once you use all sets.
        </template>
      </span>
      <button class="btn btn-sm" @click="selectNoneSets()">Use all sets</button>
    </div>

    <div class="hero-actions">
      <button class="btn btn-action btn-lg hero-start" :disabled="caughtUp && !summary.fill" @click="start()">
        {{ firstRun ? 'Start learning' : caughtUp && summary.fill ? 'Review early' : 'Practice now' }}
        <span v-if="summary.cards" class="btn-badge">{{ summary.cards }}</span>
      </button>
      <button class="hero-options" aria-label="Session options" @click="optionsOpen = true">
        <Icon name="sliders" :size="20" />
      </button>
    </div>
  </section>

  <div class="stat-strip">
    <div class="stat-tile good">
      <span class="stat-num">{{ summary.itemsMastered }}</span>
      <span class="stat-label">mastered</span>
    </div>
    <div class="stat-tile primary">
      <span class="stat-num">{{ summary.itemsSeen - summary.itemsMastered }}</span>
      <span class="stat-label">learning</span>
    </div>
    <button class="stat-tile bad" :aria-label="`${openErrors.length} open errors, show them`" @click="showErrors()">
      <span class="stat-num">{{ openErrors.length }}</span>
      <span class="stat-label">errors</span>
    </button>
  </div>
  <p class="hint-line">Kanji and words counted together.</p>

  <h2 class="section-title spaced">How to practice</h2>
  <p class="section-note">Used by Practice now and by the custom quiz.</p>
  <div class="mode-grid">
    <button
      v-for="m in MODES" :key="m.mode"
      class="tile" :class="[m.tint, { active: mode === m.mode }]"
      :aria-pressed="mode === m.mode"
      @click="setMode(m.mode)"
    >
      <span class="tile-icon"><Icon :name="m.icon" :size="20" /></span>
      <span class="tile-name">{{ m.label }}</span>
      <span class="tile-hint">{{ m.hint }}</span>
      <span v-if="mode === m.mode" class="tile-check"><Icon name="check" :size="14" /></span>
    </button>
  </div>

  <!-- a section of its own, so the start bar only sticks while the sets are on screen -->
  <section class="custom-quiz">
    <div class="section-head">
      <h2 class="section-title">Custom quiz</h2>
      <span class="section-aside">{{ pickedSets.size ? `${pickedSets.size} set${pickedSets.size === 1 ? '' : 's'} picked` : 'pick sets' }}</span>
    </div>
    <div class="selector-panel">
      <div class="quick-row">
        <button class="quick-btn" @click="selectAllSets()">All</button>
        <button class="quick-btn" @click="selectNoneSets()">None</button>
      </div>
      <div class="selector-legend">
        <span class="legend-item"><span class="legend-swatch mastered"></span>Mastered</span>
        <span class="legend-item"><span class="legend-swatch learning"></span>Learning</span>
        <span class="legend-item"><span class="legend-error"></span>Open errors</span>
      </div>
      <div class="set-grid">
        <button
          v-for="s in sets" :key="s.id"
          class="col-btn set-btn"
          :class="{
            active: pickedSets.has(s.id),
            'has-errors': s.kanji.some(hasError),
            mastered: progressBySet[s.id].mastered === s.kanji.length,
          }"
          :aria-pressed="pickedSets.has(s.id)"
          @click="toggleSet(s.id)"
        >
          <span class="set-title">{{ s.title }}</span>
          <span class="set-kanji" lang="ja">{{ s.kanji.join('') }}</span>
          <span class="sr-only">, {{ progressText(progressBySet[s.id]) }}</span>
          <span class="error-dot"></span>
          <span v-if="progressBySet[s.id].seen" class="col-progress" aria-hidden="true">
            <span class="mastered" :style="{ width: pct(progressBySet[s.id].mastered, s.kanji.length) }"></span>
            <span class="learning" :style="{ width: pct(progressBySet[s.id].seen - progressBySet[s.id].mastered, s.kanji.length) }"></span>
          </span>
        </button>
      </div>
    </div>

    <!-- 17 sets fill two screens on a phone, the start button stays in reach once one is picked -->
    <div class="custom-start" :class="{ pinned: pickedSets.size > 0 }">
      <button class="btn btn-primary btn-lg" :disabled="pickedSets.size === 0" @click="startQuiz()">
        {{ pickedSets.size === 0 ? 'Pick sets first' : 'Start quiz' }}
        <Icon v-if="pickedSets.size" name="arrow" :size="20" />
      </button>
    </div>
    <p v-if="wordMode" class="hint-line">Every word of the picked sets you have met so far once, in the mode above.</p>
    <p v-else class="hint-line">Every kanji of the picked sets once, in the mode above. Kanji you haven't met yet are asked too.</p>
  </section>

  <BottomSheet v-if="optionsOpen" title="Session options" @close="optionsOpen = false">
    <div class="option-block">
      <div class="option-title">Questions per session</div>
      <div class="chip-row" role="group" aria-label="Session length">
        <button
          v-for="n in SIZES" :key="n" class="chip" :class="{ active: smartSize === n }"
          :aria-pressed="smartSize === n" @click="setSmartSize(n)"
        >{{ n }}</button>
      </div>
    </div>
    <div class="option-block">
      <div class="option-title">New kanji per session, and as many new words</div>
      <div class="chip-row" role="group" aria-label="New kanji per session">
        <button
          v-for="n in NEW_COUNTS" :key="n" class="chip" :class="{ active: smartNew === n }"
          :aria-pressed="smartNew === n" @click="setSmartNew(n)"
        >{{ n === 0 ? 'None' : `Up to ${n}` }}</button>
      </div>
      <p class="hint-line">
        New kanji come {{ summary.fromSelection ? 'from the sets you picked' : 'in course order' }}, each with its first word,
        and wait while {{ MAX_KANJI_LEARNING }} or more kanji and words are still settling.
      </p>
    </div>
    <button class="btn btn-primary btn-lg btn-block" @click="optionsOpen = false">Done</button>
  </BottomSheet>
</template>
