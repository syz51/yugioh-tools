import type { OpeningHandCalculationResult } from '../../../lib/opening-hand-calculator'
import type { TwoCardStarterRow } from '../types'

const OPENING_HAND_SIZE = 5

type DeckEntry = {
  id: string
  copies: number
}

type NormalizedTwoCardStarterRow = {
  id: string
  mainCardId: string
  supplementCardIds: string[]
}

export interface CombinedStarterRateInput {
  deckEntries: DeckEntry[]
  deckSize: number
  oneCardStarterIds: string[]
  twoCardStarterRows: TwoCardStarterRow[]
}

export function calculateCombinedStarterRate(
  input: CombinedStarterRateInput,
): OpeningHandCalculationResult | null {
  if (input.deckSize <= 0) {
    return null
  }

  const normalizedDeckEntries = input.deckEntries.filter(
    (entry) => Number.isInteger(entry.copies) && entry.copies > 0,
  )
  const copiesById = new Map(
    normalizedDeckEntries.map((entry) => [entry.id, entry.copies]),
  )
  const oneCardStarterIds = [...new Set(input.oneCardStarterIds)].filter((id) =>
    copiesById.has(id),
  )
  const oneCardStarterIdSet = new Set(oneCardStarterIds)
  const twoCardStarterRows = normalizeTwoCardStarterRows(
    input.twoCardStarterRows,
    copiesById,
    oneCardStarterIdSet,
  )

  if (oneCardStarterIds.length === 0 && twoCardStarterRows.length === 0) {
    return null
  }

  const relevantIds = collectRelevantIds(oneCardStarterIds, twoCardStarterRows)
  const relevantEntries = relevantIds.map((id) => ({
    copies: copiesById.get(id) ?? 0,
    id,
  }))
  const totalRelevantCopies = relevantEntries.reduce(
    (sum, entry) => sum + entry.copies,
    0,
  )
  const fillerCards = input.deckSize - totalRelevantCopies

  if (fillerCards < 0) {
    throw new Error('Configured starter pools exceed the deck size.')
  }

  const denominator = choose(input.deckSize, OPENING_HAND_SIZE)
  if (denominator === 0) {
    return null
  }

  const relevantIndexById = new Map(
    relevantIds.map((id, index) => [id, index] as const),
  )
  const drawnCounts = Array.from({ length: relevantEntries.length }, () => 0)
  const recipeProbabilities = [
    ...(oneCardStarterIds.length > 0
      ? [
          {
            label: '任意一卡动',
            openingHandProbability: 0,
            recipeId: 'one-card-starters',
          },
        ]
      : []),
    ...twoCardStarterRows.map((row) => ({
      label: buildTwoCardRowLabel(row),
      openingHandProbability: 0,
      recipeId: row.id,
    })),
  ]

  let openingHandProbability = 0

  function visit(index: number, remaining: number, combinations: number) {
    if (index === relevantEntries.length) {
      if (remaining > fillerCards) {
        return
      }

      const probability =
        (combinations * choose(fillerCards, remaining)) / denominator

      if (probability === 0) {
        return
      }

      let opensAnyRecipe = false

      if (oneCardStarterIds.length > 0) {
        const opensOneCard = oneCardStarterIds.some(
          (id) => drawnCounts[relevantIndexById.get(id) ?? -1] > 0,
        )

        if (opensOneCard) {
          recipeProbabilities[0].openingHandProbability += probability
          opensAnyRecipe = true
        }
      }

      const rowOffset = oneCardStarterIds.length > 0 ? 1 : 0

      for (const [rowIndex, row] of twoCardStarterRows.entries()) {
        const mainIndex = relevantIndexById.get(row.mainCardId)
        if (mainIndex === undefined || drawnCounts[mainIndex] === 0) {
          continue
        }

        const hasSupplement = row.supplementCardIds.some((id) => {
          const supplementIndex = relevantIndexById.get(id)
          return (
            supplementIndex !== undefined && drawnCounts[supplementIndex] > 0
          )
        })

        if (!hasSupplement) {
          continue
        }

        recipeProbabilities[rowOffset + rowIndex].openingHandProbability +=
          probability
        opensAnyRecipe = true
      }

      if (opensAnyRecipe) {
        openingHandProbability += probability
      }

      return
    }

    const entry = relevantEntries[index]
    const maxDraws = Math.min(entry.copies, remaining)

    for (let drawn = 0; drawn <= maxDraws; drawn += 1) {
      drawnCounts[index] = drawn
      visit(
        index + 1,
        remaining - drawn,
        combinations * choose(entry.copies, drawn),
      )
    }

    drawnCounts[index] = 0
  }

  visit(0, OPENING_HAND_SIZE, 1)

  return {
    deckSize: input.deckSize,
    drawEffectGain: 0,
    fillerCards,
    openingHandProbability,
    openingHandSize: OPENING_HAND_SIZE,
    recipeProbabilities: recipeProbabilities.map((recipe) => ({
      ...recipe,
      resolvedProbability: recipe.openingHandProbability,
    })),
    resolvedProbability: openingHandProbability,
  }
}

function normalizeTwoCardStarterRows(
  rows: TwoCardStarterRow[],
  copiesById: Map<string, number>,
  oneCardStarterIdSet: Set<string>,
) {
  const normalizedRows: NormalizedTwoCardStarterRow[] = []
  const usedMainCardIds = new Set<string>()

  for (const row of rows) {
    const mainCardId =
      row.mainCardId &&
      copiesById.has(row.mainCardId) &&
      !oneCardStarterIdSet.has(row.mainCardId) &&
      !usedMainCardIds.has(row.mainCardId)
        ? row.mainCardId
        : null

    if (!mainCardId) {
      continue
    }

    const supplementCardIds = [...new Set(row.supplementCardIds)].filter(
      (id) =>
        id !== mainCardId && !oneCardStarterIdSet.has(id) && copiesById.has(id),
    )

    if (supplementCardIds.length === 0) {
      continue
    }

    usedMainCardIds.add(mainCardId)
    normalizedRows.push({
      id: row.id,
      mainCardId,
      supplementCardIds,
    })
  }

  return normalizedRows
}

function collectRelevantIds(
  oneCardStarterIds: string[],
  twoCardStarterRows: NormalizedTwoCardStarterRow[],
) {
  const relevantIds = new Set(oneCardStarterIds)

  for (const row of twoCardStarterRows) {
    relevantIds.add(row.mainCardId)

    for (const supplementCardId of row.supplementCardIds) {
      relevantIds.add(supplementCardId)
    }
  }

  return [...relevantIds]
}

function buildTwoCardRowLabel(row: NormalizedTwoCardStarterRow) {
  return `${row.mainCardId} + ${row.supplementCardIds.length} 张搭配卡`
}

const chooseCache = new Map<string, number>()

function choose(n: number, k: number) {
  if (k < 0 || k > n) {
    return 0
  }
  if (k === 0 || k === n) {
    return 1
  }

  const normalizedK = Math.min(k, n - k)
  const cacheKey = `${n}:${normalizedK}`
  const cached = chooseCache.get(cacheKey)

  if (cached !== undefined) {
    return cached
  }

  let result = 1

  for (let index = 1; index <= normalizedK; index += 1) {
    result *= (n - normalizedK + index) / index
  }

  chooseCache.set(cacheKey, result)
  return result
}
