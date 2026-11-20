<script setup lang="ts">
import { computed } from 'vue'
import type { WordGroupEntry } from '../types'
import { wordById } from '../data/kanjiData'
import SpeakButton from './SpeakButton.vue'

// The table of a word group (KD17): what it is in one line, every member with its reading,
// top to bottom in two columns, and the question word below. The group card, the sheet and
// the feedback of a member all show this one. `current` is the word the table was opened from.
const props = defineProps<{ group: WordGroupEntry; current?: string }>()

// only groups practiced by exception carry marks (KR74)
const marked = computed(() => props.group.practice === 'irregular')
const rows = computed(() => props.group.members.map(m => ({ word: wordById(m.word)!, irregular: marked.value && m.irregular })))
const question = computed(() => props.group.question ? wordById(props.group.question) : null)
</script>

<template>
  <div class="group-table">
    <template v-if="marked">
      <p class="group-what">How a number is read in front of <span class="kana" lang="ja">{{ group.counter }}</span>.</p>
      <p class="group-what">
        <span class="group-swatch" aria-hidden="true"></span>The marked ones change their sound, learn those.
        The rest are just the number plus the counter.
      </p>
    </template>
    <p v-else class="group-what">In order. Each one is a word of its own, learn them as they are.</p>
    <ul class="group-rows" :style="{ '--rows': Math.ceil(rows.length / 2) }">
      <li v-for="r in rows" :key="r.word.id" class="group-row" :class="{ irregular: r.irregular, current: r.word.id === current }">
        <span class="group-word">
          <span class="group-form" lang="ja">{{ r.word.form }}</span>
          <span class="group-reading" :style="{ '--len': r.word.reading.length }" lang="ja">{{ r.word.reading }}</span>
        </span>
        <span v-if="r.irregular" class="sr-only">, marked</span>
        <SpeakButton :reading="r.word.reading" />
      </li>
    </ul>
    <div v-if="question" class="group-row group-question" :class="{ current: question.id === current }">
      <span class="group-ask">To ask</span>
      <span class="group-word">
        <span class="group-form" lang="ja">{{ question.form }}</span>
        <span class="group-reading" :style="{ '--len': question.reading.length }" lang="ja">{{ question.reading }}</span>
      </span>
      <SpeakButton :reading="question.reading" />
    </div>
  </div>
</template>
