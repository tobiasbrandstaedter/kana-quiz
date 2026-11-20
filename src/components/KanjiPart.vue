<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount } from 'vue'
import type { Component } from 'vue'
import { loadKanji, kanjiScreen } from '../kanjiShell'

// One screen part of the kanji chunk, with a loading note on a slow line and a way to try
// again when the chunk can't be fetched. Lives in the entry chunk, it has to work without it.
const props = defineProps<{
  part: 'KanjiPractice' | 'KanjiWriting' | 'KanjiProgress' | 'KanjiQuiz' | 'KanjiResults' | 'KanjiSheet' | 'KanjiSources'
}>()

const comp = shallowRef<Component | null>(null)
const failed = ref(false)
const slow = ref(false)
let slowTimer: ReturnType<typeof setTimeout> | undefined

async function load(): Promise<void> {
  failed.value = false
  slow.value = false
  clearTimeout(slowTimer)
  // no note for a load that is done in a blink
  slowTimer = setTimeout(() => { slow.value = true }, 300)
  try {
    comp.value = (await loadKanji())[props.part]
  } catch {
    failed.value = true
  } finally {
    clearTimeout(slowTimer)
  }
}

function back(): void {
  kanjiScreen.value = 'setup'
}

onMounted(load)
onBeforeUnmount(() => clearTimeout(slowTimer))
</script>

<template>
  <component :is="comp" v-if="comp" />
  <div v-else-if="failed" class="kanji-load" role="alert">
    <span class="msg">Kanji could not be loaded. Check your connection and try again.</span>
    <div class="kanji-load-actions">
      <button class="btn btn-sm" @click="load()">Try again</button>
      <!-- the quiz and results screens have no script switch, this leads back to it -->
      <button v-if="part === 'KanjiQuiz' || part === 'KanjiResults'" class="btn btn-sm" @click="back()">Back</button>
    </div>
  </div>
  <div v-else-if="slow" class="kanji-load" role="status">
    <span class="msg">Loading kanji…</span>
  </div>
</template>
