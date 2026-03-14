import type { OpeningHandCalculationResult } from '../../lib/opening-hand-calculator'
import type { DeckSection } from '../../lib/ydk'
import type { DeckCardLookup } from '../../lib/ygocdb'

export type DeckCardView = {
  id: string
  copies: number
  status: DeckCardLookup['status']
  name: string
  searchAliases: string[]
  imageUrl: string | null
  details: string[]
}

export type DeckSectionView = {
  key: DeckSection
  label: string
  totalCards: number
  entries: DeckCardView[]
}

export type DeckView = {
  createdBy: string | null
  importedAt: string
  sourceName: string | null
  warnings: string[]
  uniqueCards: number
  missingCards: number
  sections: DeckSectionView[]
}

export type DeckAnalysisPayload = {
  deckView: DeckView
  mainDeckSize: number
}

export type DeckAnalysisRecord = {
  id: string
  deckText: string
  sourceName: string | null
  createdAt: string
  payload: DeckAnalysisPayload
}

export type DeckSortKey = 'name' | 'copies' | 'id' | 'details'
export type DeckViewMode = 'table' | 'compact-main'

export type DeckImportModel = {
  clearWorkspace: () => void
  draftText: string
  errorMessage: string | null
  handleFileSelection: (file: File) => Promise<void>
  importDeck: (deckText: string, sourceName: string | null) => Promise<void>
  isLoading: boolean
  loadSampleDeck: () => void
  setDraftText: (value: string) => void
  sourceName: string | null
}

export type DeckAnalysisModel = {
  combinedStarterResult: OpeningHandCalculationResult | null
  deckView: DeckView
  mainDeckEntries: DeckCardView[]
  mainDeckSize: number
  maxTwoCardSupplementCopies: number
  selectedOneCardStarterEntries: DeckCardView[]
  selectedOneCardStarterIds: string[]
  selectedTwoCardStarterEntries: DeckCardView[]
  selectedTwoCardStarterIds: string[]
  sourceName: string | null
  starterCopies: number
  twoCardSupplementCopies: number
  clearTwoCardStarterSelections: () => void
  toggleOneCardStarterSelection: (value: string) => void
  toggleTwoCardStarterSelection: (value: string) => void
  updateTwoCardSupplementCopies: (value: number) => void
}
