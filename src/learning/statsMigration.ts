import type { KanaPair, StatEntry, StatsMap } from '../types'
import { allPairs } from '../data/kana'

let romajiByKana: Map<string, string> | null = null

function currentRomaji(kana: string): string | undefined {
  if (!romajiByKana) romajiByKana = new Map(allPairs().map(p => [p.kana, p.romaji]))
  return romajiByKana.get(kana)
}

export function newEntry(pair: KanaPair): StatEntry {
  return {
    ...pair, correct: 0, incorrect: 0, totalMs: 0, count: 0,
    lastSeen: 0, lastWrong: 0, resolvedAt: 0, streak: 0, confusions: {}, byDirection: {}, box: 0, due: 0,
    strokeErrors: [], strokeFaults: {},
  }
}

// Entries from before the scheduler get a starting box from their track record.
// They are all due at once, so the first smart session works as a placement check.
function startingBox(correct: number, incorrect: number): number {
  const seen = correct + incorrect
  const acc = seen > 0 ? correct / seen : 0
  if (seen >= 5 && acc >= 0.9) return 2
  if (seen >= 3 && acc >= 0.75) return 1
  return 0
}

/**
 * Fill in fields older entries don't have and refresh the romaji from the
 * kana table (v2 stored 'di'/'du' for ぢ/づ). Garbage entries are dropped.
 */
export function normalizeStats(raw: unknown): StatsMap {
  if (!raw || typeof raw !== 'object') return {}
  const out: StatsMap = {}
  for (const [kana, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const e = value as Partial<StatEntry>
    if (typeof e.kana !== 'string' || typeof e.romaji !== 'string') continue
    const correct = e.correct ?? 0
    const incorrect = e.incorrect ?? 0
    out[kana] = {
      kana: e.kana,
      romaji: currentRomaji(e.kana) ?? e.romaji,
      script: e.script === 'katakana' ? 'katakana' : 'hiragana',
      correct,
      incorrect,
      totalMs: e.totalMs ?? 0,
      count: e.count ?? 0,
      lastSeen: e.lastSeen ?? 0,
      lastWrong: e.lastWrong ?? 0,
      resolvedAt: e.resolvedAt ?? 0,
      streak: e.streak ?? 0,
      confusions: e.confusions ?? {},
      byDirection: e.byDirection ?? {},
      box: e.box ?? startingBox(correct, incorrect),
      due: e.due ?? 0,
      strokeErrors: e.strokeErrors ?? [],
      strokeFaults: e.strokeFaults ?? {},
    }
  }
  return out
}
