import { describe, expect, it } from 'vitest'
import type {
  OpeningHandCalculationInput,
  StarterRecipe,
} from './opening-hand-calculator'
import { calculateOpeningHandProbabilities } from './opening-hand-calculator'

describe('calculateOpeningHandProbabilities', () => {
  it('matches the closed-form probability for one-card starters', () => {
    const result = calculateOpeningHandProbabilities({
      deckSize: 40,
      pools: [
        {
          id: 'one-card',
          label: 'One-card starters',
          copies: 12,
        },
      ],
      recipes: [
        {
          id: 'one-card',
          label: 'Any one-card starter',
          requirements: [{ poolId: 'one-card', count: 1 }],
        },
      ],
    })

    const expected = 1 - choose(28, 5) / choose(40, 5)
    expect(result.openingHandProbability).toBeCloseTo(expected, 12)
    expect(result.resolvedProbability).toBeCloseTo(expected, 12)
  })

  it('throws when named pools exceed the deck size', () => {
    expect(() =>
      calculateOpeningHandProbabilities({
        deckSize: 40,
        pools: [
          { id: 'a', label: 'A', copies: 21 },
          { id: 'b', label: 'B', copies: 20 },
        ],
        recipes: [
          {
            id: 'combo',
            label: 'A + B',
            requirements: [
              { poolId: 'a', count: 1 },
              { poolId: 'b', count: 1 },
            ],
          },
        ],
      }),
    ).toThrow('Card pools cannot add up to more cards than the deck contains.')
  })

  it('matches brute force on a small deck with a draw effect', () => {
    const comboRecipe: StarterRecipe = {
      id: 'combo',
      label: 'A + B',
      requirements: [
        { poolId: 'a', count: 1 },
        { poolId: 'b', count: 1 },
      ],
    }

    const input: OpeningHandCalculationInput = {
      deckSize: 6,
      openingHandSize: 2,
      pools: [
        { id: 'a', label: 'Piece A', copies: 1 },
        { id: 'b', label: 'Piece B', copies: 1 },
        {
          id: 'pot',
          label: 'Pot',
          copies: 1,
          drawEffect: {
            drawsPerActivation: 1,
            maxActivations: 1,
          },
        },
      ],
      recipes: [comboRecipe],
    }

    const exact = calculateOpeningHandProbabilities(input)
    const bruteForce = bruteForceResolvedProbability(input, comboRecipe)

    expect(exact.resolvedProbability).toBeCloseTo(bruteForce, 12)
  })
})

function bruteForceResolvedProbability(
  input: OpeningHandCalculationInput,
  targetRecipe: StarterRecipe,
) {
  const cards = expandDeck(input)
  const openingHandSize = input.openingHandSize ?? 5
  const openingHands = chooseActualCards(cards, openingHandSize)
  const activationCaps = new Map(
    input.pools.map((pool) => [pool.id, pool.drawEffect?.maxActivations ?? 0]),
  )

  let probability = 0
  for (const hand of openingHands) {
    const remainingDeck = removeCards(cards, hand)
    probability +=
      recurseBruteForce(
        hand,
        remainingDeck,
        activationCaps,
        input.pools,
        targetRecipe,
      ) / openingHands.length
  }

  return probability
}

function recurseBruteForce(
  hand: string[],
  remainingDeck: string[],
  activationsRemaining: Map<string, number>,
  pools: OpeningHandCalculationInput['pools'],
  targetRecipe: StarterRecipe,
): number {
  if (actualHandSatisfiesRecipe(hand, targetRecipe)) {
    return 1
  }

  let best = 0
  for (const pool of pools) {
    if (!pool.drawEffect) {
      continue
    }

    const cardsNeeded = pool.drawEffect.cardsNeededToActivate ?? 1
    if ((activationsRemaining.get(pool.id) ?? 0) <= 0) {
      continue
    }

    const matchingCards = hand.filter((card) => card.startsWith(`${pool.id}:`))
    if (matchingCards.length < cardsNeeded) {
      continue
    }

    const nextHand = [...hand]
    let removed = 0
    for (
      let index = nextHand.length - 1;
      index >= 0 && removed < cardsNeeded;
      index -= 1
    ) {
      if (nextHand[index]?.startsWith(`${pool.id}:`)) {
        nextHand.splice(index, 1)
        removed += 1
      }
    }

    const nextActivations = new Map(activationsRemaining)
    nextActivations.set(pool.id, (nextActivations.get(pool.id) ?? 0) - 1)

    const drawCount = Math.min(
      pool.drawEffect.drawsPerActivation,
      remainingDeck.length,
    )
    const draws = chooseActualCards(remainingDeck, drawCount)

    let expected = 0
    for (const drawnCards of draws) {
      const nextRemainingDeck = removeCards(remainingDeck, drawnCards)
      expected +=
        recurseBruteForce(
          [...nextHand, ...drawnCards],
          nextRemainingDeck,
          nextActivations,
          pools,
          targetRecipe,
        ) / draws.length
    }

    best = Math.max(best, expected)
  }

  return best
}

function actualHandSatisfiesRecipe(hand: string[], recipe: StarterRecipe) {
  return recipe.requirements.every((requirement) => {
    const copies = hand.filter((card) =>
      card.startsWith(`${requirement.poolId}:`),
    ).length
    return copies >= requirement.count
  })
}

function expandDeck(input: OpeningHandCalculationInput) {
  const cards: string[] = []

  for (const pool of input.pools) {
    for (let copy = 1; copy <= pool.copies; copy += 1) {
      cards.push(`${pool.id}:${copy}`)
    }
  }

  const fillerCards =
    input.deckSize - input.pools.reduce((sum, pool) => sum + pool.copies, 0)
  for (let copy = 1; copy <= fillerCards; copy += 1) {
    cards.push(`filler:${copy}`)
  }

  return cards
}

function chooseActualCards(cards: string[], count: number): string[][] {
  if (count === 0) {
    return [[]]
  }
  if (count > cards.length) {
    return []
  }

  const results: string[][] = []

  function visit(start: number, chosen: string[]) {
    if (chosen.length === count) {
      results.push([...chosen])
      return
    }

    const slotsLeft = count - chosen.length
    for (let index = start; index <= cards.length - slotsLeft; index += 1) {
      const card = cards[index]
      if (!card) {
        continue
      }

      chosen.push(card)
      visit(index + 1, chosen)
      chosen.pop()
    }
  }

  visit(0, [])
  return results
}

function removeCards(source: string[], cardsToRemove: string[]) {
  const remainder = [...source]
  for (const card of cardsToRemove) {
    const index = remainder.indexOf(card)
    remainder.splice(index, 1)
  }
  return remainder
}

function choose(n: number, k: number) {
  if (k < 0 || k > n) {
    return 0
  }
  if (k === 0 || k === n) {
    return 1
  }

  const normalizedK = Math.min(k, n - k)
  let result = 1
  for (let index = 1; index <= normalizedK; index += 1) {
    result *= (n - normalizedK + index) / index
  }
  return result
}
