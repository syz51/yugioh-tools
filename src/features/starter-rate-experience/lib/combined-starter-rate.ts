import type { OpeningHandCalculationResult } from '../../../lib/opening-hand-calculator'
import { calculateOpeningHandProbabilities } from '../../../lib/opening-hand-calculator'

export interface CombinedStarterRateInput {
  deckSize: number
  oneCardStarterCopies: number
  selectedTwoCardStarter: {
    copies: number
    name: string
  } | null
  selectedTwoCardStarterIncludedInOneCardPool: boolean
  twoCardSupplementCopies: number
}

export function calculateCombinedStarterRate(
  input: CombinedStarterRateInput,
): OpeningHandCalculationResult | null {
  const hasOneCardStarterPool = input.oneCardStarterCopies > 0
  const hasTwoCardCombo =
    input.selectedTwoCardStarter !== null &&
    input.selectedTwoCardStarter.copies > 0 &&
    input.twoCardSupplementCopies > 0

  if (input.deckSize <= 0 || (!hasOneCardStarterPool && !hasTwoCardCombo)) {
    return null
  }

  if (
    hasOneCardStarterPool &&
    (!hasTwoCardCombo || input.selectedTwoCardStarterIncludedInOneCardPool)
  ) {
    return calculateOpeningHandProbabilities({
      deckSize: input.deckSize,
      pools: [
        {
          id: 'one-card-starters',
          label: '一卡动',
          copies: input.oneCardStarterCopies,
        },
      ],
      recipes: [
        {
          id: 'one-card-starter',
          label: '任意一卡动',
          requirements: [{ poolId: 'one-card-starters', count: 1 }],
        },
      ],
    })
  }

  if (!hasOneCardStarterPool && hasTwoCardCombo && input.selectedTwoCardStarter) {
    return calculateOpeningHandProbabilities({
      deckSize: input.deckSize,
      pools: [
        {
          id: 'selected-two-card-starter',
          label: input.selectedTwoCardStarter.name,
          copies: input.selectedTwoCardStarter.copies,
        },
        {
          id: 'selected-two-card-supplements',
          label: `${input.selectedTwoCardStarter.name} 的补点`,
          copies: input.twoCardSupplementCopies,
        },
      ],
      recipes: [
        {
          id: 'selected-two-card-combo',
          label: `${input.selectedTwoCardStarter.name} + 任意补点`,
          requirements: [
            { poolId: 'selected-two-card-starter', count: 1 },
            { poolId: 'selected-two-card-supplements', count: 1 },
          ],
        },
      ],
    })
  }

  if (!input.selectedTwoCardStarter) {
    return null
  }

  return calculateOpeningHandProbabilities({
    deckSize: input.deckSize,
    pools: [
      {
        id: 'one-card-starters',
        label: '一卡动',
        copies: input.oneCardStarterCopies,
      },
      {
        id: 'selected-two-card-starter',
        label: input.selectedTwoCardStarter.name,
        copies: input.selectedTwoCardStarter.copies,
      },
      {
        id: 'selected-two-card-supplements',
        label: `${input.selectedTwoCardStarter.name} 的补点`,
        copies: input.twoCardSupplementCopies,
      },
    ],
    recipes: [
      {
        id: 'one-card-starter',
        label: '任意一卡动',
        requirements: [{ poolId: 'one-card-starters', count: 1 }],
      },
      {
        id: 'selected-two-card-combo',
        label: `${input.selectedTwoCardStarter.name} + 任意补点`,
        requirements: [
          { poolId: 'selected-two-card-starter', count: 1 },
          { poolId: 'selected-two-card-supplements', count: 1 },
        ],
      },
    ],
  })
}
