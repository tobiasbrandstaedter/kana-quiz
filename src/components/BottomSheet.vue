<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'

// parents mount this with v-if, so opening and closing is just that
defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
// what had the focus before the sheet opened, it gets it back on close
let opener: Element | null = null

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') { emit('close'); return }
  if (e.key !== 'Tab' || !panel.value) return
  // Tab stays inside the sheet, the page behind is covered and not meant to be reached
  const stops = [...panel.value.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, [tabindex="0"]')]
  if (stops.length === 0) return
  const first = stops[0]
  const last = stops[stops.length - 1]
  const at = document.activeElement
  if (e.shiftKey && (at === first || at === panel.value)) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && (at === last || !panel.value.contains(at))) { e.preventDefault(); first.focus() }
}

onMounted(() => {
  opener = document.activeElement
  window.addEventListener('keydown', onKey)
  panel.value?.focus()
  // the page behind must not scroll along on iOS
  document.body.classList.add('sheet-open')
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.classList.remove('sheet-open')
  if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="sheet-backdrop" @click.self="emit('close')">
      <div ref="panel" class="sheet" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
        <div class="sheet-head">
          <div class="sheet-title"><slot name="title">{{ title }}</slot></div>
          <button class="icon-btn boxed" aria-label="Close" @click="emit('close')"><Icon name="x" :size="20" /></button>
        </div>
        <div class="sheet-body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
