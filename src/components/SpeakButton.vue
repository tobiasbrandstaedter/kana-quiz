<script setup lang="ts">
import { canSpeak, speakReading } from '../audio'
import Icon from './Icon.vue'

// speaks a word on tap, wherever the browser has speechSynthesis (KD13, KR36)
defineProps<{ reading: string }>()
</script>

<template>
  <button v-if="canSpeak" class="icon-btn boxed butter speak-btn" aria-label="Say the word" @click="speakReading(reading)">
    <Icon name="speaker" :size="20" />
  </button>
</template>
