import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const createDeckAnalysisInput = z.object({
  deckText: z.string().trim().min(1),
  sourceName: z.string().trim().min(1).max(255).nullable(),
})

const getDeckAnalysisInput = z.object({
  analysisId: z.string().trim().min(1).max(128),
})

export const createDeckAnalysis = createServerFn({ method: 'POST' })
  .inputValidator(createDeckAnalysisInput)
  .handler(async ({ data }) => {
    const { createPersistedDeckAnalysis } = await import('./deck-analysis.server')

    return createPersistedDeckAnalysis(data)
  })

export const getDeckAnalysis = createServerFn({ method: 'GET' })
  .inputValidator(getDeckAnalysisInput)
  .handler(async ({ data }) => {
    const { getPersistedDeckAnalysisById } = await import(
      './deck-analysis.server'
    )

    return getPersistedDeckAnalysisById(data.analysisId)
  })
