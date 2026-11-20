import { ref } from 'vue'
import { dayKey } from './learning/progress'

// answers per local day, only for the streak. Every stats store counts into it through
// countAnswer, so the one ref stays current. Tiny, so it is never trimmed.
export const DAYS_KEY = 'kana_days_v1'

function loadDays(): Record<string, number> {
  let raw: unknown = null
  try { raw = JSON.parse(localStorage.getItem(DAYS_KEY) ?? 'null') } catch {}
  return raw && typeof raw === 'object' ? raw as Record<string, number> : {}
}

export const days = ref<Record<string, number>>(loadDays())

export function countAnswer(now: number): void {
  const d = { ...loadDays() }
  d[dayKey(now)] = (d[dayKey(now)] ?? 0) + 1
  try { localStorage.setItem(DAYS_KEY, JSON.stringify(d)) } catch {}
  days.value = d
}

export function reloadDays(): void {
  days.value = loadDays()
}
