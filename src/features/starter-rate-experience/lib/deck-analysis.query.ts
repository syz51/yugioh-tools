import { queryOptions } from '@tanstack/react-query'
import { getDeckAnalysis } from './deck-analysis.functions'

const DECK_ANALYSIS_STALE_TIME = 10 * 60 * 1000
const DECK_ANALYSIS_GC_TIME = 30 * 60 * 1000

export const deckAnalysisKeys = {
  all: ['deck-analysis'] as const,
  detail: (analysisId: string) => [...deckAnalysisKeys.all, analysisId] as const,
}

export function deckAnalysisQueryOptions(analysisId: string) {
  return queryOptions({
    queryKey: deckAnalysisKeys.detail(analysisId),
    queryFn: () =>
      getDeckAnalysis({
        data: {
          analysisId,
        },
      }),
    staleTime: DECK_ANALYSIS_STALE_TIME,
    gcTime: DECK_ANALYSIS_GC_TIME,
  })
}
