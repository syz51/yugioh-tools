import type { OpeningHandCalculationResult } from '../../../lib/opening-hand-calculator'
import { calculateOpeningHandProbabilities } from '../../../lib/opening-hand-calculator'

export interface CombinedStarterRateInput {
  deckSize: number
  oneCardStarterCopies: number
  selectedTwoCardStarterCopies: number
  twoCardSupplementCopies: number
}

export function calculateCombinedStarterRate(
  input: CombinedStarterRateInput,
): OpeningHandCalculationResult | null {
  const hasOneCardStarterPool = input.oneCardStarterCopies > 0
  const hasTwoCardCombo =
    input.selectedTwoCardStarterCopies > 0 && input.twoCardSupplementCopies > 0

  if (input.deckSize <= 0 || (!hasOneCardStarterPool && !hasTwoCardCombo)) {
    return null
  }

  if (hasOneCardStarterPool && !hasTwoCardCombo) {
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

  if (!hasOneCardStarterPool && hasTwoCardCombo) {
    return calculateOpeningHandProbabilities({
      deckSize: input.deckSize,
      pools: [
        {
          id: 'selected-two-card-starter',
          label: '已选主启动',
          copies: input.selectedTwoCardStarterCopies,
        },
        {
          id: 'selected-two-card-supplements',
          label: '补点',
          copies: input.twoCardSupplementCopies,
        },
      ],
      recipes: [
        {
          id: 'selected-two-card-combo',
          label: '任意已选主启动 + 任意补点',
          requirements: [
            { poolId: 'selected-two-card-starter', count: 1 },
            { poolId: 'selected-two-card-supplements', count: 1 },
          ],
        },
      ],
    })
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
        label: '已选主启动',
        copies: input.selectedTwoCardStarterCopies,
      },
      {
        id: 'selected-two-card-supplements',
        label: '补点',
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
        label: '任意已选主启动 + 任意补点',
        requirements: [
          { poolId: 'selected-two-card-starter', count: 1 },
          { poolId: 'selected-two-card-supplements', count: 1 },
        ],
      },
    ],
  })
}
