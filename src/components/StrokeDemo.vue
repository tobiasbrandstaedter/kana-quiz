<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { kanaStrokes } from '../data/strokeGlyphs'

const props = defineProps<{ kana: string; controls?: boolean }>()

const layout = computed(() => kanaStrokes(props.kana))
const strokes = computed(() => layout.value?.strokes ?? [])
const strokeCount = computed(() => strokes.value.length)

const ghostEl = ref<SVGGElement | null>(null)
const timings = ref<Array<{ delay: number; duration: number }>>([])
const run = ref(0)                     // bumped to restart the css animation
const step = ref<number | null>(null)  // stroke by stroke view, null while animating

const PAUSE_MS = 250

// duration follows the stroke length so a dot doesn't take as long as the long curve of あ
function measure(): void {
  const paths = ghostEl.value ? [...ghostEl.value.querySelectorAll('path')] : []
  let t = 300
  timings.value = paths.map(p => {
    const duration = 200 + p.getTotalLength() * 5
    const timing = { delay: t, duration }
    t += duration + PAUSE_MS
    return timing
  })
}

function replay(): void {
  step.value = null
  run.value++
}

function stepBy(delta: number): void {
  const current = step.value ?? 0
  step.value = Math.min(strokeCount.value, Math.max(1, current + delta))
}

function at(dx: number): string {
  return `translate(${dx} 0)`
}

watch(() => props.kana, async () => {
  timings.value = []
  step.value = null
  await nextTick()
  measure()
  run.value++
})

onMounted(measure)

defineExpose({ replay })
</script>

<template>
  <div v-if="layout" class="stroke-demo">
    <svg
      class="stroke-svg" :style="{ '--w': layout.width / 109 }" :viewBox="`0 0 ${layout.width} 109`"
      role="img" :aria-label="`Stroke order of ${kana}, ${strokeCount} strokes`"
      @click="replay()"
    >
      <g class="stroke-guide">
        <line x1="54.5" y1="2" x2="54.5" y2="107" />
        <line x1="2" :y1="54.5" :x2="layout.width - 2" y2="54.5" />
      </g>
      <g ref="ghostEl" class="stroke-ghost">
        <path v-for="(s, i) in strokes" :key="i" :d="s.d" :transform="at(s.dx)" />
      </g>

      <g v-if="step === null && timings.length === strokeCount" :key="run" class="stroke-anim">
        <path
          v-for="(s, i) in strokes" :key="i" :d="s.d" :transform="at(s.dx)" pathLength="1"
          :style="{ animationDelay: `${timings[i].delay}ms`, animationDuration: `${timings[i].duration}ms` }"
        />
        <text
          v-for="(s, i) in strokes" :key="`n${i}`" :x="s.number[0] + s.dx" :y="s.number[1]"
          :style="{ animationDelay: `${timings[i].delay}ms` }"
        >{{ i + 1 }}</text>
      </g>

      <g v-else-if="step !== null" class="stroke-steps">
        <path
          v-for="(s, i) in strokes.slice(0, step)" :key="i" :d="s.d" :transform="at(s.dx)"
          :class="{ current: i === step - 1 }"
        />
        <text
          v-for="(s, i) in strokes.slice(0, step)" :key="`n${i}`" :x="s.number[0] + s.dx" :y="s.number[1]"
          :class="{ current: i === step - 1 }"
        >{{ i + 1 }}</text>
      </g>
    </svg>

    <div v-if="controls" class="stroke-controls">
      <button class="stroke-ctl" :disabled="step === null || step <= 1" aria-label="Previous stroke" @click="stepBy(-1)">◀</button>
      <button class="stroke-ctl replay" @click="replay()">↻ REPLAY</button>
      <button class="stroke-ctl" :disabled="step === strokeCount" aria-label="Next stroke" @click="stepBy(1)">▶</button>
    </div>
    <div v-if="controls" class="stroke-count">
      {{ step === null ? `${strokeCount} stroke${strokeCount === 1 ? '' : 's'}` : `Stroke ${step} of ${strokeCount}` }}
    </div>
  </div>
</template>
