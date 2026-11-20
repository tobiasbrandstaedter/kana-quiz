import type { KanjiAnswerRecord, KanjiSetEntry, KanjiStatEntry, KanjiStatsMap, QuestionType } from '../types'
import { kanjiId } from '../kanjiKeys'
import { isDue, isSeen, recentErrors } from './scheduler'
import { shuffle } from './distractors'

// too many shaky items, kanji and words together: nothing new until those settle (KR31)
export const MAX_KANJI_LEARNING = 12
// a new kanji is an intro card and two tests, a new word too (one test for the reading,
// one for the meaning), so a new kanji with its first word takes six (KR14)
export const CARDS_PER_NEW = 3
export const CARDS_PER_WORD = 3
// a further word waits until its home kanji has survived a review on a later day (KR29)
export const WORD_UNLOCK_BOX = 2

// a course word as the plan sees it
export interface PlanWord {
  id: string
  kanji: string[]  // item ids of the course kanji in it
  home: string     // item id of its home kanji
  first: boolean   // the first word of its home kanji
  special: boolean // a reading that can't be split over the kanji (KD14)
}

export interface PlanCourse {
  kanji: string[]     // item ids in learning order
  words: PlanWord[]   // in course order: by home kanji, then teaching order
}

/**
 * What still keeps a word from coming in, null once nothing does: kanji of it not seen yet,
 * and for a further word a home kanji below WORD_UNLOCK_BOX. A first word only waits for its kanji.
 */
export function wordLock(w: PlanWord, stats: KanjiStatsMap): { unseen: string[]; review: boolean } | null {
  const unseen = w.kanji.filter(id => !isSeen(stats[id]))
  const review = !w.first && (stats[w.home]?.box ?? 0) < WORD_UNLOCK_BOX
  return unseen.length || review ? { unseen, review } : null
}

export interface KanjiPlan {
  due: string[]
  weak: string[]
  // new words of kanji the learner has met: first words that didn't come along with their
  // kanji, then further words (KR29)
  newWords: string[]
  fresh: string[]                      // new kanji
  firstWords: Record<string, string>   // new kanji -> its first word, when that comes along
  fill: string[]
  // why nothing new comes although something is left: switched off, the picked sets have
  // nothing new, or too many still settling. null when new ones come, none are left, or the
  // reviews leave no room
  newBlocked: 'off' | 'sets' | 'cap' | null
  // kanji outside the picked sets, not seen yet, that words of the picked sets need: those
  // words only come once every set is in use. Empty without a pick
  outsideSets: string[]
}

/**
 * The next smart session over the kanji and words of `course`, in priority order (KR28): due
 * reviews (lowest box, most overdue first), items with a high recent error rate, new
 * material, then the items due next to fill up. `size` counts every card.
 *
 * New material, up to `newLimit` words and `newLimit` kanji (KR30), each only while all of its
 * cards fit: words of kanji already met first (three cards), a first word left behind before a
 * further word, then new kanji from `newIds` (the picked sets, in course order), each with its
 * first word when the learner can read that by then (six cards, else three). With sets
 * picked, new words come from those sets too.
 */
export function planKanji(
  stats: KanjiStatsMap, log: KanjiAnswerRecord[], course: PlanCourse, size: number, now: number, newLimit: number,
  newIds: string[] = course.kanji,
): KanjiPlan {
  const ids = [...course.kanji, ...course.words.map(w => w.id)]
  const reviewable = ids.map(id => stats[id]).filter(isSeen)
  const taken = new Set<string>()
  const take = (list: KanjiStatEntry[], limit: number) => {
    const out = list.filter(e => !taken.has(e.id)).slice(0, Math.max(0, limit))
    out.forEach(e => taken.add(e.id))
    return out.map(e => e.id)
  }

  const due = take(reviewable.filter(e => isDue(e, now)).sort((a, b) => a.box - b.box || a.due - b.due), size)

  const recent = recentErrors(log, r => r.id)
  const rate = (e: KanjiStatEntry) => {
    const r = recent.get(e.id)
    return r && r.answers >= 3 ? r.errors / r.answers : 0
  }
  const weak = take(reviewable.filter(e => rate(e) >= 0.3).sort((a, b) => rate(b) - rate(a)), size - due.length)

  const capped = reviewable.filter(e => e.box <= 1).length >= MAX_KANJI_LEARNING
  const limit = capped ? 0 : newLimit
  let room = size - due.length - weak.length

  const picked = new Set(newIds)
  const position = new Map(course.kanji.map((id, i) => [id, i]))
  const open = course.words.filter(w => picked.has(w.home) && !isSeen(stats[w.id]) && !wordLock(w, stats))
  const waiting = [
    ...open.filter(w => w.first),
    // the special ones of a kanji after its regular ones (KD14), the sort is stable
    ...open.filter(w => !w.first).sort((a, b) => position.get(a.home)! - position.get(b.home)! || Number(a.special) - Number(b.special)),
  ]
  const newWords = waiting.slice(0, Math.max(0, Math.min(limit, Math.floor(room / CARDS_PER_WORD)))).map(w => w.id)
  room -= newWords.length * CARDS_PER_WORD

  const fresh: string[] = []
  const firstWords: Record<string, string> = {}
  const met = new Set(reviewable.map(e => e.id))
  for (const id of newIds) {
    if (fresh.length >= limit) break
    if (isSeen(stats[id])) continue
    const first = course.words.find(w => w.home === id && w.first)
    // its other kanji met before or new earlier in this session
    const withWord = !!first && !isSeen(stats[first.id]) && first.kanji.every(k => k === id || met.has(k))
    const cost = CARDS_PER_NEW + (withWord ? CARDS_PER_WORD : 0)
    // a kanji only starts when all of its cards fit, the next one in line doesn't jump ahead
    if (cost > room) break
    fresh.push(id)
    if (withWord) firstWords[id] = first.id
    met.add(id)
    room -= cost
  }

  const fill = take([...reviewable].sort((a, b) => a.due - b.due), room)

  const outsideSets = [...new Set(course.words
    .filter(w => picked.has(w.home) && !isSeen(stats[w.id]))
    .flatMap(w => w.kanji.filter(k => !picked.has(k) && !isSeen(stats[k]))))]

  let newBlocked: KanjiPlan['newBlocked'] = null
  const somethingLeft = course.kanji.some(id => !isSeen(stats[id])) || course.words.some(w => !isSeen(stats[w.id]) && !wordLock(w, stats))
  if (fresh.length === 0 && newWords.length === 0 && somethingLeft) {
    if (newLimit === 0) newBlocked = 'off'
    else if (newIds.every(id => isSeen(stats[id])) && waiting.length === 0) newBlocked = 'sets'
    else if (capped) newBlocked = 'cap'
  }

  return { due, weak, newWords, fresh, firstWords, fill, newBlocked, outsideSets }
}

/** How many cards the plan makes. */
export function planCards(p: KanjiPlan): number {
  return p.due.length + p.weak.length + p.fill.length + p.fresh.length * CARDS_PER_NEW
    + (p.newWords.length + Object.keys(p.firstWords).length) * CARDS_PER_WORD
}

// one card of a session as the plan lays it out: an intro, or a question whose type is left
// to the caller unless given
export interface PlannedCard {
  id: string
  type?: QuestionType | 'intro'
  needs?: string  // see KanjiCard.needs
}

// what spreading and the KR14 check need of a card, planned or built
interface SessionCard {
  id: string
  type?: QuestionType | 'intro'
  needs?: string
}

const isQuestion = (c: SessionCard) => c.type !== 'intro'

// how clumped an order is: the same item twice in a row, much worse when both are questions
function clumps(cards: SessionCard[], from: number): number {
  let n = 0
  for (let i = Math.max(1, from); i < cards.length; i++) {
    if (cards[i].id === cards[i - 1].id) n += isQuestion(cards[i - 1]) ? 100 : 1
  }
  return n
}

// questions about `id` in front of position i
const questionsBefore = (cards: SessionCard[], i: number, id: string) =>
  cards.slice(0, i).filter(c => c.id === id && isQuestion(c)).length

/**
 * The same cards with fewer clumps: the two questions of an item never follow each other
 * while another card can go between them, and an intro and its question only where nothing
 * else fits (KR12). Cards before `from` stay where they are. Every item keeps the order of its
 * cards, and a first word's intro never moves in front of a question of its kanji that was
 * in front of it (KR14). A small local search, sessions are a few dozen cards.
 */
export function spreadCards<T extends SessionCard>(cards: T[], from = 0): T[] {
  let order = [...cards]
  const rank = new Map(order.map((c, i) => [c, i]))
  const floor = new Map(order.flatMap((c, i) => c.needs && !isQuestion(c) ? [[c, questionsBefore(order, i, c.needs)] as const] : []))
  const keepsOrder = (list: T[]) => {
    const last = new Map<string, number>()
    for (const [i, c] of list.entries()) {
      if ((last.get(c.id) ?? -1) > rank.get(c)!) return false
      last.set(c.id, rank.get(c)!)
      const min = floor.get(c)
      if (min !== undefined && questionsBefore(list, i, c.needs!) < min) return false
    }
    return true
  }
  const moved = (list: T[], from: number, to: number) => {
    const next = [...list]
    const [c] = next.splice(from, 1)
    next.splice(to, 0, c)
    return next
  }

  let score = clumps(order, from)
  while (score > 0) {
    let best: { list: T[]; score: number } | null = null
    for (let i = Math.max(1, from); i < order.length; i++) {
      if (order[i].id !== order[i - 1].id) continue
      // put another card into the gap, or move the second card of the clump somewhere else
      const tries: T[][] = []
      for (let k = from; k < order.length; k++) {
        if (k !== i && k !== i - 1) tries.push(moved(order, k, k < i ? i - 1 : i))
        if (k !== i) tries.push(moved(order, i, k))
      }
      for (const list of tries) {
        if (!keepsOrder(list)) continue
        const s = clumps(list, from)
        if (s < (best?.score ?? score)) best = { list, score: s }
      }
    }
    if (!best) break
    order = best.list
    score = best.score
  }
  return order
}

/**
 * Lay the plan out as cards. Reviews are spread evenly. Each new item gets an intro card and
 * two questions, interleaved with the other new items. A new word is asked once for its
 * reading and once for its meaning (KR13). A first word follows its kanji: its intro comes
 * after the kanji's first question, which has to be right by then (KR14). `spreadCards`
 * then takes out the clumps the layout leaves at any session size.
 */
export function orderKanjiSession(p: KanjiPlan, rng: () => number = Math.random): PlannedCard[] {
  const reviews = shuffle([...p.due, ...p.weak, ...p.fill], rng)
  const slots: Array<{ pos: number; card: PlannedCard }> = []
  const add = (pos: number, card: PlannedCard) => slots.push({ pos, card })
  const word = (id: string, start: number, needs?: string) => {
    add(start, needs ? { id, type: 'intro', needs } : { id, type: 'intro' })
    add(start + 2.5, { id, type: 'read-choice' })
    add(start + 6.5, { id, type: 'word-meaning' })
  }

  // intros two slots apart, first question 2.5 after: the next intro lands in between
  const blocks = [...p.newWords.map(id => ({ word: id })), ...p.fresh.map(id => ({ kanji: id }))]
  blocks.forEach((b, j) => {
    const start = j * 2
    if ('word' in b) return word(b.word, start)
    add(start, { id: b.kanji, type: 'intro' })
    add(start + 2.5, { id: b.kanji })
    add(start + 6.5, { id: b.kanji })
    const first = p.firstWords[b.kanji]
    if (first) word(first, start + 3, b.kanji)
  })

  const total = reviews.length + slots.length
  reviews.forEach((id, i) => add((i + 0.5) * total / reviews.length, { id }))

  // Array.prototype.sort is stable, so ties keep insertion order
  return spreadCards(slots.sort((a, b) => a.pos - b.pos).map(s => s.card))
}

/**
 * The cards with the one at `at` ready to be shown (KR14). A first word's intro whose kanji
 * (`needs`) hasn't been answered right this session waits: its cards move behind the next
 * question of that kanji still to come (a second question or a re-ask), and are dropped when
 * none is left, the word is then first in line next session. Either way the cards from `at`
 * on are spread again, so nothing the move or drop leaves behind comes twice in a row.
 */
export function readyCard<T extends SessionCard>(cards: T[], at: number, right: Set<string>): T[] {
  let list = cards
  for (;;) {
    const c = list[at]
    if (!c?.needs || isQuestion(c) || right.has(c.needs)) return list
    const word = list.slice(at).filter(x => x.id === c.id)
    const rest = list.slice(at).filter(x => x.id !== c.id)
    const next = rest.findIndex(x => x.id === c.needs && isQuestion(x))
    const after = next < 0 ? rest : [...rest.slice(0, next + 1), ...word, ...rest.slice(next + 1)]
    list = spreadCards([...list.slice(0, at), ...after], at)
  }
}

/** Item ids of the kanji in the picked sets, in course order: the custom quiz and the source of new kanji. */
export function pickedKanjiIds(sets: KanjiSetEntry[], picked: Set<string>): string[] {
  return sets.filter(s => picked.has(s.id)).flatMap(s => s.kanji.map(kanjiId))
}

/** The words of the kanji in `kanjiIds` the learner has met, in course order: the custom quiz in a word mode (KR47). */
export function pickedWordIds(kanjiIds: string[], words: PlanWord[], stats: KanjiStatsMap): string[] {
  const picked = new Set(kanjiIds)
  return words.filter(w => picked.has(w.home) && isSeen(stats[w.id])).map(w => w.id)
}

/** Practice for the open errors: each one once to three times, by its recent misses, shuffled. */
export function errorPracticeIds(errors: KanjiStatEntry[], log: KanjiAnswerRecord[], rng: () => number = Math.random): string[] {
  const recent = recentErrors(log, r => r.id)
  const ids = errors.flatMap(e => Array.from({ length: Math.min(3, Math.max(1, recent.get(e.id)?.errors ?? 0)) }, () => e.id))
  return shuffle(ids, rng)
}

/**
 * One kanji on its own: asked three times, each time followed by a kanji the learner
 * knows, so it is never the same card twice in a row. Fewer known ones, fewer in between.
 */
export function singleKanjiOrder(id: string, known: string[], rng: () => number = Math.random): string[] {
  const others = shuffle(known.filter(k => k !== id), rng)
  return [0, 1, 2].flatMap(i => others[i] ? [id, others[i]] : [id])
}
