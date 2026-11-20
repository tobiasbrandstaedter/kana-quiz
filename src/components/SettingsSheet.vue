<script setup lang="ts">
import { inject, ref, onMounted } from 'vue'
import { QUIZ_KEY } from '../composables/useQuiz'
import { KANA_FONTS, loadKanaFont } from '../fonts'
import { THEMES } from '../theme'
import { buildBackup, parseBackup, kanaInBackup, kanjiInBackup, restoreBackup } from '../backup'
import type { Backup } from '../backup'
import { dayKey } from '../learning/progress'
import BottomSheet from './BottomSheet.vue'

const emit = defineEmits<{ close: [] }>()
const { kanaFont, setKanaFont, theme, setTheme, resetAll, kanaTracked } = inject(QUIZ_KEY)!

// the picker shows each font, so now is the time to fetch them
onMounted(() => KANA_FONTS.forEach(f => loadKanaFont(f.family)))

// a site in the browser can lose its storage, an installed app keeps it
const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

function exportBackup(): void {
  const backup = buildBackup(key => localStorage.getItem(key), Date.now())
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `kana-quiz-backup-${dayKey(Date.now())}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// a picked file waits here until the learner confirms that it replaces everything
const pending = ref<Backup | null>(null)
const importError = ref('')

async function onFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''  // so picking the same file again fires a change
  if (!file) return
  pending.value = null
  importError.value = ''
  try {
    pending.value = parseBackup(await file.text())
  } catch (err) {
    importError.value = (err as Error).message
  }
}

function importBackup(): void {
  if (!pending.value) return
  restoreBackup(pending.value, localStorage)
  // every composable reads its state at start, a reload is the one sure way to pick it all up
  location.reload()
}

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
    <div class="option-title">Theme</div>
    <div class="theme-switcher">
      <button
        v-for="t in THEMES" :key="t.id"
        class="theme-btn" :class="{ active: theme === t.id }"
        :aria-pressed="theme === t.id"
        @click="setTheme(t.id)"
      >
        <!-- the colors of the other themes can't come from tokens, those belong to the one on screen -->
        <span class="theme-swatch" :style="{ background: t.swatch[0] }" aria-hidden="true">
          <span :style="{ background: t.swatch[1] }"></span>
          <span :style="{ background: t.swatch[2] }"></span>
        </span>
        <span class="theme-text">
          <span class="theme-name">{{ t.label }}</span>
          <span class="theme-hint">{{ t.hint }}</span>
        </span>
      </button>
    </div>
    <p class="hint-line theme-note">A theme also picks its kana font, you can change that below.</p>

    <div class="option-title">Kana font</div>
    <div class="font-switcher">
      <button
        v-for="f in KANA_FONTS" :key="f.family"
        class="font-btn" :class="{ active: kanaFont === f.family }"
        :aria-pressed="kanaFont === f.family"
        @click="setKanaFont(f.family)"
      >
        <span class="fb-kana" lang="ja" :style="{ fontFamily: `'${f.family}', sans-serif` }">あ</span>
        <span class="fb-label">{{ f.label }}</span>
      </button>
    </div>

    <div class="option-title">Backup</div>
    <div class="option-block">
      <p class="hint-line backup-note">
        Your progress only lives in this browser.
        <template v-if="!installed">Add the app to your home screen so the browser keeps it, and export a backup now and then.</template>
        <template v-else>Export a backup now and then, it also moves your progress to another device.</template>
      </p>
      <div class="backup-row">
        <button class="btn btn-sm" :disabled="kanaTracked === 0" @click="exportBackup()">Export backup</button>
        <label class="btn btn-sm">
          Import backup
          <input class="file-input" type="file" accept="application/json,.json" @change="onFile">
        </label>
      </div>
      <p v-if="importError" class="hint-line backup-error" role="alert">{{ importError }}</p>
      <div v-if="pending" class="danger-zone">
        <p>
          Replace everything on this device with the backup
          <template v-if="pending.savedAt">from {{ new Date(pending.savedAt).toLocaleDateString() }}</template>
          ({{ kanaInBackup(pending) }} kana<template v-if="kanjiInBackup(pending)">, {{ kanjiInBackup(pending) }} kanji</template>)? What is here now is lost.
        </p>
        <div class="danger-confirm">
          <button class="btn btn-sm btn-bad" @click="importBackup()">Yes, replace</button>
          <button class="btn btn-sm" @click="pending = null">Keep mine</button>
        </div>
      </div>
    </div>

    <div class="option-title">Progress</div>
    <div class="danger-zone">
      <p>Deletes every answer, all review schedules and the streak. This can't be undone.</p>
      <button v-if="!confirming" class="btn btn-sm" :disabled="kanaTracked === 0" @click="confirming = true">Reset all progress</button>
      <div v-else class="danger-confirm">
        <button class="btn btn-sm btn-bad" @click="reset()">Yes, delete {{ kanaTracked }} kana</button>
        <button class="btn btn-sm" @click="confirming = false">Keep it</button>
      </div>
    </div>
  </BottomSheet>
</template>
