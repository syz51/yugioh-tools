import type { DeckSection } from '../../lib/ydk'
import type { DeckCardLookup } from '../../lib/ygocdb'

export type DeckCardView = {
  id: string
  copies: number
  status: DeckCardLookup['status']
  name: string
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

export type DeckSortKey = 'name' | 'copies' | 'id' | 'details'
export type DeckViewMode = 'table' | 'compact-main'
export type WorkbenchStage = 'landing' | 'config'
