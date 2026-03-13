import '@tanstack/react-start/server-only'
import { eq } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { inflateRawSync } from 'node:zlib'
import { cardCache, ygocdbSyncState } from '../db/schema'
import type { YgocdbCard } from './ygocdb'

const CARDS_ARCHIVE_SOURCE = 'cards.zip'
const CARDS_ARCHIVE_URL = 'https://ygocdb.com/api/v0/cards.zip'
const CARDS_ARCHIVE_MD5_URL = 'https://ygocdb.com/api/v0/cards.zip.md5'
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50
const ZIP_COMPRESSION_METHOD_STORE = 0
const ZIP_COMPRESSION_METHOD_DEFLATE = 8
const INSERT_CHUNK_SIZE = 500
const CARDS_JSON_FILE_NAME = 'cards.json'

type ImportedCardRow = {
  cacheKey: string
  cardId: string
  payload: YgocdbCard
  cachedAt: Date
}

type SyncStateRow = typeof ygocdbSyncState.$inferSelect
type SyncStateInsert = typeof ygocdbSyncState.$inferInsert
type CardCacheInsertRows = {
  values: (rows: ImportedCardRow[]) => Promise<unknown>
}
type SyncStateInsertRow = {
  values: (row: SyncStateInsert) => {
    onConflictDoUpdate: (config: {
      target: unknown
      set: Partial<SyncStateInsert>
    }) => Promise<unknown>
  }
}

export type SyncTransactionClient = {
  delete: (table: typeof cardCache) => Promise<unknown>
  insert: ((table: typeof cardCache) => CardCacheInsertRows) &
    ((table: typeof ygocdbSyncState) => SyncStateInsertRow)
}

export type SyncDbClient = {
  select: () => {
    from: (table: typeof ygocdbSyncState) => {
      where: (condition: unknown) => {
        limit: (count: number) => Promise<SyncStateRow[]>
      }
    }
  }
  update: (table: typeof ygocdbSyncState) => {
    set: (values: Pick<SyncStateInsert, 'checkedAt'>) => {
      where: (condition: unknown) => Promise<unknown>
    }
  }
  transaction: <T>(
    callback: (tx: SyncTransactionClient) => Promise<T>,
  ) => Promise<T>
}

type SyncAllCardsOptions = {
  dbClient?: SyncDbClient
  fetchImpl?: typeof fetch
  now?: () => Date
}

export type YgocdbCardSyncResult = {
  source: typeof CARDS_ARCHIVE_SOURCE
  status: 'skipped' | 'synced'
  md5: string
  previousMd5: string | null
  rowCount: number
  checkedAt: string
  syncedAt: string | null
}

export async function syncAllCardsFromYgocdb(
  options: SyncAllCardsOptions = {},
): Promise<YgocdbCardSyncResult> {
  const dbClient = options.dbClient ?? (await getDbClient())
  const fetchImpl = options.fetchImpl ?? fetch
  const getNow = options.now ?? (() => new Date())
  const remoteMd5 = await fetchCardsArchiveMd5(fetchImpl)
  const existingRows = await dbClient
    .select()
    .from(ygocdbSyncState)
    .where(eq(ygocdbSyncState.source, CARDS_ARCHIVE_SOURCE))
    .limit(1)
  const existingState = existingRows.at(0) ?? null

  if (existingState?.md5 === remoteMd5) {
    const checkedAt = getNow()

    await dbClient
      .update(ygocdbSyncState)
      .set({ checkedAt })
      .where(eq(ygocdbSyncState.source, CARDS_ARCHIVE_SOURCE))

    return {
      source: CARDS_ARCHIVE_SOURCE,
      status: 'skipped',
      md5: remoteMd5,
      previousMd5: existingState.md5,
      rowCount: existingState.rowCount,
      checkedAt: checkedAt.toISOString(),
      syncedAt: existingState.syncedAt.toISOString(),
    }
  }

  const cardsArchive = await fetchCardsArchive(remoteMd5, fetchImpl)
  const importedCards = parseCardsArchive(cardsArchive)
  const now = getNow()

  await dbClient.transaction(async (tx) => {
    await tx.delete(cardCache)

    for (const cardChunk of chunkItems(importedCards, INSERT_CHUNK_SIZE)) {
      await tx.insert(cardCache).values(cardChunk)
    }

    await tx
      .insert(ygocdbSyncState)
      .values({
        source: CARDS_ARCHIVE_SOURCE,
        md5: remoteMd5,
        rowCount: importedCards.length,
        checkedAt: now,
        syncedAt: now,
      })
      .onConflictDoUpdate({
        target: ygocdbSyncState.source,
        set: {
          md5: remoteMd5,
          rowCount: importedCards.length,
          checkedAt: now,
          syncedAt: now,
        },
      })
  })

  return {
    source: CARDS_ARCHIVE_SOURCE,
    status: 'synced',
    md5: remoteMd5,
    previousMd5: existingState?.md5 ?? null,
    rowCount: importedCards.length,
    checkedAt: now.toISOString(),
    syncedAt: now.toISOString(),
  }
}

async function getDbClient(): Promise<SyncDbClient> {
  const { db } = await import('../db')

  return db as unknown as SyncDbClient
}

async function fetchCardsArchiveMd5(fetchImpl: typeof fetch) {
  const response = await fetchImpl(CARDS_ARCHIVE_MD5_URL)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${CARDS_ARCHIVE_SOURCE} MD5: ${response.status} ${response.statusText}`,
    )
  }

  const body = await response.text()
  const md5 = normalizeMd5(body)

  return md5
}

async function fetchCardsArchive(expectedMd5: string, fetchImpl: typeof fetch) {
  const response = await fetchImpl(CARDS_ARCHIVE_URL)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${CARDS_ARCHIVE_SOURCE}: ${response.status} ${response.statusText}`,
    )
  }

  const archiveBuffer = Buffer.from(await response.arrayBuffer())
  const { fileBuffer, fileName } = extractJsonFromZipArchive(archiveBuffer)
  const archiveMd5 = createHash('md5').update(fileBuffer).digest('hex')

  if (archiveMd5 !== expectedMd5) {
    throw new Error(
      `Downloaded ${CARDS_ARCHIVE_SOURCE} failed MD5 verification: expected ${expectedMd5}, got ${archiveMd5}.`,
    )
  }

  if (fileName !== CARDS_JSON_FILE_NAME) {
    throw new Error(
      `Invalid ${CARDS_ARCHIVE_SOURCE}: expected ${CARDS_JSON_FILE_NAME}, got ${fileName}.`,
    )
  }

  return fileBuffer.toString('utf8')
}

function normalizeMd5(value: string) {
  const md5 = value.trim().replace(/^"|"$/g, '').toLowerCase()

  if (!/^[a-f0-9]{32}$/.test(md5)) {
    throw new Error(
      `YGOCDB returned an invalid MD5 for ${CARDS_ARCHIVE_SOURCE}.`,
    )
  }

  return md5
}

function extractJsonFromZipArchive(archiveBuffer: Buffer) {
  if (archiveBuffer.length < 30) {
    throw new Error(
      `Invalid ${CARDS_ARCHIVE_SOURCE}: missing ZIP local file header.`,
    )
  }

  const signature = archiveBuffer.readUInt32LE(0)
  if (signature !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error(
      `Invalid ${CARDS_ARCHIVE_SOURCE}: unsupported ZIP signature.`,
    )
  }

  const compressionMethod = archiveBuffer.readUInt16LE(8)
  const compressedSize = archiveBuffer.readUInt32LE(18)
  const uncompressedSize = archiveBuffer.readUInt32LE(22)
  const fileNameLength = archiveBuffer.readUInt16LE(26)
  const extraFieldLength = archiveBuffer.readUInt16LE(28)

  const fileNameStart = 30
  const fileNameEnd = fileNameStart + fileNameLength
  const dataStart = fileNameEnd + extraFieldLength
  const dataEnd = dataStart + compressedSize

  if (dataEnd > archiveBuffer.length) {
    throw new Error(
      `Invalid ${CARDS_ARCHIVE_SOURCE}: compressed entry exceeds archive length.`,
    )
  }

  const fileName = archiveBuffer
    .subarray(fileNameStart, fileNameEnd)
    .toString('utf8')
  const compressedData = archiveBuffer.subarray(dataStart, dataEnd)

  let fileBuffer: Buffer

  if (compressionMethod === ZIP_COMPRESSION_METHOD_STORE) {
    fileBuffer = Buffer.from(compressedData)
  } else if (compressionMethod === ZIP_COMPRESSION_METHOD_DEFLATE) {
    fileBuffer = inflateRawSync(compressedData)
  } else {
    throw new Error(
      `Invalid ${CARDS_ARCHIVE_SOURCE}: unsupported ZIP compression method ${compressionMethod}.`,
    )
  }

  if (fileBuffer.length !== uncompressedSize) {
    throw new Error(
      `Invalid ${CARDS_ARCHIVE_SOURCE}: expected ${uncompressedSize} bytes for ${fileName}, got ${fileBuffer.length}.`,
    )
  }

  return { fileBuffer, fileName }
}

function parseCardsArchive(archiveJson: string) {
  const parsed = JSON.parse(archiveJson) as unknown
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `Invalid ${CARDS_ARCHIVE_SOURCE}: cards.json must be an object.`,
    )
  }

  const now = new Date()
  const importedCards: ImportedCardRow[] = []

  for (const [archiveKey, value] of Object.entries(parsed)) {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(
        `Invalid cards.json entry "${archiveKey}": expected an object.`,
      )
    }

    const card = value as Partial<YgocdbCard>

    if (card.id == null || card.text == null || card.data == null) {
      throw new Error(
        `Invalid cards.json entry "${archiveKey}": missing required card fields.`,
      )
    }

    if (archiveKey.length === 0) {
      throw new Error(
        `Invalid ${CARDS_ARCHIVE_SOURCE}: cards.json contains an empty key.`,
      )
    }

    const cardId = String(card.id)
    importedCards.push({
      cacheKey: archiveKey,
      cardId,
      payload: card as YgocdbCard,
      cachedAt: now,
    })
  }

  if (importedCards.length === 0) {
    throw new Error(
      `Invalid ${CARDS_ARCHIVE_SOURCE}: cards.json contained no cards.`,
    )
  }

  return importedCards
}

function chunkItems<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}
