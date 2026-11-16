<script setup lang="ts">
import { inject, ref } from 'vue'
import { QUIZ_KEY } from '../composables/useQuiz'
import BottomSheet from './BottomSheet.vue'

const emit = defineEmits<{ close: [] }>()
const { kanaFont, setKanaFont, resetAll, statsTabCount } = inject(QUIZ_KEY)!

const FONTS = [
  { family: 'Zen Maru Gothic',   label: 'Maru' },
  { family: 'Noto Sans JP',      label: 'Sans' },
  { family: 'Noto Serif JP',     label: 'Serif' },
  { family: 'M PLUS Rounded 1c', label: 'Round' },
  { family: 'Kosugi Maru',       label: 'Soft' },
  { family: 'BIZ UDGothic',      label: 'Gothic' },
]

// two taps on purpose: this wipes everything and can't be undone
const confirming = ref(false)

function reset(): void {
  resetAll()
  confirming.value = false
  emit('close')
}
</script>

<template>
  <BottomSheet title="Settings" @close="emit('close')">
    <div class="option-title">Kana font</div>
    <div class="font-switcher">
      <button
        v-for="f in FONTS" :key="f.family"
        class="font-btn" :class="{ active: kanaFont === f.family }"
        :aria-pressed="kanaFont === f.family"
        @click="setKanaFont(f.family)"
      >
        <span class="fb-kana" :style="{ fontFamily: `'${f.family}', sans-serif` }">あ</span>
        <span class="fb-label">{{ f.label }}</span>
      </button>
    </div>

    <div class="option-title">Progress</div>
    <div class="danger-zone">
      <p>Deletes every answer, all review schedules and the streak. This can't be undone.</p>
      <button v-if="!confirming" class="btn btn-sm" :disabled="statsTabCount === 0" @click="confirming = true">Reset all progress</button>
      <div v-else class="danger-confirm">
        <button class="btn btn-sm btn-bad" @click="reset()">Yes, delete {{ statsTabCount }} kana</button>
        <button class="btn btn-sm" @click="confirming = false">Keep it</button>
      </div>
    </div>
  </BottomSheet>
</template>
