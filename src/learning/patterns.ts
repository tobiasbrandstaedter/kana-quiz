import type { AnswerRecord, DirectionStat, KanaPair, QuizMode, ScriptName, StatEntry, StatsMap, StrokeFault } from '../types'
import { kanaInfo, pairFor, kanaForRomaji } from '../data/kana'
import { lookalikesOf, lookalikeHint } from '../data/lookalikes'
import { newEntry } from './statsMigration'

export type PatternKind =
  | 'confusion' | 'row' | 'vowel' | 'marks' | 'script-gap' | 'direction-gap' | 'slow' | 'slipping' | 'blind-spot'
  | 'stroke' | 'stroke-habit'

export interface Pattern {
  kind: PatternKind
  title: string
  detail: string
  kana: string[]
  severity: number
  practice: KanaPair[]
  mode?: QuizMode  // override the user's mode when one direction targets the problem better
  timed?: boolean  // practice against the clock
}

// 'round' looks at one session, 'all' at everything, so the bars differ
export type PatternScope = 'round' | 'all'

const THRESHOLDS = {
  round: { confusions: 1, clusterSeen: 3, clusterErrors: 2, scriptSeen: 3,  dirSeen: 2 },
  all:   { confusions: 2, clusterSeen: 5, clusterErrors: 3, scriptSeen: 10, dirSeen: 3 },
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MAX_PATTERNS = 6

function seen(e: StatEntry): number { return e.correct + e.incorrect }
function acc(e: { correct: number; incorrect: number }): number {
  const n = e.correct + e.incorrect
  return n > 0 ? e.correct / n : 0
}
function pct(x: number): string { return `${Math.round(x * 100)}%` }
function uniq(kana: string[]): string[] { return [...new Set(kana)] }
function pairs(kana: string[]): KanaPair[] {
  return uniq(kana).map(pairFor).filter((p): p is KanaPair => !!p)
}

/** Build a StatsMap from a slice of the answer log, e.g. one session. */
export function statsFromLog(records: AnswerRecord[]): StatsMap {
  const out: StatsMap = {}
  for (const r of records) {
    const pair = pairFor(r.kana)
    if (!pair) continue
    const e = out[r.kana] ?? (out[r.kana] = newEntry(pair))
    const dir = e.byDirection[r.direction] ?? (e.byDirection[r.direction] = { correct: 0, incorrect: 0 })
    e.lastSeen = Math.max(e.lastSeen, r.t)
    if (r.correct) { e.correct++; dir.correct++; e.streak++ }
    else {
      e.incorrect++; dir.incorrect++; e.streak = 0
      e.lastWrong = Math.max(e.lastWrong, r.t)
      if (r.given) e.confusions[r.given] = (e.confusions[r.given] ?? 0) + 1
    }
    if (r.direction !== 'draw' && r.ms > 0 && r.ms < 30_000) { e.totalMs += r.ms; e.count++ }
  }
  return out
}

// the given answer is a kana (choice) or a romaji (typed); resolve both to a kana
function givenAsKana(e: StatEntry, given: string): string | undefined {
  if (pairFor(given)) return given
  return kanaForRomaji(given, e.script)
}

function confusions(entries: StatEntry[], min: number): Pattern[] {
  const merged = new Map<string, { a: string; b: string; count: number }>()
  for (const e of entries) {
    for (const [given, n] of Object.entries(e.confusions)) {
      const other = givenAsKana(e, given)
      if (!other || other === e.kana) continue
      const [a, b] = [e.kana, other].sort()
      const key = a + b
      const m = merged.get(key) ?? { a, b, count: 0 }
      m.count += n
      merged.set(key, m)
    }
  }
  const out: Pattern[] = []
  for (const { a, b, count } of merged.values()) {
    if (count < min) continue
    const hint = lookalikeHint(a, b)
    out.push({
      kind: 'confusion',
      title: `${a} vs ${b}`,
      detail: hint ? `Mixed up ${count}×. ${hint}` : `Mixed up ${count}×`,
      kana: [a, b],
      severity: 10 + count,
      practice: pairs([a, b, ...lookalikesOf(a), ...lookalikesOf(b)]),
      mode: 'romaji-to-kana',
    })
  }
  return out
}

interface Bucket { label: string; kana: string[]; correct: number; incorrect: number; errorKana: number }

function bucketBy(entries: StatEntry[], keyOf: (e: StatEntry) => [string, string] | null): Bucket[] {
  const map = new Map<string, Bucket>()
  for (const e of entries) {
    const k = keyOf(e)
    if (!k) continue
    const b = map.get(k[0]) ?? { label: k[1], kana: [], correct: 0, incorrect: 0, errorKana: 0 }
    b.kana.push(e.kana)
    if (e.incorrect > 0) b.errorKana++
    b.correct += e.correct
    b.incorrect += e.incorrect
    map.set(k[0], b)
  }
  return [...map.values()]
}

// a row or vowel column that is clearly worse than the user's overall level;
// one bad kana alone is a confusion, not a cluster
function clusters(entries: StatEntry[], t: typeof THRESHOLDS.all, overall: number): Pattern[] {
  const out: Pattern[] = []
  const check = (buckets: Bucket[], kind: PatternKind, titleOf: (label: string) => string) => {
    for (const b of buckets) {
      const n = b.correct + b.incorrect
      if (n < t.clusterSeen || b.incorrect < t.clusterErrors || b.errorKana < 2 || acc(b) > overall - 0.15) continue
      out.push({
        kind, title: titleOf(b.label),
        detail: `${b.incorrect} of ${n} wrong (${pct(acc(b))}), overall ${pct(overall)}`,
        kana: b.kana, severity: 5 + b.incorrect, practice: pairs(b.kana),
      })
    }
  }
  check(
    bucketBy(entries, e => { const i = kanaInfo(e.kana); return i ? [`${e.script}:${i.colId}`, i.colLabel] : null }),
    'row', label => `Weak row: ${label}`,
  )
  check(
    bucketBy(entries, e => { const i = kanaInfo(e.kana); return i?.vowel ? [`${e.script}:${i.vowel}`, i.vowel] : null }),
    'vowel', label => `Weak vowel: -${label}`,
  )
  return out
}

// dakuten or combination kana lagging behind the plain ones of the same script
function marks(entries: StatEntry[], t: typeof THRESHOLDS.all): Pattern[] {
  const out: Pattern[] = []
  for (const script of ['hiragana', 'katakana'] as ScriptName[]) {
    const byGroup = bucketBy(entries.filter(e => e.script === script), e => {
      const i = kanaInfo(e.kana)
      return i ? [i.group, i.group] : null
    })
    const main = byGroup.find(b => b.label === 'main')
    if (!main || main.correct + main.incorrect < t.clusterSeen) continue
    for (const [group, title] of [['dakuten', 'Dakuten forms lag behind'], ['combo', 'Combination kana lag behind']]) {
      const b = byGroup.find(x => x.label === group)
      if (!b) continue
      const n = b.correct + b.incorrect
      if (n < t.clusterSeen || b.incorrect < t.clusterErrors || b.errorKana < 2 || acc(b) > acc(main) - 0.15) continue
      out.push({
        kind: 'marks', title: `${title} (${script})`,
        detail: `${pct(acc(b))} vs ${pct(acc(main))} on plain kana`,
        kana: b.kana, severity: 5 + b.incorrect, practice: pairs(b.kana),
      })
    }
  }
  return out
}

function scriptGap(entries: StatEntry[], t: typeof THRESHOLDS.all): Pattern[] {
  const by = bucketBy(entries, e => [e.script, e.script])
  const h = by.find(b => b.label === 'hiragana')
  const k = by.find(b => b.label === 'katakana')
  if (!h || !k || h.correct + h.incorrect < t.scriptSeen || k.correct + k.incorrect < t.scriptSeen) return []
  const [weak, strong] = acc(k) < acc(h) ? [k, h] : [h, k]
  if (acc(weak) > acc(strong) - 0.2) return []
  const weakEntries = entries.filter(e => e.script === weak.label)
  const missed = weakEntries.filter(e => e.incorrect > 0).map(e => e.kana)
  return [{
    kind: 'script-gap',
    title: `${weak.label === 'katakana' ? 'Katakana' : 'Hiragana'} lags behind`,
    detail: `${pct(acc(weak))} vs ${pct(acc(strong))}`,
    kana: missed,
    severity: 6,
    practice: pairs(missed.length ? missed : weakEntries.map(e => e.kana)),
  }]
}

function directionGap(entries: StatEntry[], t: typeof THRESHOLDS.all): Pattern[] {
  const notRead: string[] = []        // picks it from a list, can't type the reading
  const notRecognized: string[] = []  // types the reading, can't pick it out
  const notWritten: string[] = []     // reads it fine, can't write it
  const enough = (d?: DirectionStat): d is DirectionStat => !!d && d.correct + d.incorrect >= t.dirSeen
  for (const e of entries) {
    const r = e.byDirection['kana-to-romaji']
    const c = e.byDirection['romaji-to-kana']
    const w = e.byDirection.draw
    if (enough(r) && enough(c)) {
      if (acc(c) >= 0.8 && acc(r) <= 0.5) notRead.push(e.kana)
      if (acc(r) >= 0.8 && acc(c) <= 0.5) notRecognized.push(e.kana)
    }
    const reads = [r, c].some(d => enough(d) && acc(d) >= 0.8)
    if (reads && enough(w) && acc(w) <= 0.5) notWritten.push(e.kana)
  }
  const out: Pattern[] = []
  if (notRead.length) out.push({
    kind: 'direction-gap', title: 'Recognized but not read',
    detail: 'You pick these from a list but cannot type the reading',
    kana: notRead, severity: 4 + notRead.length, practice: pairs(notRead), mode: 'kana-to-romaji',
  })
  if (notRecognized.length) out.push({
    kind: 'direction-gap', title: 'Read but not recognized',
    detail: 'You type the reading but cannot pick the kana out',
    kana: notRecognized, severity: 4 + notRecognized.length, practice: pairs(notRecognized), mode: 'romaji-to-kana',
  })
  if (notWritten.length) out.push({
    kind: 'direction-gap', title: 'Read but not written',
    detail: 'You know these when you see them but cannot write them yet',
    kana: notWritten, severity: 4 + notWritten.length, practice: pairs(notWritten), mode: 'draw',
  })
  return out
}

// single strokes that keep getting redone, worst first
function weakStrokes(entries: StatEntry[]): Pattern[] {
  const hits = entries
    .map(e => {
      const worst = Math.max(0, ...e.strokeErrors.map(n => n ?? 0))
      return { kana: e.kana, index: e.strokeErrors.indexOf(worst), count: worst }
    })
    .filter(h => h.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
  if (!hits.length) return []
  const kana = hits.map(h => h.kana)
  return [{
    kind: 'stroke', title: 'Tricky strokes',
    detail: hits.map(h => `stroke ${h.index + 1} of ${h.kana} (${h.count}× redone)`).join(', '),
    kana, severity: 5 + hits.length, practice: pairs(kana), mode: 'draw',
  }]
}

// direction and order mistakes are habits, so they're counted across all kana
function strokeHabits(entries: StatEntry[]): Pattern[] {
  const out: Pattern[] = []
  const habits: Array<[StrokeFault, string, string]> = [
    ['direction', 'Strokes drawn backwards', 'Horizontal strokes go left to right, vertical ones top to bottom'],
    ['order', 'Stroke order slips', 'A later stroke came first. As a rule: top before bottom, left before right'],
  ]
  for (const [fault, title, rule] of habits) {
    const affected = entries.filter(e => (e.strokeFaults[fault] ?? 0) > 0)
    const total = affected.reduce((s, e) => s + (e.strokeFaults[fault] ?? 0), 0)
    if (total < 3) continue
    const kana = affected.map(e => e.kana)
    out.push({
      kind: 'stroke-habit', title,
      detail: `${total}× so far. ${rule}`,
      kana, severity: 5 + total, practice: pairs(kana), mode: 'draw',
    })
  }
  return out
}

function slow(entries: StatEntry[]): Pattern[] {
  const timed = entries.filter(e => e.count >= 3)
  if (timed.length < 3) return []
  const avgs = timed.map(e => e.totalMs / e.count).sort((a, b) => a - b)
  const median = avgs[Math.floor(avgs.length / 2)]
  const bar = Math.max(2500, 2 * median)
  const hits = timed.filter(e => acc(e) >= 0.9 && e.totalMs / e.count > bar)
  if (!hits.length) return []
  const kana = hits.map(e => e.kana)
  const worst = Math.max(...hits.map(e => e.totalMs / e.count))
  return [{
    kind: 'slow', title: 'Correct but slow',
    detail: `Not automatic yet: up to ${(worst / 1000).toFixed(1)}s vs your usual ${(median / 1000).toFixed(1)}s`,
    kana, severity: 3 + kana.length, practice: pairs(kana), mode: 'kana-to-romaji', timed: true,
  }]
}

function slipping(entries: StatEntry[], log: AnswerRecord[], now: number): Pattern[] {
  const recentErrors = new Map<string, number>()
  for (const r of log)
    if (!r.correct && r.t >= now - WEEK_MS) recentErrors.set(r.kana, (recentErrors.get(r.kana) ?? 0) + 1)
  const kana = entries
    .filter(e => seen(e) >= 5 && acc(e) >= 0.8 && (recentErrors.get(e.kana) ?? 0) >= 2)
    .map(e => e.kana)
  if (!kana.length) return []
  return [{
    kind: 'slipping', title: 'Slipping',
    detail: 'Usually right, but missed more than once this week',
    kana, severity: 7 + kana.length, practice: pairs(kana),
  }]
}

// missed one of a lookalike group, never saw the others: they'll bite later
function blindSpots(stats: StatsMap, entries: StatEntry[]): Pattern[] {
  const examples: string[] = []
  const kana: string[] = []
  for (const e of entries) {
    if (e.incorrect === 0) continue
    const unseen = lookalikesOf(e.kana).filter(k => !stats[k])
    if (!unseen.length) continue
    kana.push(e.kana, ...unseen)
    if (examples.length < 3) examples.push(`${e.kana} vs ${unseen.join('/')}`)
  }
  if (!kana.length) return []
  return [{
    kind: 'blind-spot', title: 'Untested lookalikes',
    detail: `You missed ${examples.join(', ')} but never practiced the lookalike`,
    kana: uniq(kana), severity: 2, practice: pairs(kana), mode: 'romaji-to-kana',
  }]
}

export function detectPatterns(stats: StatsMap, log: AnswerRecord[], scope: PatternScope, now: number = Date.now()): Pattern[] {
  const t = THRESHOLDS[scope]
  const entries = Object.values(stats).filter(e => seen(e) > 0)
  if (!entries.length) return []
  const overall = acc({
    correct: entries.reduce((s, e) => s + e.correct, 0),
    incorrect: entries.reduce((s, e) => s + e.incorrect, 0),
  })

  const found = [
    ...confusions(entries, t.confusions),
    ...clusters(entries, t, overall),
    ...marks(entries, t),
    ...scriptGap(entries, t),
    ...directionGap(entries, t),
    ...slow(entries),
    ...(scope === 'all' ? slipping(entries, log, now) : []),
    ...(scope === 'all' ? blindSpots(stats, entries) : []),
    // the answer log has no stroke details, so these only work on the full stats
    ...(scope === 'all' ? weakStrokes(entries) : []),
    ...(scope === 'all' ? strokeHabits(entries) : []),
  ]
  return found.sort((a, b) => b.severity - a.severity).slice(0, MAX_PATTERNS)
}
