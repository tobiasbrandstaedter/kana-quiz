<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Point, StrokeFault, DrawResult } from '../types'
import { STROKES } from '../data/strokes'
import { checkStroke, SAMPLES } from '../learning/strokeMatch'
import type { StrokeCheck } from '../learning/strokeMatch'

// The parent re-creates this component per kana (via :key), so state never needs a reset.
const props = defineProps<{ kana: string; mode: 'trace' | 'recall' }>()
const emit = defineEmits<{ done: [result: DrawResult] }>()

const paths = computed(() => STROKES[props.kana]?.paths ?? [])
const count = computed(() => paths.value.length)

const svgEl = ref<SVGSVGElement | null>(null)
const refGroup = ref<SVGGElement | null>(null)
let refs: Point[][] = []

const next = ref(0)
const ink = ref<Array<Point[] | null>>([])
const errors = ref<number[]>(paths.value.map(() => 0))
const faults: Partial<Record<StrokeFault, number>> = {}
const hinted = new Set<number>()
const showHint = ref(false)
const live = ref<Point[] | null>(null)
const rejected = ref<Point[] | null>(null)
const message = ref('')
const lastCheck = ref<StrokeCheck | null>(null)
const finished = computed(() => count.value > 0 && next.value >= count.value)

// ?debug shows the matcher distances so thresholds can be tuned on a phone
const debug = new URLSearchParams(location.search).has('debug')

const sampled = new Map<string, Point[][]>()

onMounted(() => {
  const cached = sampled.get(props.kana)
  if (cached) { refs = cached; return }
  const els = refGroup.value ? [...refGroup.value.querySelectorAll('path')] : []
  refs = els.map(p => {
    const len = p.getTotalLength()
    return Array.from({ length: SAMPLES }, (_, i) => {
      const pt = p.getPointAtLength((len * i) / (SAMPLES - 1))
      return { x: pt.x, y: pt.y }
    })
  })
  sampled.set(props.kana, refs)
})

function toSvg(e: PointerEvent): Point {
  const ctm = svgEl.value!.getScreenCTM()!.inverse()
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm)
  return { x: p.x, y: p.y }
}

function onDown(e: PointerEvent): void {
  if (finished.value) return
  svgEl.value?.setPointerCapture(e.pointerId)
  live.value = [toSvg(e)]
  rejected.value = null
}

function onMove(e: PointerEvent): void {
  if (!live.value) return
  const p = toSvg(e)
  const last = live.value[live.value.length - 1]
  if (Math.hypot(p.x - last.x, p.y - last.y) > 0.8) live.value.push(p)
}

function onUp(): void {
  if (!live.value) return
  const drawn = live.value
  live.value = null
  judge(drawn)
}

function judge(drawn: Point[]): void {
  const i = next.value
  const check = checkStroke(drawn, refs, i)
  lastCheck.value = check
  if (check.ok) {
    ink.value[i] = drawn
    message.value = ''
    advance()
    return
  }

  errors.value[i]++
  const fault = check.fault ?? 'shape'
  faults[fault] = (faults[fault] ?? 0) + 1
  rejected.value = drawn
  setTimeout(() => { if (rejected.value === drawn) rejected.value = null }, 500)

  if (errors.value[i] >= 3) {
    // three misses: draw it for them and move on
    hinted.add(i)
    ink.value[i] = null
    message.value = `This is stroke ${i + 1}`
    advance()
    return
  }
  if (errors.value[i] >= 2) {
    hinted.add(i)
    showHint.value = true
  }
  message.value =
    fault === 'direction' ? 'Right stroke, wrong direction' :
    fault === 'order' ? `That is stroke ${check.matched! + 1}, draw stroke ${i + 1} first` :
    `Not quite, try stroke ${i + 1} again`
}

function advance(): void {
  next.value++
  showHint.value = false
  if (!finished.value) return
  const correct = hinted.size === 0 && !faults.order && !faults.direction
  emit('done', { correct, errors: [...errors.value], faults: { ...faults }, ink: [...ink.value] })
}

function revealHint(): void {
  hinted.add(next.value)
  showHint.value = true
}

function polyline(points: Point[]): string {
  return points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

const nextStart = computed(() => {
  if (finished.value || !(props.mode === 'trace' || showHint.value)) return null
  return refs[next.value]?.[0] ?? null
})

const debugText = computed(() => {
  const c = lastCheck.value
  if (!c) return ''
  const m = c.metrics
  return `${c.ok ? 'ok' : c.fault} · start ${m.start.toFixed(1)} · end ${m.end.toFixed(1)} · mean ${m.mean.toFixed(1)} · len ${m.ratio.toFixed(2)}`
})
</script>

<template>
  <div class="stroke-canvas">
    <svg
      ref="svgEl" class="stroke-svg draw-svg" viewBox="0 0 109 109"
      role="img" :aria-label="`Drawing area for ${kana}, stroke ${Math.min(next + 1, count)} of ${count}`"
      @pointerdown.prevent="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp"
    >
      <g class="stroke-guide">
        <line x1="54.5" y1="2" x2="54.5" y2="107" />
        <line x1="2" y1="54.5" x2="107" y2="54.5" />
      </g>
      <!-- reference strokes, also sampled by the matcher, hidden while recalling -->
      <g ref="refGroup" class="draw-ref" :class="{ hidden: mode === 'recall' && !finished }">
        <path v-for="(d, i) in paths" :key="i" :d="d" />
      </g>

      <template v-for="(stroke, i) in ink" :key="i">
        <polyline v-if="stroke" class="draw-ink" :points="polyline(stroke)" />
        <path v-else-if="i < next" class="draw-given" :d="paths[i]" />
      </template>

      <path v-if="showHint && !finished" :key="`hint${next}`" class="draw-hint" :d="paths[next]" pathLength="1" />
      <circle v-if="nextStart" class="draw-start" :cx="nextStart.x" :cy="nextStart.y" r="3" />

      <polyline v-if="rejected" class="draw-ink rejected" :points="polyline(rejected)" />
      <polyline v-if="live" class="draw-ink live" :points="polyline(live)" />
    </svg>

    <div class="draw-status" role="status" aria-live="polite">
      {{ message || (finished ? '' : `Stroke ${next + 1} of ${count}`) }}
    </div>
    <button v-if="mode === 'recall' && !finished && !showHint" class="stroke-ctl" @click="revealHint()">SHOW STROKE {{ next + 1 }}</button>
    <div v-if="debug" class="draw-debug">{{ debugText }}</div>
  </div>
</template>
