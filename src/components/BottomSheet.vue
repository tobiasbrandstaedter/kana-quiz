<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'

// parents mount this with v-if, so opening and closing is just that
defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  panel.value?.focus()
  // the page behind must not scroll along on iOS
  document.body.classList.add('sheet-open')
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.classList.remove('sheet-open')
})
</script>

<template>
  <Teleport to="body">
    <div class="sheet-backdrop" @click.self="emit('close')">
      <div ref="panel" class="sheet" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
        <div class="sheet-grabber" aria-hidden="true"></div>
        <div class="sheet-head">
          <div class="sheet-title">{{ title }}</div>
          <button class="icon-btn boxed" aria-label="Close" @click="emit('close')"><Icon name="x" :size="20" /></button>
        </div>
        <div class="sheet-body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
