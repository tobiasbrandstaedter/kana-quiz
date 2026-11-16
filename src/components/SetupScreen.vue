<script setup lang="ts">
import { inject, computed } from 'vue'
import type { ActiveScript, QuizMode } from '../types'
import { QUIZ_KEY } from '../composables/useQuiz'
import ColumnSelector from './ColumnSelector.vue'
import ErrorsTab from './ErrorsTab.vue'
import StatsTab from './StatsTab.vue'
import StrokesTab from './StrokesTab.vue'

const {
  headerTitle, kanaFont, setKanaFont,
  activeTab, showTab, errorTabCount, statsTabCount, selectedCount,
  activeScript, setScript,
  selectorScripts, selectedCols, errorKanaSet, toggleCol, selectAll, selectNone, selectGroup,
  quizMode, setMode, timed, toggleTimed,
  questionCountInput, countHint,
  startQuiz, startSmartPractice, smartSummary, columnProgressMap, strokeColumns,
} = inject(QUIZ_KEY)!

const strokeKanaCount = computed(() => strokeColumns.value.reduce((n, c) => n + c.kana.length, 0))

const smartText = computed(() => {
  const s = smartSummary.value
  const parts = [
    s.due && `${s.due} due`,
    s.weak && `${s.weak} weak`,
    s.fresh && `${s.fresh} new`,
    s.fill && `${s.fill} early review`,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'Nothing to practice right now'
})

const FONTS = [
  { family: 'Noto Sans JP',      label: 'Sans' },
  { family: 'Noto Serif JP',     label: 'Serif' },
  { family: 'M PLUS Rounded 1c', label: 'Round' },
  { family: 'Kosugi Maru',       label: 'Brush' },
  { family: 'BIZ UDGothic',      label: 'Gothic' },
]

const SCRIPTS: Array<[ActiveScript, string]> = [
  ['hiragana', 'Hiragana'],
  ['katakana', 'Katakana'],
  ['both', 'Both'],
]

const MODES: Array<[QuizMode, string]> = [
  ['kana-to-romaji', 'Kana → Romaji'],
  ['romaji-to-kana', 'Romaji → Kana'],
  ['draw', 'Romaji → Write'],
  ['listen', 'Listen → Write'],
  ['mixed', 'Mixed'],
]
</script>

<template>
  <div>
    <header>
      <div class="title-jp">{{ headerTitle }}</div>
      <div class="title-en">Kana Practice Quiz</div>
    </header>

    <div class="section-label" style="margin-bottom:10px">Kana Font</div>
    <div class="font-switcher">
      <button
        v-for="f in FONTS" :key="f.family"
        class="font-btn" :class="{ active: kanaFont === f.family }"
        @click="setKanaFont(f.family)"
      >
        <span class="fb-kana" :style="{ fontFamily: `'${f.family}', sans-serif` }">あ</span>
        <span class="fb-label">{{ f.label }}</span>
      </button>
    </div>

    <div class="nav-tabs">
      <button class="nav-tab" :class="{ active: activeTab === 'practice' }" @click="showTab('practice')">
        <span class="tab-count">{{ selectedCount }}</span>Practice Quiz
      </button>
      <button class="nav-tab" :class="{ active: activeTab === 'strokes' }" @click="showTab('strokes')">
        <span class="tab-count">{{ strokeKanaCount }}</span>Stroke Order
      </button>
      <button
        class="nav-tab error-tab"
        :class="{ active: activeTab === 'errors', 'has-errors': errorTabCount > 0 }"
        @click="showTab('errors')"
      >
        <span class="tab-count">{{ errorTabCount }}</span>Errors
      </button>
      <button class="nav-tab" :class="{ active: activeTab === 'stats' }" @click="showTab('stats')">
        <span class="tab-count">{{ statsTabCount }}</span>Statistics
      </button>
    </div>

    <!-- Practice tab -->
    <div v-show="activeTab === 'practice'">
      <div class="smart-panel">
        <div class="smart-text">
          <div class="smart-title">Smart practice</div>
          <div class="smart-summary">{{ smartText }}</div>
          <div class="smart-note">Due reviews first, then new kana from your selection. Uses the settings below, blank count = 20.</div>
        </div>
        <button class="smart-btn" @click="startSmartPractice()">START</button>
      </div>

      <div class="section-label">01 — Script</div>
      <div class="script-toggle">
        <button
          v-for="[val, label] in SCRIPTS" :key="val"
          class="script-btn" :class="{ active: activeScript === val }"
          @click="setScript(val)"
        >{{ label }}</button>
      </div>

      <div class="section-label">02 — Select Columns</div>
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

      <div class="section-label">03 — Quiz Mode</div>
      <div class="mode-panel">
        <span class="mode-label">Direction</span>
        <button
          v-for="[val, label] in MODES" :key="val"
          class="mode-btn" :class="{ active: quizMode === val }"
          @click="setMode(val)"
        >{{ label }}</button>
      </div>
      <div class="mode-panel">
        <span class="mode-label">Fluency</span>
        <button class="mode-btn" :class="{ active: timed }" :aria-pressed="timed" @click="toggleTimed()">
          ⏱ {{ timed ? 'Timed: on' : 'Timed: off' }}
        </button>
        <span class="count-hint">3 to 3.5 s per answer, drawing is never timed</span>
      </div>

      <div class="section-label">04 — Number of Questions</div>
      <div class="count-panel">
        <span class="mode-label">Questions</span>
        <input
          class="count-input" type="number" min="1" max="999" placeholder="all"
          aria-label="Number of questions"
          v-model="questionCountInput"
        />
        <span class="count-hint">{{ countHint }}</span>
      </div>

      <button class="start-btn" :disabled="selectedCount === 0" @click="startQuiz(false)">START QUIZ</button>
    </div>

    <!-- Stroke order tab, v-if so the animation only runs while it is visible -->
    <div v-if="activeTab === 'strokes'">
      <StrokesTab />
    </div>

    <!-- Errors tab -->
    <div v-show="activeTab === 'errors'">
      <ErrorsTab />
    </div>

    <!-- Stats tab -->
    <div v-show="activeTab === 'stats'">
      <StatsTab />
    </div>
  </div>
</template>
