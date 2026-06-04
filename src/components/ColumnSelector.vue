<script setup lang="ts">
import type { KanaData, ScriptName } from '../types'
import { GROUP_NAMES } from '../data/kana'

defineProps<{
  selectorScripts: Array<[ScriptName, KanaData]>
  selectedCols: Set<string>
  errorKanaSet: Set<string>
}>()

const emit = defineEmits<{
  toggle: [id: string]
  selectAll: []
  selectNone: []
  selectGroup: [group: string]
}>()
</script>

<template>
  <div class="selector-panel">
    <div class="quick-row">
      <button class="quick-btn" @click="emit('selectAll')">ALL</button>
      <button class="quick-btn" @click="emit('selectNone')">CLEAR</button>
      <button class="quick-btn" @click="emit('selectGroup', 'main')">MAIN</button>
      <button class="quick-btn" @click="emit('selectGroup', 'dakuten')">DAKUTEN</button>
      <button class="quick-btn" @click="emit('selectGroup', 'combo')">COMBOS</button>
    </div>

    <template v-for="([scriptName, columns], si) in selectorScripts" :key="scriptName">
      <div v-if="selectorScripts.length > 1" class="group-title" :style="{ marginTop: si === 0 ? '0' : '20px' }">
        {{ scriptName === 'hiragana' ? 'Hiragana (ひらがな)' : 'Katakana (カタカナ)' }}
      </div>

      <template v-for="([group, cols], gi) in Object.entries(columns)" :key="group">
        <div class="group-title" :style="{ marginTop: selectorScripts.length > 1 && gi === 0 ? '8px' : '' }">
          {{ GROUP_NAMES[group] }}
        </div>
        <div class="column-grid" style="margin-bottom:4px">
          <button
            v-for="col in cols" :key="col.id"
            class="col-btn"
            :class="{
              active: selectedCols.has(col.id),
              'has-errors': col.kana.some(k => errorKanaSet.has(k)),
            }"
            @click="emit('toggle', col.id)"
          >
            <span class="kana-sample">{{ col.sample }}</span>
            <span class="romaji-label">{{ col.label }}</span>
            <span class="error-dot"></span>
          </button>
        </div>
      </template>
    </template>
  </div>
</template>
