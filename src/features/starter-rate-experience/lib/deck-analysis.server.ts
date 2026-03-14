import '@tanstack/react-start/server-only'
import { eq } from 'drizzle-orm'
import { getDeckCardCount, getDeckCardIds, parseYdk } from '../../../lib/ydk'
import { db } from '../../../db'
import { deckAnalysis } from '../../../db/schema'
import { lookupDeckCards } from '../../../lib/ygocdb-cache.server'
import { CARD_FETCH_CONCURRENCY } from './constants'
import {
  buildDeckAnalysisPayload,
  buildDeckView,
  getDeckImportLimitError,
} from './utils'
import type { DeckAnalysisRecord } from '../types'

export async function createPersistedDeckAnalysis({
  deckText,
  sourceName,
}: {
  deckText: string
  sourceName: string | null
}) {
  const parsedDeck = parseYdk(deckText)
  const totalCards = getDeckCardCount(parsedDeck)
  const limitError = getDeckImportLimitError(parsedDeck, deckText)

  if (totalCards === 0) {
    throw new Error(
      '卡组内容为空。请上传 .ydk 文件，或粘贴包含 main、extra、side 段落的有效 YDK 文本。',
    )
  }

  if (limitError) {
    throw new Error(limitError)
  }

  const importedAt = new Date()
  const cardLookup = await lookupDeckCards({
    cardIds: getDeckCardIds(parsedDeck),
    concurrency: CARD_FETCH_CONCURRENCY,
  })
  const lookupMap = new Map(
    Object.entries(cardLookup).flatMap(([cardId, lookup]) =>
      lookup ? [[cardId, lookup] as const] : [],
    ),
  )
  const nextDeckView = buildDeckView(
    parsedDeck,
    lookupMap,
    sourceName,
    importedAt,
  )
  const payload = buildDeckAnalysisPayload(nextDeckView)

  const [row] = await db
    .insert(deckAnalysis)
    .values({
      id: crypto.randomUUID(),
      deckText,
      sourceName,
      payload,
      createdAt: importedAt,
    })
    .returning()

  const analysis = serializeDeckAnalysisRecord(row)

  return {
    analysis,
    analysisId: analysis.id,
  }
}

export async function getPersistedDeckAnalysisById(analysisId: string) {
  const row = await db.query.deckAnalysis.findFirst({
    where: eq(deckAnalysis.id, analysisId),
  })

  if (!row) {
    return null
  }

  return serializeDeckAnalysisRecord(row)
}

function serializeDeckAnalysisRecord(
  row: typeof deckAnalysis.$inferSelect,
): DeckAnalysisRecord {
  return {
    id: row.id,
    deckText: row.deckText,
    sourceName: row.sourceName,
    createdAt: row.createdAt.toISOString(),
    payload: row.payload,
  }
}
