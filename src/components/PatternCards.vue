<script setup lang="ts">
import type { Pattern } from '../learning/patterns'

defineProps<{
  patterns: Pattern[]
  title: string
  emptyText?: string
}>()

const emit = defineEmits<{
  practice: [pattern: Pattern]
}>()
</script>

<template>
  <div class="pattern-section">
    <div class="pattern-section-title">{{ title }}</div>
    <div v-if="patterns.length === 0 && emptyText" class="pattern-empty">{{ emptyText }}</div>
    <div v-for="p in patterns" :key="p.kind + p.title" class="pattern-card" :class="p.kind">
      <div class="pattern-text">
        <div class="pattern-title">{{ p.title }}</div>
        <div class="pattern-detail">{{ p.detail }}</div>
        <div class="pattern-kana">
          <span v-for="k in p.kana.slice(0, 12)" :key="k" lang="ja">{{ k }}</span>
          <span v-if="p.kana.length > 12" class="more">+{{ p.kana.length - 12 }}</span>
        </div>
      </div>
      <button class="btn btn-sm pattern-practice-btn" @click="emit('practice', p)">Practice</button>
    </div>
  </div>
</template>
