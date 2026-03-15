import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  findFirstMock,
  insertMock,
  insertValuesMock,
  updateMock,
  updateSetMock,
  updateWhereMock,
} = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  insertMock: vi.fn(),
  insertValuesMock: vi.fn(),
  updateMock: vi.fn(),
  updateSetMock: vi.fn(),
  updateWhereMock: vi.fn(),
}))

vi.mock('../../../db', () => ({
  db: {
    insert: insertMock,
    query: {
      analysisSelectionConfig: {
        findFirst: findFirstMock,
      },
    },
    update: updateMock,
  },
}))

describe('analysis selection persistence compatibility', () => {
  beforeEach(() => {
    findFirstMock.mockReset()
    insertMock.mockReset()
    insertValuesMock.mockReset()
    updateMock.mockReset()
    updateSetMock.mockReset()
    updateWhereMock.mockReset()

    insertMock.mockReturnValue({
      values: insertValuesMock,
    })
    updateMock.mockReturnValue({
      set: updateSetMock,
    })
    updateSetMock.mockReturnValue({
      where: updateWhereMock,
    })
  })

  it('returns null when the selection config table is unavailable during reads', async () => {
    findFirstMock.mockRejectedValue(
      createFailedQueryError({ code: '42P01', message: 'relation missing' }),
    )

    const { getPersistedAnalysisSelectionConfig } = await import(
      './analysis-selection.server'
    )

    await expect(
      getPersistedAnalysisSelectionConfig({
        analysisId: 'analysis-1',
        cfg: 'ABCDEFGHIJKLMNOPQRSTUV',
      }),
    ).resolves.toBeNull()
  })

  it('treats missing selection config schema as a no-op during writes', async () => {
    findFirstMock.mockRejectedValue(
      createFailedQueryError({
        code: '42P01',
        message: 'analysis_selection_config does not exist',
      }),
    )

    const { upsertPersistedAnalysisSelectionConfig } = await import(
      './analysis-selection.server'
    )

    await expect(
      upsertPersistedAnalysisSelectionConfig({
        analysisId: 'analysis-1',
        cfg: 'ABCDEFGHIJKLMNOPQRSTUV',
        state: {
          version: 1,
          oneCardStarterIds: ['14558127'],
          twoCardStarterRows: [],
        },
      }),
    ).resolves.toEqual({ ok: true })

    expect(insertMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rethrows unrelated query failures', async () => {
    findFirstMock.mockRejectedValue(
      createFailedQueryError({ code: '08006', message: 'connection failure' }),
    )

    const { getPersistedAnalysisSelectionConfig } = await import(
      './analysis-selection.server'
    )

    await expect(
      getPersistedAnalysisSelectionConfig({
        analysisId: 'analysis-1',
        cfg: 'ABCDEFGHIJKLMNOPQRSTUV',
      }),
    ).rejects.toMatchObject({
      cause: {
        code: '08006',
      },
    })
  })
})

function createFailedQueryError({
  code,
  message,
}: {
  code: string
  message: string
}) {
  const cause = new Error(message) as Error & { code: string }
  cause.code = code

  return new Error(`Failed query: ${message}`, {
    cause,
  })
}
