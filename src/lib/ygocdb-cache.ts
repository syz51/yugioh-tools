import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { DeckCardLookup } from './ygocdb'

type DeckCardLookupRecord = Partial<Record<string, DeckCardLookup>>

const lookupDeckCardsInput = z.object({
  cardIds: z.array(z.string().trim().min(1)).max(500),
})

export const getDeckCards = createServerFn({ method: 'POST' })
  .inputValidator(lookupDeckCardsInput)
  .handler(async ({ data }) => {
    const uniqueIds = [...new Set(data.cardIds)]
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

    const fetchedLookups = await Promise.all(
      missingIds.map(
        async (cardId) => [cardId, await loadDeckCardFromYgocdb(cardId)] as const,
      ),
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
