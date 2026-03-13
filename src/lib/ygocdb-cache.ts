import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { DeckCardLookup } from './ygocdb'
import { DEFAULT_CARD_FETCH_CONCURRENCY } from './ygocdb'
import { mapWithConcurrencyLimit } from './map-with-concurrency'

type DeckCardLookupRecord = Partial<Record<string, DeckCardLookup>>
const MAX_CARD_FETCH_CONCURRENCY = 16

const lookupDeckCardsInput = z.object({
  cardIds: z.array(z.string().trim().min(1)).max(500),
  concurrency: z
    .number()
    .int()
    .min(1)
    .max(MAX_CARD_FETCH_CONCURRENCY)
    .optional(),
})

export const getDeckCards = createServerFn({ method: 'POST' })
  .inputValidator(lookupDeckCardsInput)
  .handler(async ({ data }) => {
    const uniqueIds = [...new Set(data.cardIds)]
    const fetchConcurrency = Math.min(
      data.concurrency ?? DEFAULT_CARD_FETCH_CONCURRENCY,
      MAX_CARD_FETCH_CONCURRENCY,
    )
    if (uniqueIds.length === 0) {
      return {}
    }

    const [{ inArray }, { db }, { cardCache }, { loadDeckCardFromYgocdb }] =
      await Promise.all([
        import('drizzle-orm'),
        import('../db'),
        import('../db/schema'),
        import('./ygocdb-upstream.server'),
      ])

    const cachedRows = await db
      .select()
      .from(cardCache)
      .where(inArray(cardCache.cardId, uniqueIds))

    const lookups: DeckCardLookupRecord = Object.create(null)
    for (const row of cachedRows) {
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
  })
