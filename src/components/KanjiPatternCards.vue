<script setup lang="ts">
import type { ItemInfo } from '../types'
import type { KanjiPattern } from '../learning/kanjiPatterns'
import { itemInfo } from '../learning/kanjiCards'

// The kanji twin of PatternCards: the text comes in pieces, the Japanese ones marked as such (KR57)
defineProps<{
  patterns: KanjiPattern[]
  title: string
  emptyText?: string
}>()

const emit = defineEmits<{
  practice: [pattern: KanjiPattern]
}>()

// a word shows its reading, or a kanji and its one kanji word would look the same
const chipItems = (p: KanjiPattern) => p.chips.slice(0, 12).map(itemInfo).filter((item): item is ItemInfo => !!item)
</script>

<template>
  <div class="pattern-section">
    <div class="pattern-section-title">{{ title }}</div>
    <div v-if="patterns.length === 0 && emptyText" class="pattern-empty">{{ emptyText }}</div>
    <div v-for="(p, i) in patterns" :key="p.kind + i" class="pattern-card" :class="p.kind">
      <div class="pattern-text">
        <div class="pattern-title">
          <span v-for="(piece, j) in p.title" :key="j" :class="{ kana: piece.ja }" :lang="piece.ja ? 'ja' : undefined">{{ piece.text }}</span>
        </div>
        <div class="pattern-detail">
          <span v-for="(piece, j) in p.detail" :key="j" :class="{ kana: piece.ja }" :lang="piece.ja ? 'ja' : undefined">{{ piece.text }}</span>
        </div>
        <div class="pattern-kana">
          <span v-for="item in chipItems(p)" :key="item.id" lang="ja">{{ item.text }}<small v-if="item.kind === 'word'" class="item-reading">{{ item.reading }}</small></span>
          <span v-if="p.chips.length > 12" class="more">+{{ p.chips.length - 12 }}</span>
        </div>
      </div>
      <button class="btn btn-sm pattern-practice-btn" @click="emit('practice', p)">Practice</button>
    </div>
  </div>
</template>
