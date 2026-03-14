import '@tanstack/react-start/server-only'
import { inArray } from 'drizzle-orm'
import { db } from '../db'
import { cardCache } from '../db/schema'
import { mapWithConcurrencyLimit } from './map-with-concurrency'
import type { DeckCardLookup } from './ygocdb'
import { DEFAULT_CARD_FETCH_CONCURRENCY } from './ygocdb'
import { loadDeckCardFromYgocdb } from './ygocdb-upstream.server'

type DeckCardLookupRecord = Partial<Record<string, DeckCardLookup>>

export type LookupDeckCardsInput = {
  cardIds: string[]
  concurrency?: number
}

const MAX_CARD_FETCH_CONCURRENCY = 16

export async function lookupDeckCards({
  cardIds,
  concurrency,
}: LookupDeckCardsInput) {
  const uniqueIds = [...new Set(cardIds)]
  const fetchConcurrency = Math.min(
    concurrency ?? DEFAULT_CARD_FETCH_CONCURRENCY,
    MAX_CARD_FETCH_CONCURRENCY,
  )

  if (uniqueIds.length === 0) {
    return {}
  }

  const cachedRows = await db
    .select()
    .from(cardCache)
    .where(inArray(cardCache.cardId, uniqueIds))

  const lookups: DeckCardLookupRecord = Object.create(null)
  for (const row of cachedRows) {
    if (lookups[row.cardId] != null) {
      continue
    }

    lookups[row.cardId] = {
      id: row.cardId,
      status: 'ready',
      card: row.payload,
    }
  }

  const missingIds = uniqueIds.filter((cardId) => lookups[cardId] == null)
  if (missingIds.length === 0) {
    return lookups
  }

  const fetchedLookups = await mapWithConcurrencyLimit(
    missingIds,
    fetchConcurrency,
    async (cardId) => [cardId, await loadDeckCardFromYgocdb(cardId)] as const,
  )

  const cardsToCache = fetchedLookups.flatMap(([cardId, lookup]) =>
    lookup.status === 'ready'
      ? [
          {
            cacheKey: cardId,
            cardId,
            payload: lookup.card,
            cachedAt: new Date(),
          },
        ]
      : [],
  )

  if (cardsToCache.length > 0) {
    await db.insert(cardCache).values(cardsToCache).onConflictDoNothing()
  }

  for (const [cardId, lookup] of fetchedLookups) {
    lookups[cardId] = lookup
  }

  return lookups
}
