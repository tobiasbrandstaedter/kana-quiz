import type { StatsMap } from '../types'

// local date, so a session at 00:30 counts for the day the user thinks it is
export function dayKey(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Days in a row with at least one answer, up to today. A streak isn't broken
 * until a whole day was missed, so before the first answer today it still
 * counts the days up to yesterday.
 */
export function streak(days: Record<string, number>, now: number): number {
  // steps by calendar day from noon: 24 h steps skip or repeat a day around a clock change
  const d = new Date(now)
  d.setHours(12, 0, 0, 0)
  if (!days[dayKey(d.getTime())]) d.setDate(d.getDate() - 1)
  let n = 0
  while (days[dayKey(d.getTime())]) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export interface FluencyLimits { type: number; choice: number }

export const DEFAULT_LIMITS: FluencyLimits = { type: 3500, choice: 3000 }

/**
 * Time limits for timed mode from the user's own pace: half again their
 * median answer time, plus a bit for typing. Fixed defaults until there is
 * enough data.
 */
export function fluencyLimits(stats: StatsMap): FluencyLimits {
  const avgs = Object.values(stats)
    .filter(e => e.count >= 3)
    .map(e => e.totalMs / e.count)
    .sort((a, b) => a - b)
  if (avgs.length < 5) return DEFAULT_LIMITS
  const base = avgs[Math.floor(avgs.length / 2)] * 1.5
  const clamp = (x: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, x)))
  return { choice: clamp(base, 1800, 6000), type: clamp(base + 500, 2300, 7000) }
}
