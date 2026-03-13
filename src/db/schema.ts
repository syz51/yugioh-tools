import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import type { YgocdbCard } from '../lib/ygocdb'

export const cardCache = pgTable('card_cache', {
  cardId: text('card_id').primaryKey(),
  payload: jsonb('payload').$type<YgocdbCard>().notNull(),
  cachedAt: timestamp('cached_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})
