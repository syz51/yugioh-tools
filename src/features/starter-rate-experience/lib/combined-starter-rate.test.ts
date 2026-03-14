import { describe, expect, it } from 'vitest'
import { calculateCombinedStarterRate } from './combined-starter-rate'

describe('calculateCombinedStarterRate', () => {
  it('matches the one-card rate when only one-card starters are configured', () => {
    const result = calculateCombinedStarterRate({
      deckSize: 40,
      oneCardStarterCopies: 12,
      selectedTwoCardStarterCopies: 0,
      twoCardSupplementCopies: 0,
    })

    const expected = 1 - choose(28, 5) / choose(40, 5)

    expect(result?.openingHandProbability).toBeCloseTo(expected, 12)
  })

  it('calculates the union of one-card and disjoint two-card starts', () => {
    const result = calculateCombinedStarterRate({
      deckSize: 40,
      oneCardStarterCopies: 12,
      selectedTwoCardStarterCopies: 3,
      twoCardSupplementCopies: 9,
    })

    const oneCardRate = 1 - choose(28, 5) / choose(40, 5)
    const twoCardRate =
      1 -
      choose(37, 5) / choose(40, 5) -
      choose(31, 5) / choose(40, 5) +
      choose(28, 5) / choose(40, 5)
    const overlapRate =
      1 -
      choose(28, 5) / choose(40, 5) -
      choose(37, 5) / choose(40, 5) -
      choose(31, 5) / choose(40, 5) +
      choose(25, 5) / choose(40, 5) +
      choose(19, 5) / choose(40, 5) +
      choose(28, 5) / choose(40, 5) -
      choose(16, 5) / choose(40, 5)

    expect(result?.openingHandProbability).toBeCloseTo(
      oneCardRate + twoCardRate - overlapRate,
      12,
    )
  })

  it('does not add extra start rate when no disjoint two-card main copies remain', () => {
    const result = calculateCombinedStarterRate({
      deckSize: 40,
      oneCardStarterCopies: 12,
      selectedTwoCardStarterCopies: 0,
      twoCardSupplementCopies: 9,
    })

    const expected = 1 - choose(28, 5) / choose(40, 5)

    expect(result?.openingHandProbability).toBeCloseTo(expected, 12)
  })

  it('falls back to the two-card rate when no one-card starters are selected', () => {
    const result = calculateCombinedStarterRate({
      deckSize: 40,
      oneCardStarterCopies: 0,
      selectedTwoCardStarterCopies: 3,
      twoCardSupplementCopies: 9,
    })

    const expected =
      1 -
      choose(37, 5) / choose(40, 5) -
      choose(31, 5) / choose(40, 5) +
      choose(28, 5) / choose(40, 5)

    expect(result?.openingHandProbability).toBeCloseTo(expected, 12)
  })

  it('counts multiple selected two-card mains as one starter pool', () => {
    const result = calculateCombinedStarterRate({
      deckSize: 40,
      oneCardStarterCopies: 0,
      selectedTwoCardStarterCopies: 6,
      twoCardSupplementCopies: 9,
    })

    const expected =
      1 -
      choose(34, 5) / choose(40, 5) -
      choose(31, 5) / choose(40, 5) +
      choose(25, 5) / choose(40, 5)

    expect(result?.openingHandProbability).toBeCloseTo(expected, 12)
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
