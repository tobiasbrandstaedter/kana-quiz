<script setup lang="ts">
import { inject, computed } from 'vue'
import type { KanjiMode } from '../types'
import { QUIZ_KEY } from '../composables/useQuiz'
import { useKanji } from '../composables/useKanji'
import { HIRAGANA } from '../data/kana'
import { isSeen } from '../learning/scheduler'
import { MAX_KANJI_LEARNING } from '../learning/kanjiPlan'
import { fromNow } from '../format'
import Icon from './Icon.vue'

const { today, statsData, notify } = inject(QUIZ_KEY)!
const { summary, mode, setMode, startSmart } = useKanji()

const caughtUp = computed(() => summary.value.outlook.now + summary.value.weak + summary.value.fresh === 0)
const firstRun = computed(() => summary.value.seen === 0 && summary.value.fresh > 0)

// readings come in hiragana later on, no lock, just the advice (KD12)
const BASIC_HIRAGANA = HIRAGANA.main.flatMap(c => c.kana)
const basicHiraganaUnseen = computed(() => BASIC_HIRAGANA.some(k => !isSeen(statsData.value[k])))

const plan = computed(() => {
  const s = summary.value
  if (firstRun.value) return { headline: `Your first ${s.fresh} kanji`, rest: '' }
  const parts: Array<[number, string, string]> = [
    [s.outlook.now, 'kanji due', 'due'],
    [s.weak, 'weak kanji to firm up', 'weak'],
    [s.fresh, 'new kanji ready', 'new'],
  ]
  const live = parts.filter(([n]) => n > 0)
  if (live.length === 0) return { headline: s.seen ? 'All caught up' : 'Nothing to practice yet', rest: '' }
  const [[n, long], ...others] = live
  return { headline: `${n} ${long}`, rest: others.map(([m, , short]) => `${m} ${short}`).join(', ') }
})

const caughtUpText = computed(() => {
  const o = summary.value.outlook
  if (o.soon) return `${o.soon} kanji come back within a day.`
  if (o.nextAt) return `Next review ${fromNow(o.nextAt)}.`
  return ''
})

const NEW_BLOCKED = {
  off: 'New kanji are switched off.',
  cap: `No new kanji for now: ${MAX_KANJI_LEARNING} or more are still settling, they come first.`,
}

const MODES: Array<{ mode: KanjiMode; label: string; hint: string; icon: string; tint: string }> = [
  { mode: 'meaning', label: 'Meaning', hint: 'see the kanji, pick its meaning', icon: 'eye', tint: 'lilac' },
  { mode: 'recognize', label: 'Recognize', hint: 'see the meaning, pick the kanji', icon: 'pick', tint: 'mint' },
  { mode: 'mixed', label: 'Mixed', hint: 'by how well you know each', icon: 'shuffle', tint: 'sky' },
]

function start(): void {
  if (!startSmart()) notify('Nothing to practice right now, come back when reviews are due.')
}
</script>

<template>
  <section class="hero" aria-labelledby="kanji-hero-title">
    <div class="hero-text">
      <span class="eyebrow">{{ firstRun ? 'Start here' : today.answers ? `Keep going · ${today.answers} today` : 'Practice now' }}</span>
      <h2 id="kanji-hero-title" class="hero-title">{{ plan.headline }}</h2>
      <span v-if="firstRun" class="hero-sub">Watch each one, trace it once, then pick its meaning.</span>
      <span v-else-if="!caughtUp && plan.rest" class="hero-sub">plus {{ plan.rest }}</span>
      <span v-else-if="caughtUp" class="hero-sub">{{ caughtUpText }}</span>
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

    <div class="hero-actions">
      <button class="btn btn-action btn-lg hero-start" :disabled="caughtUp && !summary.fill" @click="start()">
        {{ firstRun ? 'Start learning' : caughtUp && summary.fill ? 'Review early' : 'Practice now' }}
        <span v-if="summary.cards" class="btn-badge">{{ summary.cards }}</span>
      </button>
    </div>
  </section>

  <h2 class="section-title spaced">How to practice</h2>
  <p class="section-note">Used by Practice now.</p>
  <div class="mode-grid three">
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
</template>
