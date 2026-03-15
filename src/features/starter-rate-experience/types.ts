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

export type TwoCardStarterRow = {
  id: string
  mainCardId: string | null
  supplementCardIds: string[]
}

export type AnalysisSelectionRow = {
  mainCardId: string | null
  supplementCardIds: string[]
}

export type AnalysisSelectionState = {
  version: 1
  oneCardStarterIds: string[]
  twoCardStarterRows: AnalysisSelectionRow[]
}

export type AnalysisSelectionLocalCache = {
  version: 1
  workingCfg: string
  state: AnalysisSelectionState
}

export type PersistedAnalysisSelectionConfig = {
  cfg: string
  analysisId: string
  payload: AnalysisSelectionState
  createdAt: string
  updatedAt: string
}

export type TwoCardStarterRowView = TwoCardStarterRow & {
  mainEntry: DeckCardView | null
  supplementEntries: DeckCardView[]
}

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
  restoreNotice: string | null
  selectedOneCardStarterEntries: DeckCardView[]
  selectedOneCardStarterIds: string[]
  sourceName: string | null
  starterCopies: number
  twoCardStarterRows: TwoCardStarterRowView[]
  addTwoCardStarterRow: () => void
  clearTwoCardStarterRowSupplements: (rowId: string) => void
  removeTwoCardStarterRow: (rowId: string) => void
  toggleOneCardStarterSelection: (value: string) => void
  toggleTwoCardStarterRowSupplement: (rowId: string, value: string) => void
  updateTwoCardStarterRowMainCard: (rowId: string, value: string | null) => void
}
