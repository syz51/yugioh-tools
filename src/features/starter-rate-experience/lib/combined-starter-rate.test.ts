import { describe, expect, it } from 'vitest'
import { calculateCombinedStarterRate } from './combined-starter-rate'

describe('calculateCombinedStarterRate', () => {
  it('matches the one-card rate when only one-card starters are configured', () => {
    const result = calculateCombinedStarterRate({
      deckEntries: [
        { copies: 12, id: 'starter' },
        { copies: 28, id: 'filler' },
      ],
      deckSize: 40,
      oneCardStarterIds: ['starter'],
      twoCardStarterRows: [],
    })

    const expected = 1 - choose(28, 5) / choose(40, 5)

    expect(result?.openingHandProbability).toBeCloseTo(expected, 12)
  })

  it('uses each row specific partner list instead of a shared supplement pool', () => {
    const result = calculateCombinedStarterRate({
      deckEntries: [
        { copies: 3, id: 'starter-a' },
        { copies: 3, id: 'starter-c' },
        { copies: 3, id: 'shared-partner' },
        { copies: 31, id: 'filler' },
      ],
      deckSize: 40,
      oneCardStarterIds: [],
      twoCardStarterRows: [
        {
          id: 'row-a',
          mainCardId: 'starter-a',
          supplementCardIds: ['shared-partner'],
        },
        {
          id: 'row-c',
          mainCardId: 'starter-c',
          supplementCardIds: ['shared-partner'],
        },
      ],
    })

    const expected =
      1 -
      choose(37, 5) / choose(40, 5) -
      choose(34, 5) / choose(40, 5) +
      choose(31, 5) / choose(40, 5)

    expect(result?.openingHandProbability).toBeCloseTo(expected, 12)
  })

  it('ignores partner cards that are already in the one-card pool', () => {
    const result = calculateCombinedStarterRate({
      deckEntries: [
        { copies: 3, id: 'one-card' },
        { copies: 3, id: 'main' },
        { copies: 34, id: 'filler' },
      ],
      deckSize: 40,
      oneCardStarterIds: ['one-card'],
      twoCardStarterRows: [
        {
          id: 'row-main',
          mainCardId: 'main',
          supplementCardIds: ['one-card'],
        },
      ],
    })

    const expected = 1 - choose(37, 5) / choose(40, 5)

    expect(result?.openingHandProbability).toBeCloseTo(expected, 12)
  })

  it('ignores incomplete rows and returns null when nothing valid is configured', () => {
    const result = calculateCombinedStarterRate({
      deckEntries: [
        { copies: 3, id: 'main' },
        { copies: 37, id: 'filler' },
      ],
      deckSize: 40,
      oneCardStarterIds: [],
      twoCardStarterRows: [
        {
          id: 'row-main',
          mainCardId: 'main',
          supplementCardIds: [],
        },
      ],
    })

    expect(result).toBeNull()
  })
})

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
