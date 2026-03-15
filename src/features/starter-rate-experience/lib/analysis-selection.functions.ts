import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { isValidCfg, parseAnalysisSelectionState } from './analysis-selection-state'
import type { AnalysisSelectionState } from '../types'

const analysisSelectionStateSchema = z.custom<AnalysisSelectionState>(
  (value) => parseAnalysisSelectionState(value) !== null,
)

const getAnalysisSelectionConfigInput = z.object({
  analysisId: z.string().trim().min(1).max(128),
  cfg: z.string().trim().min(1).max(32).refine(isValidCfg),
})

const upsertAnalysisSelectionConfigInput = z.object({
  analysisId: z.string().trim().min(1).max(128),
  cfg: z.string().trim().min(1).max(32).refine(isValidCfg),
  state: analysisSelectionStateSchema,
})

export const getAnalysisSelectionConfig = createServerFn({ method: 'GET' })
  .inputValidator(getAnalysisSelectionConfigInput)
  .handler(async ({ data }) => {
    const { getPersistedAnalysisSelectionConfig } = await import(
      './analysis-selection.server'
    )

    return getPersistedAnalysisSelectionConfig(data)
  })

export const upsertAnalysisSelectionConfig = createServerFn({ method: 'POST' })
  .inputValidator(upsertAnalysisSelectionConfigInput)
  .handler(async ({ data }) => {
    const { upsertPersistedAnalysisSelectionConfig } = await import(
      './analysis-selection.server'
    )

    return upsertPersistedAnalysisSelectionConfig(data)
  })
