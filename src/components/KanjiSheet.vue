<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type { KanjiQuestionType } from '../types'
import { useKanji } from '../composables/useKanji'
import { courseEntries, kanjiEntry, kanjiLookalikeHint, kanjiLookalikes, kanjiReadings, kanjiStrokes, ownWords, wordById } from '../data/kanjiData'
import { confusedKanji } from '../learning/kanjiStats'
import { dueAt, isDue, isSeen } from '../learning/scheduler'
import { kanjiDetail, openKanji, closeKanji, loadKanjiPrefs, saveKanjiPrefs } from '../kanjiShell'
import { kanjiOfId } from '../kanjiKeys'
import { clock } from '../clock'
import { fromNow, stageOf, accuracy, accClass, STAGE_LABEL } from '../format'
import BottomSheet from './BottomSheet.vue'
import StrokeDemo from './StrokeDemo.vue'
import Icon from './Icon.vue'

const { statOf, lockOf, startKanji } = useKanji()

const entry = computed(() => kanjiDetail.value ? kanjiEntry(kanjiDetail.value) : null)
const strokes = computed(() => entry.value ? kanjiStrokes(entry.value.kanji) ?? undefined : undefined)
const stat = computed(() => entry.value ? statOf(entry.value.id) : undefined)
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

// its words with how far each is (KR54): a word not met yet says what still keeps it back
const words = computed(() => entry.value ? ownWords(entry.value.kanji).map(w => {
  const wordStat = statOf(w.id)
  const met = isSeen(wordStat)
  const lock = met ? null : lockOf(w.id)
  const missing = lock?.unseen.map(kanjiOfId).filter((k): k is string => !!k && k !== entry.value!.kanji) ?? []
  let note = ''
  if (met) note = ''
  else if (missing.length) note = 'unlocks once you have met'
  else if (lock?.review) note = 'unlocks once this kanji is reviewed on a later day'
  else if (lock) note = 'comes with the kanji'
  else note = 'ready, comes in a coming session'
  return { word: w, stage: stageOf(wordStat?.box ?? 0, met), note, missing }
}) : [])

// other course kanji in a word, each opens its own sheet
const otherKanji = (kanji: string[]) => courseEntries(kanji.filter(k => k !== entry.value?.kanji))

// its readings as its words show them, on and kun labeled (KD4)
const readings = computed(() => entry.value ? kanjiReadings(entry.value.kanji).map(r => ({ ...r, form: wordById(r.word)?.form ?? '' })) : [])

// what on and kun mean, once: the first time the sheet is opened (KR55)
const explainOnKun = !loadKanjiPrefs().onKunSeen
if (explainOnKun) saveKanjiPrefs({ onKunSeen: true })

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

      <div v-if="words.length" class="kd-block">
        <div class="kd-block-title">Words</div>
        <div class="kd-words">
          <div v-for="w in words" :key="w.word.id" class="kd-word">
            <div class="kd-word-main">
              <span class="kd-word-form" lang="ja">{{ w.word.form }}</span>
              <span class="kd-word-reading" lang="ja">{{ w.word.reading }}</span>
              <span class="kd-word-gloss">{{ w.word.gloss }}</span>
              <span class="kd-word-stage stats-stage" :class="w.stage">{{ STAGE_LABEL[w.stage] }}</span>
            </div>
            <div v-if="w.note" class="kd-word-note">
              {{ w.note }}<template v-if="w.missing.length"> <span class="kana" lang="ja">{{ w.missing.join('・') }}</span></template>
            </div>
            <div v-if="otherKanji(w.word.kanji).length" class="kd-chips">
              <button v-for="k in otherKanji(w.word.kanji)" :key="k.kanji" class="kanji-chip" @click="openKanji(k.kanji)">
                <span class="kc-kanji" lang="ja">{{ k.kanji }}</span> {{ w.word.meanings[k.kanji] ?? k.keyword }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="readings.length" class="kd-block">
        <div class="kd-block-title">Readings</div>
        <p v-if="explainOnKun" class="kd-hint kd-onkun">On readings come from Chinese and show up in words of two or more kanji, kun readings are native Japanese and often stand alone.</p>
        <div class="kd-chips">
          <span v-for="r in readings" :key="r.reading" class="kd-chip kd-reading">
            <span class="kana" lang="ja">{{ r.reading }}</span>
            <span v-if="r.kind" class="kd-reading-kind">{{ r.kind }}</span>
            <span class="kd-reading-word">as in <span lang="ja">{{ r.form }}</span></span>
          </span>
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
