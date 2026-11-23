import type { QuestionType } from '../types'
import { groupCardId } from '../kanjiKeys'
import { shuffle } from './distractors'
import type { KanjiPlan } from './kanjiPlan'
import { planReask } from './scheduler'

// How a planned session is laid out as cards: new items interleaved, clumps taken out, and the
// KR14 check on the card about to be shown. What goes into a session is kanjiPlan.ts.

// one card of a session, planned or built: an intro, or a question whose type is left to the
// caller unless given
export interface PlannedCard {
  id: string
  type?: QuestionType | 'intro'
  needs?: string  // see KanjiCard.needs
  after?: string  // see KanjiCard.after
  word?: string   // a kanji-read re-ask: the word that was missed, see KanjiCard.word
}

const isQuestion = (c: PlannedCard) => c.type !== 'intro'

// how clumped an order is: the same item twice in a row, much worse when both are questions
function clumps(cards: PlannedCard[], from: number): number {
  let n = 0
  for (let i = Math.max(1, from); i < cards.length; i++) {
    if (cards[i].id === cards[i - 1].id) n += isQuestion(cards[i - 1]) ? 100 : 1
  }
  return n
}

// the card a card has to stay behind: the kanji of a first word, the table of a group word
const anchorOf = (c: PlannedCard) => c.needs ?? c.after

const cardsBefore = (cards: PlannedCard[], i: number, id: string) => cards.slice(0, i).filter(c => c.id === id).length

/**
 * The same cards with fewer clumps: the two questions of an item never follow each other
 * while another card can go between them, and an intro and its question only where nothing
 * else fits (KR12). Cards before `from` stay where they are. Every item keeps the order of its
 * cards, and a card with an anchor (`needs` or `after`) never has fewer cards of it in front
 * than before: a first word's intro stays behind the kanji question it was behind (KR14), a
 * group word behind its table. A small local search, sessions are a few dozen cards.
 */
export function spreadCards<T extends PlannedCard>(cards: T[], from = 0): T[] {
  let order = [...cards]
  const rank = new Map(order.map((c, i) => [c, i]))
  const floor = new Map(order.flatMap((c, i) => {
    const anchor = anchorOf(c)
    return anchor ? [[c, cardsBefore(order, i, anchor)] as const] : []
  }))
  const keepsOrder = (list: T[]) => {
    const last = new Map<string, number>()
    for (const [i, c] of list.entries()) {
      // the cards of an item stay in their order
      if ((last.get(c.id) ?? -1) > rank.get(c)!) return false
      last.set(c.id, rank.get(c)!)
      // a card with an anchor keeps at least as many cards of it in front
      const min = floor.get(c)
      if (min !== undefined && cardsBefore(list, i, anchorOf(c)!) < min) return false
    }
    return true
  }
  const moved = (list: T[], at: number, to: number) => {
    const next = [...list]
    const [c] = next.splice(at, 1)
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
 * after the kanji's first question, which has to be right by then (KR14). A group that opens
 * shows its card right before the intro of its first word, its words stay behind it.
 * `spreadCards` then takes out the clumps the layout leaves at any session size.
 */
export function orderKanjiSession(p: KanjiPlan, rng: () => number = Math.random): PlannedCard[] {
  const reviews = shuffle([...p.due, ...p.weak, ...p.fill], rng)
  const slots: Array<{ pos: number; card: PlannedCard }> = []
  const add = (pos: number, card: PlannedCard) => slots.push({ pos, card })
  const word = (id: string, start: number, anchor: Pick<PlannedCard, 'needs' | 'after'> = {}) => {
    add(start, { id, type: 'intro', ...anchor })
    add(start + 2.5, { id, type: 'read-choice' })
    add(start + 6.5, { id, type: 'word-meaning' })
  }

  // new items start two slots apart, their first question 2.5 after: the next intro lands in between
  let slot = 0
  const nextStart = () => 2 * slot++

  for (const id of p.waitingWords) word(id, nextStart())

  if (p.group) {
    const table = groupCardId(p.group.id)
    add(2 * slot - 0.5, { id: table, type: 'intro' })
    for (const id of p.group.words) word(id, nextStart(), { after: table })
  }

  for (const id of p.fresh) {
    const start = nextStart()
    add(start, { id, type: 'intro' })
    add(start + 2.5, { id })
    add(start + 6.5, { id })
    const first = p.firstWords[id]
    if (first) word(first, start + 3, { needs: id })
  }

  // over the span the new cards take, so the two interleave; spread over the card count they
  // bunched at the end, behind the last new card
  const span = slots.length ? Math.max(...slots.map(s => s.pos)) + 1 : reviews.length
  reviews.forEach((id, i) => add((i + 0.5) * span / reviews.length, { id }))

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
export function readyCard<T extends PlannedCard>(cards: T[], at: number, right: Set<string>): T[] {
  let list = cards
  for (;;) {
    const c = list[at]
    if (!c?.needs || isQuestion(c) || right.has(c.needs)) return list
    const word = list.slice(at).filter(x => x.id === c.id)
    const rest = list.slice(at).filter(x => x.id !== c.id)
    const next = rest.findIndex(x => x.id === c.needs && isQuestion(x))
    const tail = next < 0 ? rest : [...rest.slice(0, next + 1), ...word, ...rest.slice(next + 1)]
    list = spreadCards([...list.slice(0, at), ...tail], at)
  }
}

/**
 * Where a missed item comes back and the cards that go in with it (see planReask): the re-ask,
 * last, in the type that was missed, and the padding in front of it from the questions of the
 * round. In a write quiz the padding is written too, else its type is left to the caller.
 * Null when the re-ask is dropped.
 */
export function reaskCards(
  cards: PlannedCard[], current: number, id: string, type: QuestionType, reasked: number, rng: () => number = Math.random,
): { index: number; cards: PlannedCard[] } | null {
  const asked = cards.filter(isQuestion).map(c => c.id)
  const slot = planReask(cards.map(c => c.id), current, id, asked, reasked, rng)
  if (!slot) return null
  const pad = slot.pad.map((p): PlannedCard => type === 'write' ? { id: p, type } : { id: p })
  return { index: slot.index, cards: [...pad, { id, type }] }
}
