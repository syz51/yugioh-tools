import {
  collapseDeckSection,
  getDeckConstructionError,
} from '../../../lib/ydk'
import type { ParsedYdkDeck } from '../../../lib/ydk'
import type { DeckCardLookup } from '../../../lib/ygocdb'
import {
  APP_LOCALE,
  getCardImageUrl,
  getLocalizedCardDetails,
  getPreferredCardName,
} from '../../../lib/ygocdb'
import { MAX_UPLOAD_BYTES, SECTION_LABELS, SECTION_ORDER } from './constants'
import type { DeckCardView, DeckSortKey, DeckView } from '../types'

export function buildDeckView(
  parsedDeck: ParsedYdkDeck,
  lookup: Map<string, DeckCardLookup>,
  sourceName: string | null,
): DeckView {
  const sections = SECTION_ORDER.map((section) => {
    const cards = collapseDeckSection(parsedDeck.sections[section]).map(
      (entry) => {
        const lookupEntry = lookup.get(entry.id)

        if (!lookupEntry || lookupEntry.status === 'missing') {
          return {
            id: entry.id,
            copies: entry.copies,
            status: 'missing' as const,
            name: `未识别卡片 ${entry.id}`,
            imageUrl: null,
            details: [
              lookupEntry?.message ?? `未返回卡号 ${entry.id} 的卡片资料。`,
            ],
          }
        }

        return {
          id: entry.id,
          copies: entry.copies,
          status: 'ready' as const,
          name: getPreferredCardName(lookupEntry.card, entry.id),
          imageUrl: getCardImageUrl(entry.id),
          details: getLocalizedCardDetails(lookupEntry.card),
        }
      },
    )

    return {
      key: section,
      label: SECTION_LABELS[section],
      totalCards: parsedDeck.sections[section].length,
      entries: cards,
    }
  })

  return {
    createdBy: parsedDeck.createdBy,
    importedAt: new Intl.DateTimeFormat(APP_LOCALE, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date()),
    sourceName,
    warnings: parsedDeck.warnings,
    uniqueCards: lookup.size,
    missingCards: [...lookup.values()].filter(
      (entry) => entry.status === 'missing',
    ).length,
    sections,
  }
}

export function getTotalCards(deckView: DeckView) {
  return deckView.sections.reduce((sum, section) => sum + section.totalCards, 0)
}

export function getDeckImportLimitError(
  parsedDeck: ParsedYdkDeck,
  deckText: string,
) {
  const textBytes = new TextEncoder().encode(deckText).length
  if (textBytes > MAX_UPLOAD_BYTES) {
    return `粘贴的卡组文本过大，请控制在 ${formatByteLimit(
      MAX_UPLOAD_BYTES,
    )} 以内。`
  }

  return getDeckConstructionError(parsedDeck)
}

export function formatByteLimit(bytes: number) {
  return `${Math.round(bytes / 1024)} KB`
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function clampStarterCopies(value: number, mainDeckSize: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(mainDeckSize, Math.floor(value)))
}

export function sortDeckEntries(
  entries: DeckCardView[],
  sortKey: DeckSortKey,
  sortDirection: 'asc' | 'desc',
) {
  const direction = sortDirection === 'asc' ? 1 : -1

  return [...entries].sort((left, right) => {
    let comparison = 0

    if (sortKey === 'copies') {
      comparison = left.copies - right.copies
    } else if (sortKey === 'id') {
      comparison = left.id.localeCompare(right.id, APP_LOCALE, {
        numeric: true,
      })
    } else if (sortKey === 'details') {
      comparison = left.details
        .join(' ')
        .localeCompare(right.details.join(' '), APP_LOCALE)
    } else {
      comparison = left.name.localeCompare(right.name, APP_LOCALE)
    }

    if (comparison === 0) {
      comparison = left.name.localeCompare(right.name, APP_LOCALE)
    }

    if (comparison === 0) {
      comparison = left.id.localeCompare(right.id, APP_LOCALE, {
        numeric: true,
      })
    }

    return comparison * direction
  })
}

export function getSortDirectionMark(direction: 'asc' | 'desc') {
  return direction === 'asc' ? '↑' : '↓'
}
