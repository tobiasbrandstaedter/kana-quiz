import { describe, it, expect } from 'vitest'
import { resample, checkStroke, polylineLength, SAMPLES } from './strokeMatch'
import type { Point } from '../types'

const line = (x1: number, y1: number, x2: number, y2: number): Point[] => [{ x: x1, y: y1 }, { x: x2, y: y2 }]

// a made up three stroke kana: top bar, vertical, small dot
const refs = [
  line(20, 30, 90, 30),
  line(55, 15, 55, 95),
  line(80, 60, 84, 66),
].map(s => resample(s))

describe('resample', () => {
  it('spreads points evenly and keeps the ends', () => {
    const pts = resample([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 5)
    expect(pts).toHaveLength(5)
    expect(pts[0]).toEqual({ x: 0, y: 0 })
    expect(pts[4]).toEqual({ x: 10, y: 10 })
    expect(pts[2].x).toBeCloseTo(10)
    expect(pts[2].y).toBeCloseTo(0)
    expect(polylineLength(pts)).toBeCloseTo(20)
  })

  it('turns a tap into n copies of the point', () => {
    expect(resample([{ x: 3, y: 4 }], 4)).toEqual(Array(4).fill({ x: 3, y: 4 }))
  })

  it('defaults to SAMPLES points', () => {
    expect(resample(line(0, 0, 1, 1))).toHaveLength(SAMPLES)
  })
})

describe('checkStroke', () => {
  it('accepts the expected stroke, even a bit off', () => {
    expect(checkStroke(line(20, 30, 90, 30), refs, 0).ok).toBe(true)
    const wobbly = [{ x: 24, y: 36 }, { x: 50, y: 26 }, { x: 70, y: 34 }, { x: 86, y: 28 }]
    expect(checkStroke(wobbly, refs, 0).ok).toBe(true)
  })

  it('reports a stroke drawn backwards', () => {
    const r = checkStroke(line(90, 30, 20, 30), refs, 0)
    expect(r.ok).toBe(false)
    expect(r.fault).toBe('direction')
  })

  it('reports a later stroke drawn too early', () => {
    const r = checkStroke(line(55, 15, 55, 95), refs, 0)
    expect(r.fault).toBe('order')
    expect(r.matched).toBe(1)
  })

  it('reports a shape that matches nothing', () => {
    expect(checkStroke(line(10, 100, 100, 10), refs, 0).fault).toBe('shape')
  })

  it('rejects a stroke at the right spot but far too short', () => {
    expect(checkStroke(line(20, 30, 35, 30), refs, 0).fault).toBe('shape')
  })

  it('does not care about direction or length on a dot', () => {
    expect(checkStroke(line(84, 66, 80, 60), refs, 2).ok).toBe(true)
    expect(checkStroke([{ x: 82, y: 63 }], refs, 2).ok).toBe(true)
  })

  it('only looks forward for order mistakes', () => {
    // stroke 0 is done, drawing it again while 1 is expected is just wrong
    expect(checkStroke(line(20, 30, 90, 30), refs, 1).fault).toBe('shape')
  })
})
