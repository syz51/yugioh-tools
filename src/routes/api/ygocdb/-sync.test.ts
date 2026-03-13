import { describe, expect, it } from 'vitest'
import { runSyncRequest } from './sync'

describe('runSyncRequest', () => {
  it('returns a successful JSON response from the sync result', async () => {
    const response = await runSyncRequest(async () => ({
      source: 'cards.zip',
      status: 'synced',
      md5: 'abc123abc123abc123abc123abc123ab',
      previousMd5: null,
      rowCount: 12,
      checkedAt: '2026-03-13T16:00:00.000Z',
      syncedAt: '2026-03-13T16:00:00.000Z',
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toBe(
      'application/json; charset=utf-8',
    )
    await expect(response.json()).resolves.toEqual({
      source: 'cards.zip',
      status: 'synced',
      md5: 'abc123abc123abc123abc123abc123ab',
      previousMd5: null,
      rowCount: 12,
      checkedAt: '2026-03-13T16:00:00.000Z',
      syncedAt: '2026-03-13T16:00:00.000Z',
    })
  })

  it('returns a 500 JSON response when sync fails', async () => {
    const response = await runSyncRequest(async () => {
      throw new Error('zip import failed')
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'zip import failed',
    })
  })
})
