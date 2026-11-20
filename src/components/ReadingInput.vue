<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import type { WordGroupEntry } from '../types'
import { useKanji } from '../composables/useKanji'
import { cleanTyped, hasKanji, previewParts } from '../learning/kanaInput'

// The typed reading of a word card (R2, KR20): the field keeps what was typed, the hiragana it
// turns into shows below it, and the hint when the card asks again. The parent mounts one per
// card (by key), runs `check` from its Check button and reads `canSend`.
const props = defineProps<{ gloss: string; group: WordGroupEntry | null }>()
const emit = defineEmits<{ table: [] }>()

const { typedAnswer, answered, correct, slipped, verdict, submitTyped, next } = useKanji()

// Letters that make no kana yet stay letters, shown apart. Rewriting the value of the field
// under the iOS keyboard breaks typing, so only the preview shows kana.
const preview = computed(() => previewParts(typedAnswer.value))
const canSend = computed(() => cleanTyped(typedAnswer.value) !== '' || hasKanji(typedAnswer.value))

// what the card says while it asks again, one hint at a time: the last verdict decides
const retryHint = computed(() => {
  const v = verdict.value
  if (answered.value || !v) return null
  return v.result === 'slip' || v.result === 'homograph' || v.result === 'kanji' ? v : null
})

// :value and @input instead of v-model: v-model ignores input while a Japanese keyboard
// composes, the preview and Check would stay dead until the composition ends
function onInput(e: Event): void {
  typedAnswer.value = (e.target as HTMLInputElement).value
}

const field = ref<HTMLInputElement | null>(null)
const focusField = () => nextTick(() => field.value?.focus())
onMounted(focusField)

// a slip, a homograph or kanji ask again, the cursor goes back into the field (Check took it away)
function check(): void {
  submitTyped()
  if (!answered.value) focusField()
}

function onEnter(e: KeyboardEvent): void {
  // the Enter that confirms a composition: Safari sends it with isComposing false but keyCode 229.
  // A held key must not run through the cards.
  if (e.isComposing || e.keyCode === 229 || e.repeat) return
  if (answered.value) next()
  else check()
}

defineExpose({ check, canSend })
</script>

<template>
  <div class="reading-input">
    <input
      ref="field"
      :value="typedAnswer"
      class="type-field reading-field"
      :class="{
        'input-correct': answered && correct,
        'input-wrong': answered && !correct,
        'input-retry': slipped && !answered,
      }"
      type="text"
      aria-label="Type the reading, in romaji or kana"
      autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
      enterkeyhint="go"
      placeholder="type romaji..."
      maxlength="40"
      :readonly="answered"
      @input="onInput"
      @keydown.enter="onEnter"
    />
    <div v-if="!answered" class="kana-preview" aria-hidden="true">
      <span v-for="(part, i) in preview" :key="i" :class="{ pending: part.pending }" :lang="part.pending ? undefined : 'ja'">{{ part.text }}</span>
    </div>
    <div v-if="retryHint" class="type-hint" role="status">
      <template v-if="retryHint.result === 'slip'">Looks like a typo. Fix it and check again.</template>
      <template v-else-if="retryHint.result === 'kanji'">Type the reading in hiragana or romaji, not in kanji.</template>
      <!-- a group word takes only the reading its table teaches -->
      <template v-else-if="props.group">
        <span class="kana" lang="ja">{{ retryHint.kana }}</span> is a way to read this spelling, but this card wants
        the reading of the table {{ props.group.title }}. Try again.
        <button class="btn btn-sm type-hint-btn" @click="emit('table')">Show the table</button>
      </template>
      <template v-else>
        <span class="kana" lang="ja">{{ retryHint.kana }}</span> is also a way to read this spelling, but for another word.
        This card wants the word for "{{ props.gloss }}", try again.
      </template>
    </div>
  </div>
</template>
