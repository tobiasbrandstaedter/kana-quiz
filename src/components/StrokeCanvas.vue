<script lang="ts">
// Once a pen touched any canvas, finger touches are a resting palm, not a stroke.
// Kept for the whole page so the next kana doesn't have to learn it again.
let penSeen = false
</script>

<script setup lang="ts">
import { ref, shallowRef, computed, onMounted } from 'vue'
import type { Point, StrokeFault, DrawResult } from '../types'
import { kanaStrokes } from '../data/strokeGlyphs'
import { checkStroke, SAMPLES } from '../learning/strokeMatch'
import type { StrokeCheck } from '../learning/strokeMatch'
import Icon from './Icon.vue'

// The parent re-creates this component per kana (via :key), so state never needs a reset.
const props = defineProps<{ kana: string; mode: 'trace' | 'recall' }>()
const emit = defineEmits<{ done: [result: DrawResult] }>()

// shorter than this (in KanjiVG units) is a tap or a twitch, not a stroke. Dakuten ticks are about 8.
const MIN_STROKE = 3

const layout = computed(() => kanaStrokes(props.kana) ?? { width: 109, strokes: [] })
const strokes = computed(() => layout.value.strokes)
const count = computed(() => strokes.value.length)

const svgEl = ref<SVGSVGElement | null>(null)
const refGroup = ref<SVGGElement | null>(null)
// reactive, so the first start dot shows up once the paths are measured
const refs = shallowRef<Point[][]>([])

const next = ref(0)
const ink = ref<Array<Point[] | null>>([])
const errors = ref<number[]>(strokes.value.map(() => 0))
const faults: Partial<Record<StrokeFault, number>> = {}
const hinted = new Set<number>()
const showHint = ref(false)
const live = ref<Point[] | null>(null)
let livePointer = -1
const rejected = ref<Point[] | null>(null)
const message = ref('')
const lastCheck = ref<StrokeCheck | null>(null)
const finished = computed(() => count.value > 0 && next.value >= count.value)
// only a stroke the user drew can be taken back, not one the app drew after three misses
const canUndo = computed(() => !finished.value && next.value > 0 && !!ink.value[next.value - 1])

// ?debug shows the matcher distances so thresholds can be tuned on a phone
const debug = new URLSearchParams(location.search).has('debug')

// getPointAtLength ignores the transform, so the glyph offset is added by hand
onMounted(() => {
  const els = refGroup.value ? [...refGroup.value.querySelectorAll('path')] : []
  refs.value = els.map((p, n) => {
    const len = p.getTotalLength()
    const dx = strokes.value[n].dx
    return Array.from({ length: SAMPLES }, (_, i) => {
      const pt = p.getPointAtLength((len * i) / (SAMPLES - 1))
      return { x: pt.x + dx, y: pt.y }
    })
  })
})

function toSvg(e: PointerEvent): Point {
  const ctm = svgEl.value!.getScreenCTM()!.inverse()
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm)
  return { x: p.x, y: p.y }
}

function onDown(e: PointerEvent): void {
  if (finished.value) return
  if (e.pointerType === 'pen') penSeen = true
  if (penSeen && e.pointerType === 'touch') return
  // a second finger while drawing is a hand resting on the screen
  if (live.value) return
  svgEl.value?.setPointerCapture(e.pointerId)
  livePointer = e.pointerId
  live.value = [toSvg(e)]
  rejected.value = null
}

function onMove(e: PointerEvent): void {
  if (!live.value || e.pointerId !== livePointer) return
  const p = toSvg(e)
  const last = live.value[live.value.length - 1]
  if (Math.hypot(p.x - last.x, p.y - last.y) > 0.8) live.value.push(p)
}

function onUp(e: PointerEvent): void {
  if (!live.value || e.pointerId !== livePointer) return
  const drawn = live.value
  live.value = null
  if (length(drawn) < MIN_STROKE) return
  judge(drawn)
}

// the system took the touch over (scroll, gesture), so there is nothing to judge
function onCancel(e: PointerEvent): void {
  if (e.pointerId === livePointer) live.value = null
}

function length(points: Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++)
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  return total
}

function judge(drawn: Point[]): void {
  const i = next.value
  const check = checkStroke(drawn, refs.value, i)
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
  if (correct) message.value = props.mode === 'trace' ? '✓ Traced' : '✓ Clean, every stroke right'
  emit('done', { correct, errors: [...errors.value], faults: { ...faults }, ink: [...ink.value] })
}

// takes back an accepted stroke for free, e.g. one that came out ugly
function undo(): void {
  if (!canUndo.value) return
  ink.value = ink.value.slice(0, next.value - 1)
  next.value--
  showHint.value = false
  message.value = ''
}

function revealHint(): void {
  hinted.add(next.value)
  showHint.value = true
}

function at(dx: number): string {
  return `translate(${dx} 0)`
}

function polyline(points: Point[]): string {
  return points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

const nextStart = computed(() => {
  if (finished.value || !(props.mode === 'trace' || showHint.value)) return null
  return refs.value[next.value]?.[0] ?? null
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
      ref="svgEl" class="stroke-svg draw-svg" :style="{ '--w': layout.width / 109 }" :viewBox="`0 0 ${layout.width} 109`"
      role="img" :aria-label="`Drawing area for ${kana}, stroke ${Math.min(next + 1, count)} of ${count}`"
      @pointerdown.prevent="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onCancel"
    >
      <g class="stroke-guide">
        <line x1="54.5" y1="2" x2="54.5" y2="107" />
        <line x1="2" y1="54.5" :x2="layout.width - 2" y2="54.5" />
      </g>
      <!-- reference strokes, also sampled by the matcher, hidden while recalling -->
      <g ref="refGroup" class="draw-ref" :class="{ hidden: mode === 'recall' && !finished, done: finished }">
        <path v-for="(s, i) in strokes" :key="i" :d="s.d" :transform="at(s.dx)" />
      </g>

      <template v-for="(stroke, i) in ink" :key="i">
        <polyline v-if="stroke" class="draw-ink" :points="polyline(stroke)" />
        <path v-else-if="i < next" class="draw-given" :d="strokes[i].d" :transform="at(strokes[i].dx)" />
      </template>

      <path
        v-if="showHint && !finished" :key="`hint${next}`" class="draw-hint"
        :d="strokes[next].d" :transform="at(strokes[next].dx)" pathLength="1"
      />
      <circle v-if="nextStart" class="draw-start" :cx="nextStart.x" :cy="nextStart.y" r="3" />

      <polyline v-if="rejected" class="draw-ink rejected" :points="polyline(rejected)" />
      <polyline v-if="live" class="draw-ink live" :points="polyline(live)" />
    </svg>

    <div class="draw-status" :class="{ good: finished && message.startsWith('✓') }" role="status" aria-live="polite">
      {{ message || (finished ? '' : `Stroke ${next + 1} of ${count}`) }}
    </div>
    <div v-if="!finished" class="draw-tools">
      <button class="stroke-ctl" :disabled="!canUndo" @click="undo()"><Icon name="undo" :size="18" />Undo</button>
      <!-- stays in place once the hint is up, so Undo doesn't jump -->
      <button v-if="mode === 'recall'" class="stroke-ctl" :disabled="showHint" @click="revealHint()">Show stroke {{ next + 1 }}</button>
    </div>
    <div v-if="debug" class="draw-debug">{{ debugText }}</div>
  </div>
</template>
