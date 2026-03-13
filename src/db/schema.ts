import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import type { YgocdbCard } from '../lib/ygocdb'

export const cardCache = pgTable('card_cache', {
  cardId: text('card_id').primaryKey(),
  payload: jsonb('payload').$type<YgocdbCard>().notNull(),
  cachedAt: timestamp('cached_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const ygocdbSyncState = pgTable('ygocdb_sync_state', {
  source: text('source').primaryKey(),
  md5: text('md5').notNull(),
  rowCount: integer('row_count').notNull(),
  checkedAt: timestamp('checked_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})
