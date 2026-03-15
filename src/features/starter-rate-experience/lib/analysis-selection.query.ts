import { queryOptions } from '@tanstack/react-query'
import { getAnalysisSelectionConfig } from './analysis-selection.functions'

export const ANALYSIS_SELECTION_STALE_TIME = 2 * 60 * 1000
export const ANALYSIS_SELECTION_GC_TIME = 10 * 60 * 1000

export const analysisSelectionConfigKeys = {
  all: ['analysis-selection'] as const,
  detail: (analysisId: string, cfg: string) =>
    [...analysisSelectionConfigKeys.all, analysisId, cfg] as const,
}

export function analysisSelectionConfigQueryOptions(
  analysisId: string,
  cfg: string,
) {
  return queryOptions({
    queryKey: analysisSelectionConfigKeys.detail(analysisId, cfg),
    queryFn: () =>
      getAnalysisSelectionConfig({
        data: {
          analysisId,
          cfg,
        },
      }),
    staleTime: ANALYSIS_SELECTION_STALE_TIME,
    gcTime: ANALYSIS_SELECTION_GC_TIME,
  })
}
