export interface DrawEffect {
  cardsNeededToActivate?: number
  drawsPerActivation: number
  maxActivations?: number
}

export interface CardPool {
  id: string
  label: string
  copies: number
  drawEffect?: DrawEffect
}

export interface StarterRequirement {
  poolId: string
  count: number
}

export interface StarterRecipe {
  id: string
  label: string
  requirements: StarterRequirement[]
}

export interface OpeningHandCalculationInput {
  deckSize: number
  openingHandSize?: number
  pools: CardPool[]
  recipes: StarterRecipe[]
}

export interface StarterRecipeProbability {
  recipeId: string
  label: string
  openingHandProbability: number
  resolvedProbability: number
}

export interface OpeningHandCalculationResult {
  deckSize: number
  openingHandSize: number
  fillerCards: number
  openingHandProbability: number
  resolvedProbability: number
  drawEffectGain: number
  recipeProbabilities: StarterRecipeProbability[]
}

interface PreparedPool extends Omit<CardPool, 'drawEffect'> {
  drawEffect: Required<DrawEffect> | null
}

interface PreparedRecipe {
  id: string
  label: string
  requirements: Array<{ poolIndex: number; count: number }>
}

interface DrawOutcome {
  drawn: number[]
  probability: number
}

interface PreparedState {
  deckSize: number
  openingHandSize: number
  pools: PreparedPool[]
  recipes: PreparedRecipe[]
  deckCounts: number[]
  fillerCards: number
}

export function calculateOpeningHandProbabilities(
  input: OpeningHandCalculationInput,
): OpeningHandCalculationResult {
  const prepared = prepareCalculation(input)
  const allCategoryCounts = [...prepared.deckCounts, prepared.fillerCards]
  const activationCaps = prepared.pools.map(
    (pool) => pool.drawEffect?.maxActivations ?? 0,
  )
  const outcomeCache = new Map<string, DrawOutcome[]>()
  const stateCache = new Map<string, number>()

  const recipeProbabilities = prepared.recipes.map((recipe) => ({
    recipeId: recipe.id,
    label: recipe.label,
    openingHandProbability: 0,
    resolvedProbability: 0,
  }))

  let openingHandProbability = 0
  let resolvedProbability = 0

  for (const outcome of enumerateDrawOutcomes(
    allCategoryCounts,
    prepared.openingHandSize,
    outcomeCache,
  )) {
    const handCounts = outcome.drawn.slice(0, prepared.pools.length)
    const remainingDeckCounts = prepared.deckCounts.map(
      (count, index) => count - handCounts[index],
    )
    const fillerRemaining =
      prepared.fillerCards - (outcome.drawn[prepared.pools.length] ?? 0)

    const opensAnyRecipe = prepared.recipes.some((recipe) =>
      handSatisfiesRecipe(handCounts, recipe),
    )
    if (opensAnyRecipe) {
      openingHandProbability += outcome.probability
    }

    const resolvedAnyRecipe = resolveStateProbability(
      handCounts,
      remainingDeckCounts,
      fillerRemaining,
      activationCaps,
      prepared,
      outcomeCache,
      stateCache,
      null,
    )
    resolvedProbability += outcome.probability * resolvedAnyRecipe

    for (const [index, recipe] of prepared.recipes.entries()) {
      const recipeProbability = recipeProbabilities[index]

      if (handSatisfiesRecipe(handCounts, recipe)) {
        recipeProbability.openingHandProbability += outcome.probability
      }

      const resolvedRecipe = resolveStateProbability(
        handCounts,
        remainingDeckCounts,
        fillerRemaining,
        activationCaps,
        prepared,
        outcomeCache,
        stateCache,
        recipe.id,
      )
      recipeProbability.resolvedProbability +=
        outcome.probability * resolvedRecipe
    }
  }

  return {
    deckSize:
      prepared.deckCounts.reduce((sum, count) => sum + count, 0) +
      prepared.fillerCards,
    openingHandSize: prepared.openingHandSize,
    fillerCards: prepared.fillerCards,
    openingHandProbability,
    resolvedProbability,
    drawEffectGain: resolvedProbability - openingHandProbability,
    recipeProbabilities,
  }
}

function prepareCalculation(input: OpeningHandCalculationInput): PreparedState {
  if (!Number.isInteger(input.deckSize) || input.deckSize <= 0) {
    throw new Error('Deck size must be a positive integer.')
  }

  const openingHandSize = input.openingHandSize ?? 5
  if (!Number.isInteger(openingHandSize) || openingHandSize <= 0) {
    throw new Error('Opening hand size must be a positive integer.')
  }
  if (openingHandSize > input.deckSize) {
    throw new Error('Opening hand size cannot be larger than the deck.')
  }

  const seenPoolIds = new Set<string>()
  const pools = input.pools.map<PreparedPool>((pool) => {
    if (!pool.id.trim()) {
      throw new Error('Each card pool needs an id.')
    }
    if (seenPoolIds.has(pool.id)) {
      throw new Error(`Duplicate pool id "${pool.id}".`)
    }
    seenPoolIds.add(pool.id)

    if (!Number.isInteger(pool.copies) || pool.copies < 0) {
      throw new Error(
        `Pool "${pool.label}" must use a non-negative integer copy count.`,
      )
    }

    let drawEffect: Required<DrawEffect> | null = null
    if (pool.drawEffect) {
      const cardsNeededToActivate = pool.drawEffect.cardsNeededToActivate ?? 1
      const drawsPerActivation = pool.drawEffect.drawsPerActivation
      const maxActivations = pool.drawEffect.maxActivations ?? 1

      if (
        !Number.isInteger(cardsNeededToActivate) ||
        cardsNeededToActivate <= 0
      ) {
        throw new Error(`Pool "${pool.label}" has an invalid activation cost.`)
      }
      if (!Number.isInteger(drawsPerActivation) || drawsPerActivation <= 0) {
        throw new Error(
          `Pool "${pool.label}" must draw at least one card per activation.`,
        )
      }
      if (!Number.isInteger(maxActivations) || maxActivations <= 0) {
        throw new Error(`Pool "${pool.label}" needs a positive activation cap.`)
      }

      drawEffect = {
        cardsNeededToActivate,
        drawsPerActivation,
        maxActivations,
      }
    }

    return {
      ...pool,
      drawEffect,
    }
  })

  const totalPoolCopies = pools.reduce((sum, pool) => sum + pool.copies, 0)
  if (totalPoolCopies > input.deckSize) {
    throw new Error(
      'Card pools cannot add up to more cards than the deck contains.',
    )
  }

  const poolIndexById = new Map(pools.map((pool, index) => [pool.id, index]))
  const recipes = input.recipes.map<PreparedRecipe>((recipe) => {
    const aggregatedRequirements = new Map<number, number>()

    for (const requirement of recipe.requirements) {
      if (!Number.isInteger(requirement.count) || requirement.count < 0) {
        throw new Error(
          `Recipe "${recipe.label}" has an invalid requirement count.`,
        )
      }
      if (requirement.count === 0) {
        continue
      }

      const poolIndex = poolIndexById.get(requirement.poolId)
      if (poolIndex === undefined) {
        throw new Error(
          `Recipe "${recipe.label}" references missing pool "${requirement.poolId}".`,
        )
      }

      aggregatedRequirements.set(
        poolIndex,
        (aggregatedRequirements.get(poolIndex) ?? 0) + requirement.count,
      )
    }

    const normalizedRequirements = [...aggregatedRequirements.entries()].map(
      ([poolIndex, count]) => ({
        poolIndex,
        count,
      }),
    )

    if (normalizedRequirements.length === 0) {
      throw new Error(
        `Recipe "${recipe.label}" must require at least one pool.`,
      )
    }

    return {
      id: recipe.id,
      label: recipe.label,
      requirements: normalizedRequirements,
    }
  })

  return {
    deckSize: input.deckSize,
    openingHandSize,
    pools,
    recipes,
    deckCounts: pools.map((pool) => pool.copies),
    fillerCards: input.deckSize - totalPoolCopies,
  }
}

function resolveStateProbability(
  handCounts: number[],
  remainingDeckCounts: number[],
  fillerRemaining: number,
  activationsRemaining: number[],
  prepared: PreparedState,
  outcomeCache: Map<string, DrawOutcome[]>,
  stateCache: Map<string, number>,
  targetRecipeId: string | null,
): number {
  const cacheKey = [
    targetRecipeId ?? '*',
    handCounts.join(','),
    remainingDeckCounts.join(','),
    fillerRemaining,
    activationsRemaining.join(','),
  ].join('|')

  const cached = stateCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  const relevantRecipes =
    targetRecipeId === null
      ? prepared.recipes
      : prepared.recipes.filter((recipe) => recipe.id === targetRecipeId)

  if (
    relevantRecipes.some((recipe) => handSatisfiesRecipe(handCounts, recipe))
  ) {
    stateCache.set(cacheKey, 1)
    return 1
  }

  let bestProbability = 0

  for (const [poolIndex, pool] of prepared.pools.entries()) {
    const effect = pool.drawEffect
    if (!effect) {
      continue
    }
    if ((activationsRemaining[poolIndex] ?? 0) <= 0) {
      continue
    }
    if ((handCounts[poolIndex] ?? 0) < effect.cardsNeededToActivate) {
      continue
    }

    const nextHandCounts = [...handCounts]
    nextHandCounts[poolIndex] -= effect.cardsNeededToActivate

    const nextActivationsRemaining = [...activationsRemaining]
    nextActivationsRemaining[poolIndex] -= 1

    const remainingDeckTotal = remainingDeckCounts.reduce(
      (sum, count) => sum + count,
      0,
    )
    const drawCount = Math.min(
      effect.drawsPerActivation,
      remainingDeckTotal + fillerRemaining,
    )
    const categories = [...remainingDeckCounts, fillerRemaining]

    let expectedProbability = 0
    for (const outcome of enumerateDrawOutcomes(
      categories,
      drawCount,
      outcomeCache,
    )) {
      const drawnPoolCounts = outcome.drawn.slice(0, prepared.pools.length)
      const nextRemainingDeckCounts = remainingDeckCounts.map(
        (count, index) => count - (drawnPoolCounts[index] ?? 0),
      )
      const nextFillerRemaining =
        fillerRemaining - (outcome.drawn[prepared.pools.length] ?? 0)

      const resolved = resolveStateProbability(
        addCountVectors(nextHandCounts, drawnPoolCounts),
        nextRemainingDeckCounts,
        nextFillerRemaining,
        nextActivationsRemaining,
        prepared,
        outcomeCache,
        stateCache,
        targetRecipeId,
      )
      expectedProbability += outcome.probability * resolved
    }

    if (expectedProbability > bestProbability) {
      bestProbability = expectedProbability
    }
  }

  stateCache.set(cacheKey, bestProbability)
  return bestProbability
}

function handSatisfiesRecipe(handCounts: number[], recipe: PreparedRecipe) {
  return recipe.requirements.every(
    (requirement) =>
      (handCounts[requirement.poolIndex] ?? 0) >= requirement.count,
  )
}

function addCountVectors(left: number[], right: number[]) {
  return left.map((count, index) => count + (right[index] ?? 0))
}

function enumerateDrawOutcomes(
  counts: number[],
  drawCount: number,
  cache: Map<string, DrawOutcome[]>,
): DrawOutcome[] {
  const totalCards = counts.reduce((sum, count) => sum + count, 0)
  const normalizedDrawCount = Math.min(drawCount, totalCards)
  const cacheKey = `${normalizedDrawCount}|${counts.join(',')}`
  const cached = cache.get(cacheKey)
  if (cached) {
    return cached
  }

  const results: DrawOutcome[] = []
  const denominator = choose(totalCards, normalizedDrawCount)
  const suffixTotals = new Array(counts.length).fill(0)
  for (let index = counts.length - 1; index >= 0; index -= 1) {
    suffixTotals[index] = (counts[index] ?? 0) + (suffixTotals[index + 1] ?? 0)
  }

  function visit(
    index: number,
    remainingToDraw: number,
    chosen: number[],
    combinationsProduct: number,
  ) {
    if (index === counts.length - 1) {
      if (remainingToDraw > (counts[index] ?? 0)) {
        return
      }

      const finalChoice = [...chosen, remainingToDraw]
      const probability =
        denominator === 0
          ? normalizedDrawCount === 0
            ? 1
            : 0
          : (combinationsProduct *
              choose(counts[index] ?? 0, remainingToDraw)) /
            denominator

      results.push({
        drawn: finalChoice,
        probability,
      })
      return
    }

    const cardsRemainingAfterThis = suffixTotals[index + 1] ?? 0
    const minimumFromCurrent = Math.max(
      0,
      remainingToDraw - cardsRemainingAfterThis,
    )
    const maximumFromCurrent = Math.min(counts[index] ?? 0, remainingToDraw)

    for (
      let taken = minimumFromCurrent;
      taken <= maximumFromCurrent;
      taken += 1
    ) {
      visit(
        index + 1,
        remainingToDraw - taken,
        [...chosen, taken],
        combinationsProduct * choose(counts[index] ?? 0, taken),
      )
    }
  }

  visit(0, normalizedDrawCount, [], 1)
  cache.set(cacheKey, results)
  return results
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
  const cacheKey = `${n}|${normalizedK}`
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
