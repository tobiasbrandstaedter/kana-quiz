<script setup lang="ts">
import { inject } from 'vue'
import type { ActiveScript, QuizMode } from '../types'
import { QUIZ_KEY } from '../composables/useQuiz'
import ColumnSelector from './ColumnSelector.vue'
import ErrorsTab from './ErrorsTab.vue'
import StatsTab from './StatsTab.vue'

const {
  headerTitle, kanaFont, setKanaFont,
  activeTab, showTab, errorTabCount, statsTabCount, selectedCount,
  activeScript, setScript,
  selectorScripts, selectedCols, errorKanaSet, toggleCol, selectAll, selectNone, selectGroup,
  quizMode, setMode,
  questionCountInput, countHint,
  startQuiz,
} = inject(QUIZ_KEY)!

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
