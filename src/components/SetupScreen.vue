<script setup lang="ts">
import { inject, computed, ref, nextTick } from 'vue'
import type { ActiveScript, QuizMode, SetupTab } from '../types'
import { QUIZ_KEY } from '../composables/useQuiz'
import { fromNow } from '../format'
import { MAX_LEARNING, isDue, isSeen } from '../learning/scheduler'
import { clock } from '../clock'
import { course, setCourse, kanjiDue } from '../kanjiShell'
import ColumnSelector from './ColumnSelector.vue'
import ProgressTab from './ProgressTab.vue'
import StrokesTab from './StrokesTab.vue'
import SettingsSheet from './SettingsSheet.vue'
import KanjiPart from './KanjiPart.vue'
import BottomSheet from './BottomSheet.vue'
import Icon from './Icon.vue'

const {
  today,
  activeTab, showTab, errorPairs, selectedCount, pickedCols, kanaTracked,
  activeScript, setScript, statsData,
  selectorScripts, selectedCols, errorKanaSet, toggleCol, selectAll, selectNone, selectGroup,
  quizMode, setMode, timed, toggleTimed,
  smartSize, smartNew, setSmartSize, setSmartNew,
  questionCountInput, countHint,
  startQuiz, startSmartPractice, smartSummary, columnProgressMap,
} = inject(QUIZ_KEY)!

const settingsOpen = ref(false)
const optionsOpen = ref(false)

const greeting = computed(() => {
  const h = new Date(clock.value).getHours()
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
})

// nothing due, weak or new: say so, and when the next reviews come back
const caughtUp = computed(() => {
  const s = smartSummary.value
  return s.due + s.weak + s.fresh === 0
})

// nothing seen in this script yet: the hero explains what is about to happen instead of counting
const firstRun = computed(() => smartSummary.value.seen === 0 && smartSummary.value.fresh > 0)
const scriptWord = computed(() => activeScript.value === 'both' ? 'kana' : activeScript.value)

// the most pressing part of the plan is the headline, the rest goes underneath
const plan = computed(() => {
  const s = smartSummary.value
  if (firstRun.value) return { headline: `Your first ${s.fresh} ${scriptWord.value}`, rest: '' }
  const parts: Array<[number, string, string]> = [
    // everything that is due, not just what fits into one session
    [s.outlook.now, 'kana due', 'due'],
    [s.weak, 'weak kana to firm up', 'weak'],
    [s.fresh, 'new kana ready', 'new'],
  ]
  const live = parts.filter(([n]) => n > 0)
  if (live.length === 0) return { headline: s.seen ? 'All caught up' : 'Nothing to practice yet', rest: '' }
  const [[n, long], ...others] = live
  return {
    headline: `${n} ${long}`,
    rest: others.map(([m, , short]) => `${m} ${short}`).join(', '),
  }
})

const caughtUpText = computed(() => {
  const o = smartSummary.value.outlook
  if (o.soon) return `${o.soon} kana come back within a day.`
  if (o.nextAt) return `Next review ${fromNow(o.nextAt)}.`
  return ''
})

// why no new kana come although some are left
const NEW_BLOCKED = {
  off: 'New kana are switched off in the session options.',
  rows: 'You have seen every kana in the rows you picked.',
  cap: `No new kana for now: ${MAX_LEARNING} or more are still settling, they come first.`,
}

// rows picked for the custom quiz also decide where new kana come from, so say it on the card
const pickedText = computed(() => {
  const names = pickedCols.value.map(c => c.romaji[0])
  return names.length > 4 ? `${names.slice(0, 4).join(', ')} +${names.length - 4}` : names.join(', ')
})

// how far into the table the learner is: it moves from the first session on, mastered takes days
const RING = 2 * Math.PI * 30
const seenArc = computed(() => smartSummary.value.total ? (smartSummary.value.seen / smartSummary.value.total) * RING : 0)

const SCRIPTS: Array<[ActiveScript, string]> = [
  ['hiragana', 'Hiragana'],
  ['katakana', 'Katakana'],
  ['both', 'Both'],
]

// Kanji is a fourth segment but not a fourth script: it switches the course and leaves
// activeScript alone, so no kana code ever sees it
function pickScript(script: ActiveScript): void {
  setCourse('kana')
  setScript(script)
}

// scripts with kana due, for the dots on the kana segments while Kanji is on screen
const kanaDueScripts = computed(() => {
  const now = clock.value
  return new Set(Object.values(statsData.value).filter(e => isSeen(e) && isDue(e, now)).map(e => e.script))
})

function segmentDot(script: ActiveScript): boolean {
  if (course.value !== 'kanji') return false
  return script === 'both' ? kanaDueScripts.value.size > 0 : kanaDueScripts.value.has(script)
}

const MODES: Array<{ mode: QuizMode; label: string; hint: string; icon: string; tint: string }> = [
  { mode: 'romaji-to-kana', label: 'Recognize', hint: 'see romaji, pick the kana', icon: 'pick', tint: 'mint' },
  { mode: 'kana-to-romaji', label: 'Read', hint: 'see the kana, type romaji', icon: 'eye', tint: 'lilac' },
  { mode: 'draw', label: 'Write', hint: 'draw it from memory', icon: 'pen', tint: 'peach' },
  { mode: 'listen', label: 'Listen', hint: 'hear it, write it', icon: 'speaker', tint: 'butter' },
  { mode: 'mixed', label: 'Mixed', hint: 'by how well you know each', icon: 'shuffle', tint: 'sky' },
]

const TABS: Array<[SetupTab, string, string]> = [
  ['practice', 'Practice', 'home'],
  ['strokes', 'Writing', 'pen'],
  ['progress', 'Progress', 'chart'],
]

const SIZES = [10, 20, 30]
const NEW_COUNTS = [0, 3, 5]

// the errors tile leads to the list, not to the top of a long tab
function showErrors(): void {
  showTab('progress')
  nextTick(() => document.getElementById('open-errors')?.scrollIntoView({ block: 'start' }))
}

function badge(tab: SetupTab): number {
  // the kanji Progress tab has no error list yet
  if (course.value === 'kanji') return tab === 'practice' ? kanjiDue.value : 0
  if (tab === 'practice') return smartSummary.value.outlook.now
  if (tab === 'progress') return errorPairs.value.length
  return 0
}
</script>

<template>
  <div class="home">
    <header class="topbar">
      <div class="greeting">
        <span class="hello">{{ greeting }}</span>
        <h1 class="brand">Kana Quiz <span class="kana" lang="ja">かな</span></h1>
      </div>
      <div class="topbar-actions">
        <span v-if="today.streak" class="streak-pill" :aria-label="`${today.streak} day streak`">
          <Icon name="flame" :size="16" />{{ today.streak }}
        </span>
        <button class="icon-btn" aria-label="Settings" @click="settingsOpen = true">
          <Icon name="gear" />
        </button>
      </div>
    </header>

    <div class="segmented script-toggle" role="group" aria-label="Script">
      <button
        v-for="[val, label] in SCRIPTS" :key="val"
        class="seg-btn" :class="{ active: course === 'kana' && activeScript === val }"
        :aria-pressed="course === 'kana' && activeScript === val"
        @click="pickScript(val)"
      >{{ label }}<span v-if="segmentDot(val)" class="seg-dot"><span class="sr-only">, reviews due</span></span></button>
      <button
        class="seg-btn" :class="{ active: course === 'kanji' }"
        :aria-pressed="course === 'kanji'"
        @click="setCourse('kanji')"
      >Kanji<span v-if="course === 'kana' && kanjiDue" class="seg-dot"><span class="sr-only">, reviews due</span></span></button>
    </div>

    <div v-if="course === 'kanji' && activeTab === 'practice'" class="tab-page">
      <KanjiPart part="KanjiPractice" />
    </div>

    <!-- Practice tab -->
    <div v-show="course === 'kana' && activeTab === 'practice'" class="tab-page">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-top">
          <div class="hero-text">
            <span class="eyebrow">{{ firstRun ? 'Start here' : today.answers ? `Keep going · ${today.answers} today` : 'Practice now' }}</span>
            <h2 id="hero-title" class="hero-title">{{ plan.headline }}</h2>
            <span v-if="firstRun" class="hero-sub">Watch each one, trace it, then get asked. About 3 minutes.</span>
            <span v-else-if="!caughtUp && plan.rest" class="hero-sub">plus {{ plan.rest }}</span>
            <span v-else-if="caughtUp" class="hero-sub">{{ caughtUpText }}</span>
          </div>
          <div class="ring" role="img" :aria-label="`${smartSummary.seen} of ${smartSummary.total} kana seen`">
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
              <span class="ring-num">{{ smartSummary.seen }}</span>
              <span class="ring-of">of {{ smartSummary.total }}</span>
            </span>
          </div>
        </div>

        <div v-if="!caughtUp && smartSummary.nextNew.length" class="hero-new">
          <span class="hero-new-label">New</span>
          <span v-for="k in smartSummary.nextNew" :key="k" class="hero-kana kana" lang="ja">{{ k }}</span>
        </div>
        <div v-if="smartSummary.newBlocked" class="hero-note">{{ NEW_BLOCKED[smartSummary.newBlocked] }}</div>
        <div v-if="caughtUp && smartSummary.fill" class="hero-note">
          You can review early, it won't move anything up before it is due.
        </div>
        <!-- the app in one sentence, until there is something to show instead -->
        <div v-if="kanaTracked === 0" class="hero-note">
          What you learn comes back as short reviews, later and later the better you know it.
        </div>

        <div v-if="smartSummary.fromSelection && smartSummary.newBlocked !== 'off'" class="hero-scope">
          <span>New kana only from the rows picked below: {{ pickedText }}</span>
          <button class="btn btn-sm" @click="selectNone()">Use all rows</button>
        </div>

        <div class="hero-actions">
          <button class="btn btn-action btn-lg hero-start" :disabled="caughtUp && !smartSummary.fill" @click="startSmartPractice()">
            {{ firstRun ? 'Start learning' : caughtUp && smartSummary.fill ? 'Review early' : 'Practice now' }}
            <span v-if="smartSummary.cards" class="btn-badge">{{ smartSummary.cards }}</span>
          </button>
          <button class="hero-options" aria-label="Session options" @click="optionsOpen = true">
            <Icon name="sliders" :size="20" />
          </button>
        </div>
      </section>

      <div class="stat-strip">
        <div class="stat-tile good">
          <span class="stat-num">{{ smartSummary.mastered }}</span>
          <span class="stat-label">mastered</span>
        </div>
        <div class="stat-tile primary">
          <span class="stat-num">{{ smartSummary.seen - smartSummary.mastered }}</span>
          <span class="stat-label">learning</span>
        </div>
        <button class="stat-tile bad" :aria-label="`${errorPairs.length} open errors, show them`" @click="showErrors()">
          <span class="stat-num">{{ errorPairs.length }}</span>
          <span class="stat-label">errors</span>
        </button>
      </div>

      <h2 class="section-title spaced">How to practice</h2>
      <p class="section-note">Used by Practice now and by the custom quiz.</p>
      <div class="mode-grid">
        <button
          v-for="m in MODES" :key="m.mode"
          class="tile" :class="[m.tint, { active: quizMode === m.mode }]"
          :aria-pressed="quizMode === m.mode"
          @click="setMode(m.mode)"
        >
          <span class="tile-icon"><Icon :name="m.icon" :size="20" /></span>
          <span class="tile-name">{{ m.label }}</span>
          <span class="tile-hint">{{ m.hint }}</span>
          <span v-if="quizMode === m.mode" class="tile-check"><Icon name="check" :size="14" /></span>
        </button>
      </div>
      <!-- a switch on top of the mode, not a sixth mode, so it gets a row of its own -->
      <button class="tile timed-row" role="switch" :aria-checked="timed" @click="toggleTimed()">
        <span class="tile-icon"><Icon name="timer" :size="20" /></span>
        <span class="timed-text">
          <span class="tile-name">Timed</span>
          <span class="tile-hint">at your usual pace, drawing is never timed</span>
        </span>
        <span class="switch" :class="{ on: timed }" aria-hidden="true"></span>
      </button>

      <!-- a section of its own, so the start bar only sticks while the rows are on screen -->
      <section class="custom-quiz">
      <div class="section-head">
        <h2 class="section-title">Custom quiz</h2>
        <span class="section-aside">{{ selectedCount ? `${selectedCount} row${selectedCount === 1 ? '' : 's'} picked` : 'pick rows' }}</span>
      </div>
      <ColumnSelector
        :selector-scripts="selectorScripts"
        :selected-cols="selectedCols"
        :error-kana-set="errorKanaSet"
        :progress="columnProgressMap"
        @toggle="toggleCol"
        @select-all="selectAll"
        @select-none="selectNone"
        @select-group="selectGroup"
      />

      <!-- the rows fill two screens on a phone, the start button stays in reach once something is picked -->
      <div class="custom-start" :class="{ pinned: selectedCount > 0 }">
        <label class="count-field">
          <span class="count-label">Questions</span>
          <input
            class="count-input" type="number" inputmode="numeric" min="1" max="999" placeholder="all"
            v-model="questionCountInput"
          />
        </label>
        <button class="btn btn-primary btn-lg" :disabled="selectedCount === 0" @click="startQuiz(false)">
          {{ selectedCount === 0 ? 'Pick rows first' : 'Start quiz' }}
          <Icon v-if="selectedCount" name="arrow" :size="20" />
        </button>
      </div>
      <p class="hint-line">{{ countHint }}</p>
      </section>
    </div>

    <!-- writing tab, v-if so the animation only runs while it is visible -->
    <div v-if="course === 'kana' && activeTab === 'strokes'" class="tab-page">
      <StrokesTab />
    </div>

    <div v-if="course === 'kana' && activeTab === 'progress'" class="tab-page">
      <ProgressTab />
    </div>

    <!-- kanji Writing and Progress come with the next step -->
    <div v-if="course === 'kanji' && activeTab !== 'practice'" class="tab-page">
      <div class="no-stats-state">
        <span class="msg">{{ activeTab === 'strokes'
          ? 'Kanji writing comes with the next update. Until then every new kanji is traced once on its intro card.'
          : 'Kanji progress comes with the next update. Your answers are saved already and will show up here.' }}</span>
      </div>
    </div>

    <nav class="tabbar" aria-label="Sections">
      <div class="tabbar-inner">
        <button
          v-for="[tab, label, icon] in TABS" :key="tab"
          class="tabbar-btn" :class="{ active: activeTab === tab }"
          :aria-current="activeTab === tab ? 'page' : undefined"
          @click="showTab(tab)"
        >
          <span class="tabbar-icon"><Icon :name="icon" :size="24" /></span>
          {{ label }}
          <span
            v-if="badge(tab)" class="tabbar-badge" :class="{ bad: tab === 'progress' }"
            :aria-label="tab === 'progress' ? `${badge(tab)} open errors` : `${badge(tab)} due`"
          >{{ badge(tab) }}</span>
        </button>
      </div>
    </nav>

    <SettingsSheet v-if="settingsOpen" @close="settingsOpen = false" />

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
        <div class="option-title">New kana per session</div>
        <div class="chip-row" role="group" aria-label="New kana per session">
          <button
            v-for="n in NEW_COUNTS" :key="n" class="chip" :class="{ active: smartNew === n }"
            :aria-pressed="smartNew === n" @click="setSmartNew(n)"
          >{{ n === 0 ? 'None' : `Up to ${n}` }}</button>
        </div>
        <p class="hint-line">
          New kana come {{ smartSummary.fromSelection ? 'from the rows you picked' : 'in table order' }},
          and wait while {{ MAX_LEARNING }} or more are still settling.
        </p>
      </div>
      <button class="btn btn-primary btn-lg btn-block" @click="optionsOpen = false">Done</button>
    </BottomSheet>
  </div>
</template>
