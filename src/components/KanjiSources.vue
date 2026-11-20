<script setup lang="ts">
import { KANJI_DATA_DATE, KANJI_SOURCES } from '../data/kanjiData'
</script>

<template>
  <div class="sources">
    <p class="hint-line sources-note">
      Meanings, readings, words and stroke order of the kanji part come from these projects. Data as of {{ KANJI_DATA_DATE }}.
    </p>
    <div v-for="s in KANJI_SOURCES" :key="s.name" class="source-row">
      <a class="source-name" :href="s.url" target="_blank" rel="noopener">{{ s.name }}</a>
      <span class="source-line">Version {{ s.version }}</span>
      <span class="source-line">Licence <a :href="s.licenceUrl" target="_blank" rel="noopener">{{ s.licence }}</a></span>
    </div>
  </div>
</template>
