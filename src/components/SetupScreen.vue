<script setup lang="ts">
import { inject, computed, ref } from 'vue'
import type { ActiveScript, QuizMode, SetupTab } from '../types'
import { QUIZ_KEY } from '../composables/useQuiz'
import { fromNow } from '../format'
import ColumnSelector from './ColumnSelector.vue'
import ProgressTab from './ProgressTab.vue'
import StrokesTab from './StrokesTab.vue'
import SettingsSheet from './SettingsSheet.vue'
import BottomSheet from './BottomSheet.vue'
import Icon from './Icon.vue'

const {
  today,
  activeTab, showTab, errorTabCount, selectedCount,
  activeScript, setScript,
  selectorScripts, selectedCols, errorKanaSet, toggleCol, selectAll, selectNone, selectGroup,
  quizMode, setMode, timed, toggleTimed,
  smartSize, smartNew, setSmartSize, setSmartNew,
  questionCountInput, countHint,
  startQuiz, startSmartPractice, smartSummary, columnProgressMap,
} = inject(QUIZ_KEY)!

const settingsOpen = ref(false)
const optionsOpen = ref(false)

const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
})

// nothing due, weak or new: say so, and when the next reviews come back
const caughtUp = computed(() => {
  const s = smartSummary.value
  return s.due + s.weak + s.fresh === 0
})

// the most pressing part of the plan is the headline, the rest goes underneath
const plan = computed(() => {
  const s = smartSummary.value
  const parts: Array<[number, string, string]> = [
    [s.due, 'kana due', 'due'],
    [s.weak, 'weak kana to firm up', 'weak'],
    [s.fresh, 'new kana ready', 'new'],
  ]
  const live = parts.filter(([n]) => n > 0)
  if (live.length === 0) return { headline: 'All caught up', rest: '' }
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

// share of the kana in play that reached the mastered box
const totalKana = computed(() => selectorScripts.value
  .reduce((n, [, data]) => n + Object.values(data).reduce((m, cols) => m + cols.reduce((k, c) => k + c.kana.length, 0), 0), 0))
const masteredPct = computed(() => totalKana.value ? Math.round((smartSummary.value.mastered / totalKana.value) * 100) : 0)
const RING = 2 * Math.PI * 30

const SCRIPTS: Array<[ActiveScript, string]> = [
  ['hiragana', 'Hiragana'],
  ['katakana', 'Katakana'],
  ['both', 'Both'],
]

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

function badge(tab: SetupTab): number {
  if (tab === 'practice') return smartSummary.value.due
  if (tab === 'progress') return errorTabCount.value
  return 0
}
</script>

<template>
  <div class="home">
    <header class="topbar">
      <div class="greeting">
        <span class="hello">{{ greeting }}</span>
        <h1 class="brand">Kana Quiz <span class="kana">かな</span></h1>
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
        class="seg-btn" :class="{ active: activeScript === val }"
        :aria-pressed="activeScript === val"
        @click="setScript(val)"
      >{{ label }}</button>
    </div>

    <!-- Practice tab -->
    <div v-show="activeTab === 'practice'" class="tab-page">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-top">
          <div class="hero-text">
            <span class="eyebrow">{{ today.answers ? `Keep going · ${today.answers} today` : 'Practice now' }}</span>
            <h2 id="hero-title" class="hero-title">{{ plan.headline }}</h2>
            <span v-if="!caughtUp && plan.rest" class="hero-sub">plus {{ plan.rest }}</span>
            <span v-else-if="caughtUp" class="hero-sub">{{ caughtUpText }}</span>
          </div>
          <div class="ring" role="img" :aria-label="`${masteredPct} percent of these kana mastered`">
            <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
              <circle class="ring-track" cx="38" cy="38" r="30" />
              <circle
                v-if="masteredPct > 0"
                class="ring-fill" cx="38" cy="38" r="30"
                :stroke-dasharray="`${(masteredPct / 100) * RING} ${RING}`"
                transform="rotate(-90 38 38)"
              />
            </svg>
            <span class="ring-label">{{ masteredPct }}%</span>
          </div>
        </div>

        <div v-if="!caughtUp && smartSummary.nextNew.length" class="hero-new">
          <span class="hero-new-label">New</span>
          <span v-for="k in smartSummary.nextNew" :key="k" class="hero-kana kana">{{ k }}</span>
        </div>
        <div v-else-if="!caughtUp && smartSummary.newHeldBack" class="hero-note">
          No new kana for now: 10 or more are still shaky, they come first.
        </div>
        <div v-else-if="caughtUp && smartSummary.fill" class="hero-note">
          You can review early, it won't move anything up before it is due.
        </div>

        <div class="hero-actions">
          <button class="btn btn-action btn-lg hero-start" :disabled="caughtUp && !smartSummary.fill" @click="startSmartPractice()">
            {{ caughtUp ? 'Review early' : 'Practice now' }}
            <span class="btn-badge">{{ smartSize }}</span>
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
        <button class="stat-tile bad" :aria-label="`${errorTabCount} kana to fix, show progress`" @click="showTab('progress')">
          <span class="stat-num">{{ errorTabCount }}</span>
          <span class="stat-label">to fix</span>
        </button>
      </div>

      <div class="section-head">
        <h2 class="section-title">How to practice</h2>
        <span class="section-aside">for both kinds of quiz</span>
      </div>
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
        <button class="tile timed" :class="{ active: timed }" :aria-pressed="timed" @click="toggleTimed()">
          <span class="tile-icon"><Icon name="timer" :size="20" /></span>
          <span class="tile-name">Timed <span class="switch" :class="{ on: timed }" aria-hidden="true"></span></span>
          <span class="tile-hint">at your usual pace, drawing is never timed</span>
        </button>
      </div>

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

      <div class="custom-start">
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
    </div>

    <!-- writing tab, v-if so the animation only runs while it is visible -->
    <div v-if="activeTab === 'strokes'" class="tab-page">
      <StrokesTab />
    </div>

    <div v-if="activeTab === 'progress'" class="tab-page">
      <ProgressTab />
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
          and wait while 10 or more are still shaky.
        </p>
      </div>
      <button class="btn btn-primary btn-lg btn-block" @click="optionsOpen = false">Done</button>
    </BottomSheet>
  </div>
</template>
