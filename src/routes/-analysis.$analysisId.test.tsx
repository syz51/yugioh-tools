// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isValidCfg,
  parseAnalysisSelectionLocalCache,
  serializeAnalysisSelectionLocalCache,
} from '../features/starter-rate-experience/lib/analysis-selection-state'
import type {
  DeckAnalysisRecord,
  DeckCardView,
  DeckView,
  PersistedAnalysisSelectionConfig,
} from '../features/starter-rate-experience/types'

const {
  navigateMock,
  upsertAnalysisSelectionConfigMock,
  useQueryMock,
  useSuspenseQueryMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  upsertAnalysisSelectionConfigMock: vi.fn(),
  useQueryMock: vi.fn(),
  useSuspenseQueryMock: vi.fn(),
}))

let AnalysisRouteComponent: any
let Route: any
let getAnalysisSelectionStorageKey: (analysisId: string) => string
let validateAnalysisSearch: (search: Record<string, unknown>) => { cfg?: string }
let useSearchSpy: ReturnType<typeof vi.fn>

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')

  return {
    ...actual,
    useQuery: useQueryMock,
    useSuspenseQuery: useSuspenseQueryMock,
  }
})

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')

  return {
    ...actual,
    Link: ({ children, className }: any) => (
      <a className={className}>{children}</a>
    ),
    useNavigate: () => navigateMock,
  }
})

vi.mock('../features/starter-rate-experience/lib/deck-analysis.query', () => ({
  deckAnalysisQueryOptions: vi.fn((analysisId: string) => ({
    queryKey: ['deck-analysis', analysisId],
  })),
}))

vi.mock('../features/starter-rate-experience/lib/deck-analysis.functions', () => ({
  createDeckAnalysis: vi.fn(),
  getDeckAnalysis: vi.fn(),
}))

vi.mock(
  '../features/starter-rate-experience/lib/analysis-selection.functions',
  () => ({
    getAnalysisSelectionConfig: vi.fn(),
    upsertAnalysisSelectionConfig: upsertAnalysisSelectionConfigMock,
  }),
)

function createDeckCardView(
  overrides: Partial<DeckCardView> & Pick<DeckCardView, 'id' | 'name'>,
): DeckCardView {
  return {
    copies: 3,
    details: [],
    imageUrl: `https://example.com/${overrides.id}.jpg`,
    searchAliases: [overrides.name, overrides.id],
    status: 'ready',
    ...overrides,
  }
}

function createDeckView(mainDeckEntries: DeckCardView[]): DeckView {
  return {
    createdBy: null,
    importedAt: new Date('2026-03-14T00:00:00.000Z').toISOString(),
    missingCards: 0,
    sections: [
      {
        entries: mainDeckEntries,
        key: 'main',
        label: '主卡组',
        totalCards: 9,
      },
    ],
    sourceName: 'Test Deck',
    uniqueCards: mainDeckEntries.length,
    warnings: [],
  }
}

function createAnalysisRecord(): DeckAnalysisRecord {
  const ashBlossom = createDeckCardView({
    id: '14558127',
    name: 'Ash Blossom & Joyous Spring',
    searchAliases: ['Ash Blossom & Joyous Spring', '灰流丽', '14558127'],
  })
  const maxxC = createDeckCardView({
    id: '23434538',
    name: 'Maxx "C"',
    searchAliases: ['Maxx "C"', '增殖的G', '23434538'],
  })
  const calledBy = createDeckCardView({
    id: '24224830',
    name: 'Called by the Grave',
    searchAliases: ['Called by the Grave', '墓穴的指名者', '24224830'],
  })

  return {
    createdAt: new Date('2026-03-14T00:00:00.000Z').toISOString(),
    deckText: '#main\n14558127\n23434538\n24224830',
    id: 'analysis-1',
    payload: {
      deckView: createDeckView([ashBlossom, maxxC, calledBy]),
      mainDeckSize: 40,
    },
    sourceName: 'Test Deck',
  }
}

function createSelectionConfig(
  overrides: Partial<PersistedAnalysisSelectionConfig> = {},
): PersistedAnalysisSelectionConfig {
  return {
    analysisId: 'analysis-1',
    cfg: 'ABCDEFGHIJKLMNOPQRSTUV',
    createdAt: new Date('2026-03-14T00:00:00.000Z').toISOString(),
    payload: {
      version: 1,
      oneCardStarterIds: ['14558127'],
      twoCardStarterRows: [],
    },
    updatedAt: new Date('2026-03-14T00:00:00.000Z').toISOString(),
    ...overrides,
  }
}

async function flushDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(250)
    await Promise.resolve()
  })
}

async function flushRetryDelay() {
  await act(async () => {
    vi.advanceTimersByTime(5_000)
    await Promise.resolve()
  })
}

function readStoredLocalCache() {
  const storedValue = window.localStorage.getItem(
    getAnalysisSelectionStorageKey('analysis-1'),
  )

  return storedValue ? parseAnalysisSelectionLocalCache(storedValue) : null
}

describe('analysis route selection persistence', () => {
  beforeAll(async () => {
    const routeModule = await import('./analysis.$analysisId')

    AnalysisRouteComponent = routeModule.AnalysisRouteComponent
    Route = routeModule.Route
    getAnalysisSelectionStorageKey = routeModule.getAnalysisSelectionStorageKey
    validateAnalysisSearch = routeModule.validateAnalysisSearch
  })

  beforeEach(() => {
    navigateMock.mockReset()
    upsertAnalysisSelectionConfigMock.mockReset()
    upsertAnalysisSelectionConfigMock.mockResolvedValue({ ok: true })
    useQueryMock.mockReset()
    useQueryMock.mockReturnValue({ data: null })
    useSuspenseQueryMock.mockReset()
    useSuspenseQueryMock.mockReturnValue({
      data: createAnalysisRecord(),
    })
    window.localStorage.clear()
    vi.spyOn(Route, 'useParams').mockReturnValue({
      analysisId: 'analysis-1',
    })
    useSearchSpy = vi.spyOn(Route, 'useSearch').mockReturnValue({
      cfg: undefined,
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts empty for a bare analysis route with no cfg and no local cache', () => {
    render(<AnalysisRouteComponent />)

    expect(
      screen
        .getByRole('button', { name: /Ash Blossom & Joyous Spring/i })
        .getAttribute('aria-pressed'),
    ).toBe('false')
  })

  it('restores local cache for a bare route and canonicalizes to the working cfg', async () => {
    window.localStorage.setItem(
      getAnalysisSelectionStorageKey('analysis-1'),
      serializeAnalysisSelectionLocalCache({
        version: 1,
        workingCfg: 'LOCAL_WORKING_CFG_1234',
        state: {
          version: 1,
          oneCardStarterIds: ['14558127'],
          twoCardStarterRows: [],
        },
      }),
    )

    render(<AnalysisRouteComponent />)

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: /Ash Blossom & Joyous Spring/i })
          .getAttribute('aria-pressed'),
      ).toBe('true')
    })

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock.mock.calls[0]?.[0]?.replace).toBe(true)
    expect(
      navigateMock.mock.calls[0]?.[0]?.search({
        cfg: undefined,
      }),
    ).toEqual({
      cfg: 'LOCAL_WORKING_CFG_1234',
    })
    expect(upsertAnalysisSelectionConfigMock).toHaveBeenCalledTimes(1)
  })

  it('restores state from a valid DB-backed cfg', async () => {
    useSearchSpy.mockReturnValue({
      cfg: 'ABCDEFGHIJKLMNOPQRSTUV',
    })
    useQueryMock.mockReturnValue({
      data: createSelectionConfig(),
    })

    render(<AnalysisRouteComponent />)

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: /Ash Blossom & Joyous Spring/i })
          .getAttribute('aria-pressed'),
      ).toBe('true')
    })

    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('drops malformed cfg values during search validation', () => {
    expect(
      validateAnalysisSearch({
        cfg: 'bad/value',
      }),
    ).toEqual({
      cfg: undefined,
    })
    expect(
      validateAnalysisSearch({
        cfg: 'ABCDEFGHIJKLMNOPQRSTUV',
      }),
    ).toEqual({
      cfg: 'ABCDEFGHIJKLMNOPQRSTUV',
    })
  })

  it('falls back to local cache when the DB row for cfg is missing', async () => {
    useSearchSpy.mockReturnValue({
      cfg: 'ABCDEFGHIJKLMNOPQRSTUV',
    })
    useQueryMock.mockReturnValue({
      data: null,
    })
    window.localStorage.setItem(
      getAnalysisSelectionStorageKey('analysis-1'),
      serializeAnalysisSelectionLocalCache({
        version: 1,
        workingCfg: 'LOCAL_WORKING_CFG_1234',
        state: {
          version: 1,
          oneCardStarterIds: ['14558127'],
          twoCardStarterRows: [],
        },
      }),
    )

    render(<AnalysisRouteComponent />)

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: /Ash Blossom & Joyous Spring/i })
          .getAttribute('aria-pressed'),
      ).toBe('true')
    })

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(
      navigateMock.mock.calls[0]?.[0]?.search({
        cfg: 'ABCDEFGHIJKLMNOPQRSTUV',
      }),
    ).toEqual({
      cfg: 'LOCAL_WORKING_CFG_1234',
    })
  })

  it('retries syncing restored local cache after an initial background failure', async () => {
    vi.useFakeTimers()
    upsertAnalysisSelectionConfigMock
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValue({ ok: true })
    window.localStorage.setItem(
      getAnalysisSelectionStorageKey('analysis-1'),
      serializeAnalysisSelectionLocalCache({
        version: 1,
        workingCfg: 'LOCAL_WORKING_CFG_1234',
        state: {
          version: 1,
          oneCardStarterIds: ['14558127'],
          twoCardStarterRows: [],
        },
      }),
    )

    render(<AnalysisRouteComponent />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(upsertAnalysisSelectionConfigMock).toHaveBeenCalledTimes(1)
    await flushRetryDelay()

    expect(upsertAnalysisSelectionConfigMock).toHaveBeenCalledTimes(2)
    expect(upsertAnalysisSelectionConfigMock.mock.calls[1]?.[0]).toEqual(
      upsertAnalysisSelectionConfigMock.mock.calls[0]?.[0],
    )
  })

  it('generates one working cfg on the first local edit', async () => {
    vi.useFakeTimers()

    render(<AnalysisRouteComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /Ash Blossom & Joyous Spring/i }),
    )
    await flushDebounce()

    const localCache = readStoredLocalCache()

    expect(localCache).not.toBeNull()
    expect(localCache?.workingCfg).toBeTruthy()
    expect(isValidCfg(localCache?.workingCfg ?? '')).toBe(true)
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(upsertAnalysisSelectionConfigMock).toHaveBeenCalledTimes(1)
  })

  it('reuses the same working cfg across successive local edits', async () => {
    vi.useFakeTimers()

    render(<AnalysisRouteComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /Ash Blossom & Joyous Spring/i }),
    )
    await flushDebounce()
    const firstWorkingCfg = readStoredLocalCache()?.workingCfg

    fireEvent.click(screen.getByRole('button', { name: /Maxx "C"/i }))
    await flushDebounce()
    const secondWorkingCfg = readStoredLocalCache()?.workingCfg

    expect(firstWorkingCfg).toBeTruthy()
    expect(secondWorkingCfg).toBe(firstWorkingCfg)
  })

  it('uses replace navigation for debounced persistence', async () => {
    vi.useFakeTimers()

    render(<AnalysisRouteComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /Ash Blossom & Joyous Spring/i }),
    )
    await flushDebounce()

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock.mock.calls[0]?.[0]?.replace).toBe(true)
  })

  it('updates localStorage after the debounce window when selections change', async () => {
    vi.useFakeTimers()

    render(<AnalysisRouteComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /Ash Blossom & Joyous Spring/i }),
    )
    await flushDebounce()

    expect(readStoredLocalCache()).toEqual({
      version: 1,
      workingCfg: expect.any(String),
      state: {
        version: 1,
        oneCardStarterIds: ['14558127'],
        twoCardStarterRows: [],
      },
    })
  })

  it('ignores DB sync failures without blocking UI updates', async () => {
    vi.useFakeTimers()
    upsertAnalysisSelectionConfigMock.mockRejectedValue(new Error('db down'))

    render(<AnalysisRouteComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /Ash Blossom & Joyous Spring/i }),
    )
    await flushDebounce()

    expect(
      screen
        .getByRole('button', { name: /Ash Blossom & Joyous Spring/i })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(readStoredLocalCache()?.state.oneCardStarterIds).toEqual(['14558127'])
  })

  it('switches from a foreign cfg to the local working cfg on edit', async () => {
    vi.useFakeTimers()
    useSearchSpy.mockReturnValue({
      cfg: 'FOREIGN_CFG_123456789012',
    })
    useQueryMock.mockReturnValue({
      data: createSelectionConfig({
        cfg: 'FOREIGN_CFG_123456789012',
        payload: {
          version: 1,
          oneCardStarterIds: ['14558127'],
          twoCardStarterRows: [],
        },
      }),
    })
    window.localStorage.setItem(
      getAnalysisSelectionStorageKey('analysis-1'),
      serializeAnalysisSelectionLocalCache({
        version: 1,
        workingCfg: 'LOCAL_WORKING_CFG_1234',
        state: {
          version: 1,
          oneCardStarterIds: ['23434538'],
          twoCardStarterRows: [],
        },
      }),
    )

    render(<AnalysisRouteComponent />)

    fireEvent.click(screen.getByRole('button', { name: /Maxx "C"/i }))
    await flushDebounce()

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(
      navigateMock.mock.calls[0]?.[0]?.search({
        cfg: 'FOREIGN_CFG_123456789012',
      }),
    ).toEqual({
      cfg: 'LOCAL_WORKING_CFG_1234',
    })
  })

  it('does not auto-switch away from a foreign cfg before editing', async () => {
    useSearchSpy.mockReturnValue({
      cfg: 'FOREIGN_CFG_123456789012',
    })
    useQueryMock.mockReturnValue({
      data: createSelectionConfig({
        cfg: 'FOREIGN_CFG_123456789012',
      }),
    })
    window.localStorage.setItem(
      getAnalysisSelectionStorageKey('analysis-1'),
      serializeAnalysisSelectionLocalCache({
        version: 1,
        workingCfg: 'LOCAL_WORKING_CFG_1234',
        state: {
          version: 1,
          oneCardStarterIds: ['23434538'],
          twoCardStarterRows: [],
        },
      }),
    )

    render(<AnalysisRouteComponent />)

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: /Ash Blossom & Joyous Spring/i })
          .getAttribute('aria-pressed'),
      ).toBe('true')
    })

    expect(navigateMock).not.toHaveBeenCalled()
  })
})
