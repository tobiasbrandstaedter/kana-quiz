import type { Point, StrokeFault } from '../types'

// Compares one drawn stroke against the reference strokes of a kana.
// Everything is in KanjiVG units (viewBox 0 0 109 109). The thresholds are
// generous on purpose: this checks order, direction and rough shape, not handwriting.

export const SAMPLES = 24

const MAX_END_DIST = 22    // start and end point
const MAX_MEAN_DIST = 16   // average over all resampled points
const MIN_LEN_RATIO = 0.5
const MAX_LEN_RATIO = 3    // shaky short strokes easily come out twice as long, the mean distance still catches real detours
const SHORT_STROKE = 15    // dots and dakuten ticks, direction is hard to see there

export interface StrokeMetrics {
  start: number
  end: number
  mean: number
  ratio: number  // drawn length / reference length
}

export interface StrokeCheck {
  ok: boolean
  fault?: StrokeFault
  matched?: number   // for 'order': the stroke that was drawn instead
  metrics: StrokeMetrics
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function polylineLength(points: Point[]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) len += dist(points[i - 1], points[i])
  return len
}

/** n points spread evenly along the polyline. */
export function resample(points: Point[], n: number = SAMPLES): Point[] {
  if (points.length === 0) return []
  const total = polylineLength(points)
  if (total === 0) return Array.from({ length: n }, () => ({ ...points[0] }))

  const step = total / (n - 1)
  const out: Point[] = [{ ...points[0] }]
  let walked = 0  // distance covered up to points[i - 1]
  let i = 1
  for (let k = 1; k < n - 1; k++) {
    const target = k * step
    while (i < points.length - 1 && walked + dist(points[i - 1], points[i]) < target) {
      walked += dist(points[i - 1], points[i])
      i++
    }
    const seg = dist(points[i - 1], points[i])
    const t = seg > 0 ? (target - walked) / seg : 0
    out.push({
      x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
      y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
    })
  }
  out.push({ ...points[points.length - 1] })
  return out
}

// both sides must already be resampled to the same count
export function compare(drawn: Point[], ref: Point[]): StrokeMetrics {
  let sum = 0
  for (let i = 0; i < ref.length; i++) sum += dist(drawn[i], ref[i])
  const refLen = polylineLength(ref)
  return {
    start: dist(drawn[0], ref[0]),
    end: dist(drawn[drawn.length - 1], ref[ref.length - 1]),
    mean: sum / ref.length,
    ratio: refLen > 0 ? polylineLength(drawn) / refLen : 1,
  }
}

function fits(m: StrokeMetrics, short: boolean): boolean {
  // a dot can be drawn much shorter or longer than the reference without being wrong
  const lengthOk = short || (m.ratio >= MIN_LEN_RATIO && m.ratio <= MAX_LEN_RATIO)
  return m.start <= MAX_END_DIST && m.end <= MAX_END_DIST && m.mean <= MAX_MEAN_DIST && lengthOk
}

/**
 * Checks a drawn stroke against refs[expected]. Strokes before `expected` are done.
 * If it doesn't fit, a later stroke that fits means the order was wrong,
 * and a fit in reverse means the stroke was drawn backwards.
 */
export function checkStroke(drawn: Point[], refs: Point[][], expected: number): StrokeCheck {
  const fwd = resample(drawn, SAMPLES)
  const back = [...fwd].reverse()
  const ref = refs[expected]
  const short = polylineLength(ref) < SHORT_STROKE

  const metrics = compare(fwd, ref)
  if (fits(metrics, short)) return { ok: true, metrics }

  const reversed = compare(back, ref)
  if (fits(reversed, short)) return short ? { ok: true, metrics: reversed } : { ok: false, fault: 'direction', metrics }

  for (let j = expected + 1; j < refs.length; j++) {
    const s = polylineLength(refs[j]) < SHORT_STROKE
    if (fits(compare(fwd, refs[j]), s) || fits(compare(back, refs[j]), s))
      return { ok: false, fault: 'order', matched: j, metrics }
  }
  return { ok: false, fault: 'shape', metrics }
}
