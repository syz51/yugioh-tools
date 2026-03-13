import { createHash } from 'node:crypto'
import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { cardCache, ygocdbSyncState } from '../db/schema'
import type { SyncDbClient, SyncTransactionClient } from './ygocdb-sync.server'
import { syncAllCardsFromYgocdb } from './ygocdb-sync.server'

describe('syncAllCardsFromYgocdb', () => {
  it('imports every archive entry, validates the JSON MD5, and upserts sync state', async () => {
    const now = new Date('2026-03-13T16:00:00.000Z')
    const archiveJson = JSON.stringify({
      alpha: {
        id: 89631139,
        en_name: 'Blue-Eyes White Dragon',
        text: { desc: 'Legendary dragon.' },
        data: { atk: 3000, def: 2500 },
      },
      beta: {
        id: 0,
        en_name: 'Token A',
        text: { desc: 'Token entry A.' },
        data: { atk: 0, def: 0 },
      },
      gamma: {
        id: 0,
        en_name: 'Token B',
        text: { desc: 'Token entry B.' },
        data: { atk: 0, def: 0 },
      },
    })
    const expectedMd5 = createHash('md5').update(archiveJson).digest('hex')
    const zipBuffer = createZipArchive('cards.json', archiveJson)
    const dbHarness = createDbHarness()
    const fetchImpl = createFetchStub({
      'https://ygocdb.com/api/v0/cards.zip.md5': new Response(
        `"${expectedMd5}"`,
      ),
      'https://ygocdb.com/api/v0/cards.zip': new Response(zipBuffer),
    })

    const result = await syncAllCardsFromYgocdb({
      dbClient: dbHarness.db,
      fetchImpl,
      now: () => now,
    })

    expect(result).toEqual({
      source: 'cards.zip',
      status: 'synced',
      md5: expectedMd5,
      previousMd5: null,
      rowCount: 3,
      checkedAt: now.toISOString(),
      syncedAt: now.toISOString(),
    })
    expect(dbHarness.deletedCardCache).toBe(true)
    expect(dbHarness.cardCacheRows).toHaveLength(3)
    expect(dbHarness.cardCacheRows.map((row) => row.cacheKey)).toEqual([
      'alpha',
      'beta',
      'gamma',
    ])
    expect(dbHarness.cardCacheRows.map((row) => row.cardId)).toEqual([
      '89631139',
      '0',
      '0',
    ])
    expect(dbHarness.syncState).toEqual({
      source: 'cards.zip',
      md5: expectedMd5,
      rowCount: 3,
      checkedAt: now,
      syncedAt: now,
    })
  })

  it('skips the import when the stored MD5 already matches', async () => {
    const originalSyncedAt = new Date('2026-03-13T10:00:00.000Z')
    const now = new Date('2026-03-13T17:00:00.000Z')
    const dbHarness = createDbHarness({
      source: 'cards.zip',
      md5: 'abc123abc123abc123abc123abc123ab',
      rowCount: 99,
      checkedAt: new Date('2026-03-13T09:00:00.000Z'),
      syncedAt: originalSyncedAt,
    })
    const fetchImpl = createFetchStub({
      'https://ygocdb.com/api/v0/cards.zip.md5': new Response(
        '"abc123abc123abc123abc123abc123ab"',
      ),
    })

    const result = await syncAllCardsFromYgocdb({
      dbClient: dbHarness.db,
      fetchImpl,
      now: () => now,
    })

    expect(result).toEqual({
      source: 'cards.zip',
      status: 'skipped',
      md5: 'abc123abc123abc123abc123abc123ab',
      previousMd5: 'abc123abc123abc123abc123abc123ab',
      rowCount: 99,
      checkedAt: now.toISOString(),
      syncedAt: originalSyncedAt.toISOString(),
    })
    expect(dbHarness.deletedCardCache).toBe(false)
    expect(dbHarness.cardCacheRows).toEqual([])
    expect(dbHarness.syncState?.checkedAt).toEqual(now)
    expect(dbHarness.syncState?.syncedAt).toEqual(originalSyncedAt)
  })

  it('rejects a ZIP whose decompressed cards.json does not match the published MD5', async () => {
    const archiveJson = JSON.stringify({
      alpha: {
        id: 89631139,
        text: { desc: 'Legendary dragon.' },
        data: { atk: 3000, def: 2500 },
      },
    })
    const fetchImpl = createFetchStub({
      'https://ygocdb.com/api/v0/cards.zip.md5': new Response(
        '"00000000000000000000000000000000"',
      ),
      'https://ygocdb.com/api/v0/cards.zip': new Response(
        createZipArchive('cards.json', archiveJson),
      ),
    })

    await expect(
      syncAllCardsFromYgocdb({
        dbClient: createDbHarness().db,
        fetchImpl,
      }),
    ).rejects.toThrow(
      'Downloaded cards.zip failed MD5 verification: expected 00000000000000000000000000000000',
    )
  })
})

type CardCacheRow = typeof cardCache.$inferInsert
type SyncStateRow = typeof ygocdbSyncState.$inferSelect
type SyncStateInsert = typeof ygocdbSyncState.$inferInsert

function createDbHarness(initialState: SyncStateRow | null = null) {
  const cardCacheRows: CardCacheRow[] = []
  let syncState = initialState
  let deletedCardCache = false

  const transactionClient: SyncTransactionClient = {
    async delete() {
      deletedCardCache = true
      cardCacheRows.length = 0
    },
    insert: ((table: typeof cardCache | typeof ygocdbSyncState) => {
      if (table === cardCache) {
        return {
          async values(rows: CardCacheRow[]) {
            cardCacheRows.push(...rows)
          },
        }
      }

      if (table === ygocdbSyncState) {
        return {
          values(row: SyncStateInsert) {
            return {
              async onConflictDoUpdate(config: { set: SyncStateInsert }) {
                syncState = {
                  ...row,
                  ...config.set,
                } as SyncStateRow
              },
            }
          },
        }
      }

      throw new Error('Unexpected table')
    }) as SyncTransactionClient['insert'],
  }

  const db: SyncDbClient = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                async limit() {
                  return syncState == null ? [] : [syncState]
                },
              }
            },
          }
        },
      }
    },
    update() {
      return {
        set(values: Pick<SyncStateInsert, 'checkedAt'>) {
          return {
            async where() {
              if (syncState === null) {
                return
              }

              syncState = {
                ...syncState,
                ...values,
              }
            },
          }
        },
      }
    },
    async transaction<T>(
      callback: (tx: typeof transactionClient) => Promise<T>,
    ) {
      return callback(transactionClient)
    },
  }

  return {
    db,
    get cardCacheRows() {
      return cardCacheRows
    },
    get deletedCardCache() {
      return deletedCardCache
    },
    get syncState() {
      return syncState
    },
  }
}

function createFetchStub(responses: Partial<Record<string, Response>>) {
  return async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    const response = responses[url]

    if (response == null) {
      throw new Error(`Unexpected fetch: ${url}`)
    }

    return response.clone()
  }
}

function createZipArchive(fileName: string, contents: string) {
  const fileNameBuffer = Buffer.from(fileName, 'utf8')
  const contentsBuffer = Buffer.from(contents, 'utf8')
  const compressedBuffer = deflateRawSync(contentsBuffer)
  const header = Buffer.alloc(30)

  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(0, 6)
  header.writeUInt16LE(8, 8)
  header.writeUInt32LE(0, 10)
  header.writeUInt32LE(0, 14)
  header.writeUInt32LE(compressedBuffer.length, 18)
  header.writeUInt32LE(contentsBuffer.length, 22)
  header.writeUInt16LE(fileNameBuffer.length, 26)
  header.writeUInt16LE(0, 28)

  return Buffer.concat([header, fileNameBuffer, compressedBuffer])
}
