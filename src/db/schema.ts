import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import type { DeckAnalysisPayload } from '../features/starter-rate-experience/types'
import type { YgocdbCard } from '../lib/ygocdb'

export const cardCache = pgTable(
  'card_cache',
  {
    cacheKey: text('cache_key').primaryKey(),
    cardId: text('card_id').notNull(),
    payload: jsonb('payload').$type<YgocdbCard>().notNull(),
    cachedAt: timestamp('cached_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('card_cache_card_id_idx').on(table.cardId)],
)

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

export const deckAnalysis = pgTable(
  'deck_analysis',
  {
    id: text('id').primaryKey(),
    deckText: text('deck_text').notNull(),
    sourceName: text('source_name'),
    payload: jsonb('payload').$type<DeckAnalysisPayload>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('deck_analysis_created_at_idx').on(table.createdAt)],
)
