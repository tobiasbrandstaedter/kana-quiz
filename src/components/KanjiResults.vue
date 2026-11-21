<script setup lang="ts">
import { computed, inject } from 'vue'
import { useKanji } from '../composables/useKanji'
import { QUIZ_KEY } from '../composables/useQuiz'
import type { KanjiPattern } from '../learning/kanjiPatterns'
import { fromNow } from '../format'
import { openKanji } from '../kanjiShell'
import { kanjiStrokes } from '../data/kanjiData'
import { glyphShift, polylinePoints } from '../data/strokeGlyphs'
import KanjiPatternCards from './KanjiPatternCards.vue'
import Icon from './Icon.vue'

const { resultScore, resultLabel, missed, drawings, writeRound, roundOutcome, roundPatterns, startPattern, restart, restartLabel, goHome } = useKanji()
const { notify } = inject(QUIZ_KEY)!

function practice(p: KanjiPattern): void {
  if (!startPattern(p)) notify('Nothing of this pattern to practice yet, its kanji and words come in Practice now.')
}

// a missed write shows what was drawn over the kanji, as missed kana do
const missedItems = computed(() => missed.value.map(item => {
  const ink = drawings.value[item.id]
  const glyph = ink ? kanjiStrokes(item.text) : null
  return { item, drawn: glyph && { glyph, ink } }
}))

const outlookText = computed(() => {
  const o = roundOutcome.value.outlook
  if (o.now) return o.now === 1 ? '1 kanji or word is due now.' : `${o.now} kanji and words are due now.`
  if (o.soon) return o.soon === 1 ? '1 kanji or word comes back within a day.' : `${o.soon} kanji and words come back within a day.`
  if (o.nextAt) return `Next review ${fromNow(o.nextAt)}.`
  return ''
})

</script>

<template>
  <div class="results">
    <section class="result-card">
      <span class="eyebrow">Session complete</span>
      <div class="result-score">{{ resultScore }}</div>
      <div class="result-title">{{ resultLabel.title }} <span v-if="resultLabel.jp" class="kana" lang="ja">{{ resultLabel.jp }}</span></div>
      <div class="result-detail">{{ resultLabel.detail }}</div>
    </section>

    <div class="outcome-section">
      <div v-if="roundOutcome.mastered.length" class="outcome-line mastered">
        <span class="outcome-tag">Mastered</span>
        <span class="kana outcome-items" lang="ja">
          <!-- a word next to its kanji would look the same without its reading -->
          <span v-for="item in roundOutcome.mastered" :key="item.id">{{ item.text }}<small v-if="item.kind === 'word'" class="item-reading">{{ item.reading }}</small></span>
        </span>
      </div>
      <div v-if="roundOutcome.up.length" class="outcome-line up">
        <span class="outcome-tag">Moved up</span>
        <span class="kana outcome-items" lang="ja">
          <span v-for="item in roundOutcome.up" :key="item.id">{{ item.text }}<small v-if="item.kind === 'word'" class="item-reading">{{ item.reading }}</small></span>
        </span>
      </div>
      <div v-if="roundOutcome.down.length" class="outcome-line down">
        <span class="outcome-tag">Back to learning</span>
        <span class="kana outcome-items" lang="ja">
          <span v-for="item in roundOutcome.down" :key="item.id">{{ item.text }}<small v-if="item.kind === 'word'" class="item-reading">{{ item.reading }}</small></span>
        </span>
      </div>
      <!-- writing never moves a kanji, the usual reason would be wrong here -->
      <div v-if="writeRound" class="outcome-line quiet">
        Writing is extra practice: it never moves a kanji up or down, the check marks on the Writing tab show what you can write.
      </div>
      <div v-else-if="!roundOutcome.up.length && !roundOutcome.down.length && !roundOutcome.mastered.length" class="outcome-line quiet">
        Nothing moved: kanji and words only move up when they are due, extra practice still sharpens them.
      </div>
      <div v-if="outlookText" class="outcome-next">{{ outlookText }}</div>
    </div>

    <div v-if="missed.length" class="missed-section">
      <div class="missed-title">Missed this round <span>tap for details</span></div>
      <div class="missed-grid">
        <!-- a word opens the sheet of its home kanji, which lists it -->
        <button
          v-for="{ item, drawn } in missedItems" :key="item.id" class="missed-item" :class="{ word: item.kind === 'word' }"
          @click="openKanji(item.home)"
        >
          <!-- your drawing over the reference, strokes the app had to draw in red -->
          <svg v-if="drawn" class="missed-drawing" :viewBox="`0 0 ${drawn.glyph.width} 109`" :aria-label="`Your drawing of ${item.meaning}`">
            <path v-for="(s, i) in drawn.glyph.strokes" :key="`r${i}`" class="ref" :d="s.d" :transform="glyphShift(s.dx)" />
            <template v-for="(stroke, i) in drawn.ink" :key="i">
              <polyline v-if="stroke" class="ink" :points="polylinePoints(stroke)" />
              <path v-else class="given" :d="drawn.glyph.strokes[i].d" :transform="glyphShift(drawn.glyph.strokes[i].dx)" />
            </template>
          </svg>
          <span class="k" lang="ja">{{ item.text }}</span>
          <span class="r">
            <span v-if="item.reading" class="missed-reading" lang="ja">{{ item.reading }}</span>
            {{ item.meaning }}
          </span>
        </button>
      </div>
    </div>

    <KanjiPatternCards
      v-if="roundPatterns.length > 0"
      :patterns="roundPatterns"
      title="Patterns this round"
      @practice="practice"
    />

    <div class="result-btns">
      <button class="btn btn-action btn-lg" @click="restart()"><Icon name="replay" :size="20" />{{ restartLabel }}</button>
      <button class="btn btn-lg" @click="goHome()"><Icon name="home" :size="20" />Home</button>
    </div>
  </div>
</template>
