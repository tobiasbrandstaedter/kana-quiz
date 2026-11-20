<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type { KanjiQuestionType } from '../types'
import { useKanji, courseEntries } from '../composables/useKanji'
import { kanjiEntry, kanjiLookalikeHint, kanjiLookalikes, kanjiStrokes } from '../data/kanjiData'
import { confusedKanji } from '../learning/kanjiStats'
import { dueAt, isDue, isSeen } from '../learning/scheduler'
import { kanjiDetail, openKanji, closeKanji } from '../kanjiShell'
import { clock } from '../clock'
import { fromNow, stageOf, accuracy, accClass, STAGE_LABEL } from '../format'
import BottomSheet from './BottomSheet.vue'
import StrokeDemo from './StrokeDemo.vue'
import Icon from './Icon.vue'

const { statOf, startKanji } = useKanji()

const entry = computed(() => kanjiDetail.value ? kanjiEntry(kanjiDetail.value) : null)
const strokes = computed(() => entry.value ? kanjiStrokes(entry.value.kanji) ?? undefined : undefined)
const stat = computed(() => entry.value ? statOf(entry.value.kanji) : undefined)
const seen = computed(() => isSeen(stat.value))
const stage = computed(() => stageOf(stat.value?.box ?? 0, seen.value))
const otherMeanings = computed(() => entry.value?.meanings.filter(m => m !== entry.value!.keyword) ?? [])

const parts = computed(() => courseEntries(entry.value?.parts ?? []))
const lookalikes = computed(() => courseEntries(entry.value ? kanjiLookalikes(entry.value.kanji) : []))

// one hint per lookalike group, a kanji in two groups has two
const hints = computed(() => {
  const all = lookalikes.value.map(other => kanjiLookalikeHint(entry.value!.kanji, other.kanji))
  return [...new Set(all.filter((h): h is string => !!h))]
})

const TYPES: Array<[KanjiQuestionType, string]> = [
  ['meaning', 'Meaning'],
  ['recognize', 'Recognize'],
]

const byType = computed(() => TYPES.map(([t, label]) => {
  const s = stat.value?.byType[t]
  const tried = !!s && s.correct + s.incorrect > 0
  return { label, state: tried ? accClass(accuracy(s)) : 'none', text: tried ? `${s.correct} right, ${s.incorrect} wrong` : 'not tried' }
}))

// what the learner picked instead, most often first, only kanji the course still has
const confusions = computed(() => confusedKanji(stat.value).filter(c => kanjiEntry(c.kanji)).slice(0, 4))

const reviewText = computed(() => {
  if (!stat.value) return ''
  return isDue(stat.value, clock.value) ? 'Due now' : `Next review ${fromNow(dueAt(stat.value), clock.value)}`
})

const answers = computed(() => (stat.value?.correct ?? 0) + (stat.value?.incorrect ?? 0))

// a part or lookalike opens in the same sheet: start it at the top and move the focus there,
// the chip that was tapped is gone
const body = ref<HTMLElement | null>(null)
watch(kanjiDetail, (now, before) => {
  if (!now || !before) return
  nextTick(() => {
    const sheet = body.value?.closest<HTMLElement>('.sheet')
    if (!sheet) return
    sheet.scrollTop = 0
    sheet.focus()
  })
})

function practice(): void {
  const kanji = entry.value!.kanji
  closeKanji()
  startKanji(kanji)
}
</script>

<template>
  <BottomSheet v-if="entry" :title="entry.keyword" @close="closeKanji()">
    <template #title><span lang="ja">{{ entry.kanji }}</span> {{ entry.keyword }}</template>
    <div ref="body" class="kana-detail">
      <div class="kd-top">
        <div class="kd-glyph">
          <StrokeDemo :key="entry.kanji" :kana="entry.kanji" :glyph="strokes" controls />
        </div>
        <div class="kd-facts">
          <div class="kd-stage" :class="stage">{{ STAGE_LABEL[stage] }}</div>
          <div v-if="seen && stat" class="kd-lines">
            <div class="kd-line">{{ reviewText }}</div>
            <div class="kd-line">{{ accuracy(stat) }}% right over {{ answers }} answer{{ answers === 1 ? '' : 's' }}</div>
          </div>
        </div>
      </div>

      <div class="kd-block">
        <div class="kd-block-title">Meaning</div>
        <div class="kd-keyword">{{ entry.keyword }}</div>
        <div v-if="otherMeanings.length" class="kd-hint">Also: {{ otherMeanings.join(', ') }}</div>
      </div>

      <div v-if="entry.hook" class="mnemonic"><Icon name="bulb" :size="20" /><span>{{ entry.hook }}</span></div>

      <div v-if="parts.length" class="kd-block">
        <div class="kd-block-title">Built from</div>
        <div class="kd-chips">
          <button v-for="part in parts" :key="part.kanji" class="kanji-chip" @click="openKanji(part.kanji)">
            <span class="kc-kanji" lang="ja">{{ part.kanji }}</span> {{ part.keyword }}
          </button>
        </div>
      </div>

      <div class="kd-dirs">
        <div v-for="r in byType" :key="r.label" class="kd-dir" :class="r.state">
          <span class="kd-dot" aria-hidden="true"></span>
          <span class="kd-dir-label">{{ r.label }}</span>
          <span class="kd-dir-text">{{ r.text }}</span>
        </div>
      </div>

      <div v-if="confusions.length" class="kd-block">
        <div class="kd-block-title">Mixed up with</div>
        <div class="kd-chips">
          <button v-for="c in confusions" :key="c.kanji" class="kanji-chip" @click="openKanji(c.kanji)">
            <span class="kc-kanji" lang="ja">{{ c.kanji }}</span> {{ c.n }}×
          </button>
        </div>
      </div>

      <div v-if="lookalikes.length" class="kd-block">
        <div class="kd-block-title">Looks like</div>
        <div class="kd-chips">
          <button v-for="other in lookalikes" :key="other.kanji" class="kanji-chip" @click="openKanji(other.kanji)">
            <span class="kc-kanji" lang="ja">{{ other.kanji }}</span> {{ other.keyword }}
          </button>
        </div>
        <div v-for="h in hints" :key="h" class="kd-hint">{{ h }}</div>
      </div>

      <button class="btn btn-primary btn-lg btn-block" @click="practice()">Practice this kanji</button>
    </div>
  </BottomSheet>
</template>
