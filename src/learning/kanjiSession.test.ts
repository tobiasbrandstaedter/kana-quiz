import { describe, it, expect } from 'vitest'
import { seeded } from './seeded'
import { planKanji, planCards } from './kanjiPlan'
import type { PlanCourse } from './kanjiPlan'
import { orderKanjiSession, readyCard, spreadCards } from './kanjiSession'
import type { PlannedCard } from './kanjiSession'
import { groupCardId } from '../kanjiKeys'
import { C, DAY, G, IDS, NOW, WORDS, readyWith, seen, statsOf } from './kanjiFixtures'

// the same item twice in a row where both cards are questions
const backToBack = (cards: PlannedCard[]) =>
  cards.filter((c, i) => i > 0 && c.id === cards[i - 1].id && c.type !== 'intro' && cards[i - 1].type !== 'intro')

describe('orderKanjiSession', () => {
  it('spreads a lone new kanji and its first word as far as six cards allow (KR12, KR14)', () => {
    const p = planKanji({}, [], C, 10, NOW, 3)
    expect(orderKanjiSession(p, seeded())).toEqual([
      { id: 'k:A', type: 'intro' },
      { id: 'k:A' },
      { id: 'w:a', type: 'intro', needs: 'k:A' },
      { id: 'w:a', type: 'read-choice' },
      { id: 'k:A' },
      { id: 'w:a', type: 'word-meaning' },
    ])
  })

  // reviews of seen kanji and words, so the new ones come on top of real reviews
  const reviews = (n: number) => statsOf(...IDS.slice(10, 10 + n).map(id => seen(id, 2, NOW - DAY)))
  const course = (n: number): PlanCourse => ({ kanji: [...C.kanji, ...IDS.slice(10, 10 + n)], words: WORDS, groups: [] })

  for (const size of [10, 20, 30]) {
    for (const fresh of [1, 2, 3]) {
      for (const due of [0, 3]) {
        it(`keeps the questions of an item apart at size ${size}, ${fresh} new kanji, ${due} reviews`, () => {
          for (let seed = 1; seed < 6; seed++) {
            const p = planKanji(reviews(due), [], course(due), size, NOW, fresh)
            const cards = orderKanjiSession(p, seeded(seed))
            expect(backToBack(cards), JSON.stringify(cards)).toEqual([])
            for (const [i, c] of cards.entries()) {
              // every question comes after its item's intro, a first word after a question of its kanji
              if (c.type !== 'intro' && p.fresh.concat(Object.values(p.firstWords)).includes(c.id)) {
                expect(cards.slice(0, i).some(x => x.id === c.id && x.type === 'intro')).toBe(true)
              }
              if (c.needs) expect(cards.slice(0, i).some(x => x.id === c.needs && x.type !== 'intro')).toBe(true)
            }
            const word = cards.filter(c => c.id.startsWith('w:') && c.id !== 'w:e')
            for (const id of new Set(word.map(c => c.id))) {
              expect(cards.filter(c => c.id === id).map(c => c.type)).toEqual(['intro', 'read-choice', 'word-meaning'])
            }
          }
        })
      }
    }
  }

  it('shows the table of a group right before the first of its words and keeps every word behind it', () => {
    for (const size of [10, 20, 30]) {
      for (const limit of [1, 2, 3]) {
        for (let seed = 1; seed < 6; seed++) {
          const p = planKanji(readyWith(seen('k:A', 2, NOW - DAY)), [], G, size, NOW, limit)
          const cards = orderKanjiSession(p, seeded(seed))
          const table = cards.findIndex(c => c.id === groupCardId('gb'))
          expect(table >= 0, `${size} ${limit}`).toBe(!!p.group)
          expect(cards).toHaveLength(planCards(p))
          expect(backToBack(cards), JSON.stringify(cards)).toEqual([])
          for (const id of p.group?.words ?? []) {
            expect(cards.findIndex(c => c.id === id)).toBeGreaterThan(table)
            expect(cards.filter(c => c.id === id).map(c => c.type)).toEqual(['intro', 'read-choice', 'word-meaning'])
          }
        }
      }
    }
  })
})

describe('spreadCards', () => {
  it('puts another card between two questions of the same item', () => {
    const cards: PlannedCard[] = [{ id: 'a' }, { id: 'a' }, { id: 'b' }]
    expect(spreadCards(cards).map(c => c.id)).toEqual(['a', 'b', 'a'])
  })

  it('leaves the cards before `from` alone and keeps each item in order', () => {
    const cards: PlannedCard[] = [
      { id: 'a', type: 'intro' }, { id: 'b' }, { id: 'b', type: 'read-choice' }, { id: 'b', type: 'word-meaning' }, { id: 'c' }, { id: 'd' },
    ]
    const out = spreadCards(cards, 2)
    expect(out.slice(0, 2)).toEqual(cards.slice(0, 2))
    expect(out.filter(c => c.id === 'b').map(c => c.type)).toEqual([undefined, 'read-choice', 'word-meaning'])
    expect(backToBack(out)).toEqual([])
  })

  it('keeps clumps it cannot take apart', () => {
    expect(spreadCards([{ id: 'a' }, { id: 'a' }]).map(c => c.id)).toEqual(['a', 'a'])
  })

  it('never moves a card in front of the one it comes after', () => {
    const cards: PlannedCard[] = [{ id: 'g:x', type: 'intro' }, { id: 'm', type: 'intro', after: 'g:x' }, { id: 'm' }]
    expect(spreadCards(cards)).toEqual(cards)
    // without it the table would go between the word's intro and its question
    expect(spreadCards(cards.map(({ after, ...c }) => c)).map(c => c.id)).toEqual(['m', 'g:x', 'm'])
  })
})

describe('readyCard (KR14)', () => {
  const session: PlannedCard[] = [
    { id: 'k:A', type: 'intro' }, { id: 'k:A' }, { id: 'w:a', type: 'intro', needs: 'k:A' },
    { id: 'k:B' }, { id: 'w:a', type: 'read-choice' }, { id: 'k:A', type: 'meaning' }, { id: 'k:C' }, { id: 'w:a', type: 'word-meaning' },
  ]

  it('shows the word intro once its kanji was answered right', () => {
    expect(readyCard(session, 2, new Set(['k:A']))).toBe(session)
  })

  it('moves the word behind the next question of its kanji when that is still to come', () => {
    const out = readyCard(session, 2, new Set())
    const at = out.findIndex(c => c.id === 'w:a')
    expect(out.slice(0, at).filter(c => c.id === 'k:A' && c.type !== 'intro')).toHaveLength(2)
    expect(out.filter(c => c.id === 'w:a').map(c => c.type)).toEqual(['intro', 'read-choice', 'word-meaning'])
    expect(out).toHaveLength(session.length)
    expect(backToBack(out.slice(2))).toEqual([])
  })

  it('drops the word when no question of its kanji is left, and spreads what stays', () => {
    // the kanji's re-asks would come twice in a row once the word is out
    const cards: PlannedCard[] = [
      { id: 'k:A', type: 'intro' }, { id: 'k:A' }, { id: 'k:B' }, { id: 'w:a', type: 'intro', needs: 'k:A' },
      { id: 'w:a', type: 'read-choice' }, { id: 'k:B' }, { id: 'w:a', type: 'word-meaning' }, { id: 'k:B' }, { id: 'k:C' }, { id: 'k:D' },
    ]
    const out = readyCard(cards, 3, new Set(['k:B']))
    expect(out.map(c => c.id)).not.toContain('w:a')
    expect(out.slice(0, 3)).toEqual(cards.slice(0, 3))
    expect(backToBack(out)).toEqual([])
  })
})

