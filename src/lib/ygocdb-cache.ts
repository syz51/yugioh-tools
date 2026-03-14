import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { DeckCardLookup } from './ygocdb'
import { DEFAULT_CARD_FETCH_CONCURRENCY } from './ygocdb'

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
  .handler(async ({ data }): Promise<DeckCardLookupRecord> => {
    const { lookupDeckCards } = await import('./ygocdb-cache.server')

    return lookupDeckCards({
      cardIds: data.cardIds,
      concurrency: data.concurrency ?? DEFAULT_CARD_FETCH_CONCURRENCY,
    })
  })
