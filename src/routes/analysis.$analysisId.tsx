import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StarterRateAnalysisPage } from '../features/starter-rate-experience'
import { calculateCombinedStarterRate } from '../features/starter-rate-experience/lib/combined-starter-rate'
import {
  EMPTY_ANALYSIS_SELECTION_STATE,
  fromRuntimeSelection,
  generateWorkingCfg,
  isValidCfg,
  parseAnalysisSelectionLocalCache,
  sanitizeSelectionState,
  selectionStatesEqual,
  serializeAnalysisSelectionLocalCache,
  toRuntimeSelection,
} from '../features/starter-rate-experience/lib/analysis-selection-state'
import {
  getAnalysisSelectionConfig,
  upsertAnalysisSelectionConfig,
} from '../features/starter-rate-experience/lib/analysis-selection.functions'
import {
  ANALYSIS_SELECTION_GC_TIME,
  ANALYSIS_SELECTION_STALE_TIME,
  analysisSelectionConfigQueryOptions,
} from '../features/starter-rate-experience/lib/analysis-selection.query'
import { deckAnalysisQueryOptions } from '../features/starter-rate-experience/lib/deck-analysis.query'
import { sortDeckEntries } from '../features/starter-rate-experience/lib/utils'
import type {
  AnalysisSelectionLocalCache,
  AnalysisSelectionState,
  DeckAnalysisRecord,
  DeckCardView,
  PersistedAnalysisSelectionConfig,
  TwoCardStarterRow,
  TwoCardStarterRowView,
} from '../features/starter-rate-experience/types'

const ANALYSIS_SELECTION_LOCAL_STORAGE_PREFIX =
  'starter-rate:analysis-selection:'
const ANALYSIS_SELECTION_PERSIST_DEBOUNCE_MS = 250
const ANALYSIS_SELECTION_SYNC_RETRY_MS = 5_000
const RESTORE_NOTICE_TEXT = '已恢复设置，部分无效项已自动移除'

type ResolvedSelectionState = {
  droppedInvalidSelections: boolean
  shouldHealLocalCache: boolean
  shouldSyncUrlToWorkingCfg: boolean
  source: 'empty' | 'local' | 'url-db'
  state: AnalysisSelectionState
  workingCfg?: string
}

type PendingSelectionSync = {
  analysisId: string
  cfg: string
  key: string
  state: AnalysisSelectionState
}

export const Route = createFileRoute('/analysis/$analysisId')({
  validateSearch: validateAnalysisSearch,
  loaderDeps: ({ search }) => ({
    cfg: search.cfg,
  }),
  loader: async ({ context, deps, params }) => {
    await context.queryClient.ensureQueryData(
      deckAnalysisQueryOptions(params.analysisId),
    )

    if (!deps.cfg) {
      return
    }

    await context.queryClient.ensureQueryData(
      analysisSelectionConfigQueryOptions(params.analysisId, deps.cfg),
    )
  },
  component: AnalysisRouteComponent,
})

export function validateAnalysisSearch(search: Record<string, unknown>) {
  return {
    cfg:
      typeof search.cfg === 'string' && isValidCfg(search.cfg)
        ? search.cfg
        : undefined,
  }
}

export function getAnalysisSelectionStorageKey(analysisId: string) {
  return `${ANALYSIS_SELECTION_LOCAL_STORAGE_PREFIX}${analysisId}`
}

export function AnalysisRouteComponent() {
  const navigate = useNavigate()
  const { analysisId } = Route.useParams()
  const { cfg } = Route.useSearch()
  const analysis = useSuspenseQuery(deckAnalysisQueryOptions(analysisId)).data
  const selectionConfigQuery = useQuery<PersistedAnalysisSelectionConfig | null>({
    enabled: cfg !== undefined,
    gcTime: ANALYSIS_SELECTION_GC_TIME,
    initialData: null,
    queryFn: () =>
      cfg
        ? getAnalysisSelectionConfig({
            data: {
              analysisId,
              cfg,
            },
          })
        : Promise.resolve(null),
    queryKey: ['analysis-selection', analysisId, cfg ?? '__disabled__'],
    staleTime: ANALYSIS_SELECTION_STALE_TIME,
  })

  if (!analysis) {
    return <MissingAnalysisPage />
  }

  return (
    <AnalysisRouteView
      analysis={analysis}
      analysisId={analysisId}
      cfg={cfg}
      selectionConfig={selectionConfigQuery.data ?? null}
      syncCfg={(nextCfg) => {
        void navigate({
          to: '/analysis/$analysisId',
          params: { analysisId },
          search: (previous) => ({
            ...previous,
            cfg: nextCfg,
          }),
          replace: true,
        })
      }}
    />
  )
}

export function AnalysisRouteView({
  analysis,
  analysisId,
  cfg,
  selectionConfig,
  syncCfg,
}: {
  analysis: DeckAnalysisRecord
  analysisId: string
  cfg?: string
  selectionConfig: PersistedAnalysisSelectionConfig | null
  syncCfg: (nextCfg: string) => void
}) {
  const mainDeckSize = analysis.payload.mainDeckSize
  const mainDeckEntries = useMemo(
    () =>
      sortDeckEntries(
        (
          analysis.payload.deckView.sections.find(
            (section) => section.key === 'main',
          )?.entries ?? []
        ).filter((entry) => entry.copies > 0),
        'copies',
        'desc',
      ),
    [analysis.payload.deckView.sections],
  )
  const mainDeckEntryIds = useMemo(
    () => new Set(mainDeckEntries.map((entry) => entry.id)),
    [mainDeckEntries],
  )
  const initialResolvedSelection = useMemo(
    () => resolveInitialSelectionState(selectionConfig, mainDeckEntryIds),
    [mainDeckEntryIds, selectionConfig],
  )
  const initialRuntimeSelectionRef = useRef(
    toRuntimeSelection(initialResolvedSelection.state),
  )
  const [selectedOneCardStarterIds, setSelectedOneCardStarterIds] = useState<
    string[]
  >(initialRuntimeSelectionRef.current.selectedOneCardStarterIds)
  const [twoCardStarterRows, setTwoCardStarterRows] = useState<
    TwoCardStarterRow[]
  >(initialRuntimeSelectionRef.current.twoCardStarterRows)
  const [restoreNotice, setRestoreNotice] = useState<string | null>(
    initialResolvedSelection.droppedInvalidSelections
      ? RESTORE_NOTICE_TEXT
      : null,
  )
  const nextTwoCardStarterRowIdRef = useRef(
    initialRuntimeSelectionRef.current.twoCardStarterRows.length + 1,
  )
  const runtimeSelectionRef = useRef({
    selectedOneCardStarterIds:
      initialRuntimeSelectionRef.current.selectedOneCardStarterIds,
    twoCardStarterRows: initialRuntimeSelectionRef.current.twoCardStarterRows,
  })
  const lastHydratedAnalysisIdRef = useRef<string | null>(null)
  const lastHydratedSelectionStateRef =
    useRef<AnalysisSelectionState | null>(initialResolvedSelection.state)
  const lastLocalCacheHealKeyRef = useRef<string | null>(null)
  const pendingSelectionSyncRef = useRef<PendingSelectionSync | null>(null)
  const [pendingSelectionSyncVersion, setPendingSelectionSyncVersion] =
    useState(0)

  useEffect(() => {
    runtimeSelectionRef.current = {
      selectedOneCardStarterIds,
      twoCardStarterRows,
    }
  }, [selectedOneCardStarterIds, twoCardStarterRows])

  useEffect(() => {
    setSelectedOneCardStarterIds((current) =>
      sanitizeOneCardStarterIds(current, mainDeckEntryIds),
    )
  }, [mainDeckEntryIds])

  useEffect(() => {
    setTwoCardStarterRows((current) =>
      sanitizeTwoCardStarterRows(
        current,
        mainDeckEntryIds,
        new Set(selectedOneCardStarterIds),
      ),
    )
  }, [mainDeckEntryIds, selectedOneCardStarterIds])

  useEffect(() => {
    const nextSelection = resolvePersistedSelectionState({
      analysisId,
      cfg,
      mainDeckEntryIds,
      selectionConfig,
    })
    const currentSelection = sanitizeSelectionState(
      fromRuntimeSelection(runtimeSelectionRef.current),
      mainDeckEntryIds,
    )
    const analysisChanged = lastHydratedAnalysisIdRef.current !== analysisId

    lastHydratedSelectionStateRef.current = nextSelection.state

    if (
      analysisChanged ||
      !selectionStatesEqual(nextSelection.state, currentSelection)
    ) {
      const runtimeSelection = toRuntimeSelection(nextSelection.state)
      nextTwoCardStarterRowIdRef.current =
        runtimeSelection.twoCardStarterRows.length + 1
      setSelectedOneCardStarterIds(runtimeSelection.selectedOneCardStarterIds)
      setTwoCardStarterRows(runtimeSelection.twoCardStarterRows)
    }

    setRestoreNotice(
      nextSelection.droppedInvalidSelections ? RESTORE_NOTICE_TEXT : null,
    )
    lastHydratedAnalysisIdRef.current = analysisId

    if (
      nextSelection.shouldSyncUrlToWorkingCfg &&
      nextSelection.workingCfg &&
      cfg !== nextSelection.workingCfg
    ) {
      syncCfg(nextSelection.workingCfg)
    }

    if (
      nextSelection.source !== 'local' ||
      !nextSelection.workingCfg
    ) {
      return
    }

    writeLocalSelectionCache(analysisId, {
      state: nextSelection.state,
      version: 1,
      workingCfg: nextSelection.workingCfg,
    })

    if (!nextSelection.shouldHealLocalCache) {
      return
    }

    const healKey = `${analysisId}:${nextSelection.workingCfg}:${JSON.stringify(nextSelection.state)}`

    if (lastLocalCacheHealKeyRef.current === healKey) {
      return
    }

    lastLocalCacheHealKeyRef.current = healKey
    const pendingSync = createPendingSelectionSync({
      analysisId,
      cfg: nextSelection.workingCfg,
      state: nextSelection.state,
    })

    queuePendingSelectionSync({
      pendingSelectionSyncRef,
      pendingSync,
      setPendingSelectionSyncVersion,
    })
    void upsertAnalysisSelectionConfig({
      data: {
        analysisId,
        cfg: nextSelection.workingCfg,
        state: nextSelection.state,
      },
    })
      .then(() => {
        clearPendingSelectionSync({
          key: pendingSync.key,
          pendingSelectionSyncRef,
          setPendingSelectionSyncVersion,
        })
      })
      .catch(() => {
        // Keep the queued sync for background retries.
      })
  }, [analysisId, cfg, mainDeckEntryIds, selectionConfig, syncCfg])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextSelectionState = sanitizeSelectionState(
        fromRuntimeSelection({
          selectedOneCardStarterIds,
          twoCardStarterRows,
        }),
        mainDeckEntryIds,
      )

      if (
        lastHydratedSelectionStateRef.current &&
        selectionStatesEqual(
          lastHydratedSelectionStateRef.current,
          nextSelectionState,
        )
      ) {
        lastHydratedSelectionStateRef.current = null
        return
      }

      lastHydratedSelectionStateRef.current = null

      const cachedLocalSelection = readLocalSelectionCache(
        analysisId,
        mainDeckEntryIds,
      )
      const workingCfg =
        cachedLocalSelection?.cache.workingCfg ?? generateWorkingCfg()

      writeLocalSelectionCache(analysisId, {
        state: nextSelectionState,
        version: 1,
        workingCfg,
      })

      if (cfg !== workingCfg) {
        syncCfg(workingCfg)
      }

      const pendingSync = createPendingSelectionSync({
        analysisId,
        cfg: workingCfg,
        state: nextSelectionState,
      })

      queuePendingSelectionSync({
        pendingSelectionSyncRef,
        pendingSync,
        setPendingSelectionSyncVersion,
      })
      void upsertAnalysisSelectionConfig({
        data: {
          analysisId,
          cfg: workingCfg,
          state: nextSelectionState,
        },
      })
        .then(() => {
          clearPendingSelectionSync({
            key: pendingSync.key,
            pendingSelectionSyncRef,
            setPendingSelectionSyncVersion,
          })
        })
        .catch(() => {
          // Keep the queued sync for background retries.
        })
    }, ANALYSIS_SELECTION_PERSIST_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    analysisId,
    cfg,
    mainDeckEntryIds,
    selectedOneCardStarterIds,
    syncCfg,
    twoCardStarterRows,
  ])

  useEffect(() => {
    const pendingSync = pendingSelectionSyncRef.current

    if (!pendingSync) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void upsertAnalysisSelectionConfig({
        data: {
          analysisId: pendingSync.analysisId,
          cfg: pendingSync.cfg,
          state: pendingSync.state,
        },
      })
        .then(() => {
          clearPendingSelectionSync({
            key: pendingSync.key,
            pendingSelectionSyncRef,
            setPendingSelectionSyncVersion,
          })
        })
        .catch(() => {
          if (pendingSelectionSyncRef.current?.key !== pendingSync.key) {
            return
          }

          setPendingSelectionSyncVersion((current) => current + 1)
        })
    }, ANALYSIS_SELECTION_SYNC_RETRY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [pendingSelectionSyncVersion])

  const selectedOneCardStarterEntries = mainDeckEntries.filter((entry) =>
    selectedOneCardStarterIds.includes(entry.id),
  )
  const starterCopies = selectedOneCardStarterEntries.reduce(
    (sum, entry) => sum + entry.copies,
    0,
  )
  const twoCardStarterRowsView = buildTwoCardStarterRowsView(
    twoCardStarterRows,
    mainDeckEntries,
  )

  const combinedStarterResult = calculateCombinedStarterRate({
    deckEntries: mainDeckEntries.map((entry) => ({
      copies: entry.copies,
      id: entry.id,
    })),
    deckSize: mainDeckSize,
    oneCardStarterIds: selectedOneCardStarterIds,
    twoCardStarterRows,
  })

  return (
    <StarterRateAnalysisPage
      model={{
        addTwoCardStarterRow: () => {
          const nextId = nextTwoCardStarterRowIdRef.current
          nextTwoCardStarterRowIdRef.current += 1
          setTwoCardStarterRows((currentRows) => [
            ...currentRows,
            {
              id: `two-card-row-${nextId}`,
              mainCardId: null,
              supplementCardIds: [],
            },
          ])
        },
        clearTwoCardStarterRowSupplements: (rowId) =>
          setTwoCardStarterRows((current) =>
            current.map((row) =>
              row.id === rowId ? { ...row, supplementCardIds: [] } : row,
            ),
          ),
        combinedStarterResult,
        deckView: analysis.payload.deckView,
        mainDeckEntries,
        mainDeckSize,
        removeTwoCardStarterRow: (rowId) =>
          setTwoCardStarterRows((current) =>
            current.filter((row) => row.id !== rowId),
          ),
        restoreNotice,
        selectedOneCardStarterEntries,
        selectedOneCardStarterIds,
        sourceName: analysis.sourceName,
        starterCopies,
        toggleOneCardStarterSelection: (value) =>
          setSelectedOneCardStarterIds((current) =>
            current.includes(value)
              ? current.filter((id) => id !== value)
              : [...current, value],
          ),
        toggleTwoCardStarterRowSupplement: (rowId, value) =>
          setTwoCardStarterRows((current) =>
            current.map((row) => {
              if (row.id !== rowId || row.mainCardId === null) {
                return row
              }

              if (
                !mainDeckEntryIds.has(value) ||
                value === row.mainCardId ||
                selectedOneCardStarterIds.includes(value)
              ) {
                return row
              }

              return row.supplementCardIds.includes(value)
                ? {
                    ...row,
                    supplementCardIds: row.supplementCardIds.filter(
                      (id) => id !== value,
                    ),
                  }
                : {
                    ...row,
                    supplementCardIds: [...row.supplementCardIds, value],
                  }
            }),
          ),
        twoCardStarterRows: twoCardStarterRowsView,
        updateTwoCardStarterRowMainCard: (rowId, value) =>
          setTwoCardStarterRows((current) => {
            if (value === null || value === '') {
              return current.map((row) =>
                row.id === rowId
                  ? { ...row, mainCardId: null, supplementCardIds: [] }
                  : row,
              )
            }

            if (
              selectedOneCardStarterIds.includes(value) ||
              !mainDeckEntryIds.has(value)
            ) {
              return current
            }

            const isUsedByOtherRow = current.some(
              (row) => row.id !== rowId && row.mainCardId === value,
            )

            if (isUsedByOtherRow) {
              return current
            }

            return current.map((row) =>
              row.id === rowId
                ? {
                    ...row,
                    mainCardId: value,
                    supplementCardIds: row.supplementCardIds.filter(
                      (id) => id !== value && mainDeckEntryIds.has(id),
                    ),
                  }
                : row,
            )
          }),
      }}
    />
  )
}

function resolveInitialSelectionState(
  selectionConfig: PersistedAnalysisSelectionConfig | null,
  mainDeckEntryIds: Set<string>,
) {
  if (!selectionConfig) {
    return {
      droppedInvalidSelections: false,
      state: EMPTY_ANALYSIS_SELECTION_STATE,
    }
  }

  return sanitizeResolvedSelectionState(selectionConfig.payload, mainDeckEntryIds)
}

function resolvePersistedSelectionState({
  analysisId,
  cfg,
  mainDeckEntryIds,
  selectionConfig,
}: {
  analysisId: string
  cfg?: string
  mainDeckEntryIds: Set<string>
  selectionConfig: PersistedAnalysisSelectionConfig | null
}): ResolvedSelectionState {
  if (selectionConfig) {
    return {
      ...sanitizeResolvedSelectionState(selectionConfig.payload, mainDeckEntryIds),
      shouldHealLocalCache: false,
      shouldSyncUrlToWorkingCfg: false,
      source: 'url-db',
      workingCfg: selectionConfig.cfg,
    }
  }

  const localCacheState = readLocalSelectionCache(analysisId, mainDeckEntryIds)

  if (localCacheState) {
    return {
      droppedInvalidSelections: localCacheState.droppedInvalidSelections,
      shouldHealLocalCache: true,
      shouldSyncUrlToWorkingCfg: cfg !== localCacheState.cache.workingCfg,
      source: 'local',
      state: localCacheState.cache.state,
      workingCfg: localCacheState.cache.workingCfg,
    }
  }

  return {
    droppedInvalidSelections: false,
    shouldHealLocalCache: false,
    shouldSyncUrlToWorkingCfg: false,
    source: 'empty',
    state: EMPTY_ANALYSIS_SELECTION_STATE,
  }
}

function sanitizeResolvedSelectionState(
  state: AnalysisSelectionState,
  mainDeckEntryIds: Set<string>,
) {
  const sanitizedSelectionState = sanitizeSelectionState(state, mainDeckEntryIds)

  return {
    droppedInvalidSelections: !selectionStatesEqual(
      state,
      sanitizedSelectionState,
    ),
    state: sanitizedSelectionState,
  }
}

function readLocalSelectionCache(
  analysisId: string,
  mainDeckEntryIds: Set<string>,
) {
  try {
    const storedValue = window.localStorage.getItem(
      getAnalysisSelectionStorageKey(analysisId),
    )

    if (!storedValue) {
      return null
    }

    const parsedLocalCache = parseAnalysisSelectionLocalCache(storedValue)

    if (!parsedLocalCache) {
      return null
    }

    const { droppedInvalidSelections, state } = sanitizeResolvedSelectionState(
      parsedLocalCache.state,
      mainDeckEntryIds,
    )

    return {
      cache: {
        ...parsedLocalCache,
        state,
      },
      droppedInvalidSelections,
    }
  } catch {
    return null
  }
}

function writeLocalSelectionCache(
  analysisId: string,
  cache: AnalysisSelectionLocalCache,
) {
  try {
    window.localStorage.setItem(
      getAnalysisSelectionStorageKey(analysisId),
      serializeAnalysisSelectionLocalCache(cache),
    )
  } catch {
    // Ignore local cache failures and keep client interactions immediate.
  }
}

function createPendingSelectionSync({
  analysisId,
  cfg,
  state,
}: {
  analysisId: string
  cfg: string
  state: AnalysisSelectionState
}): PendingSelectionSync {
  const normalizedState = {
    version: state.version,
    oneCardStarterIds: [...state.oneCardStarterIds],
    twoCardStarterRows: state.twoCardStarterRows.map((row) => ({
      mainCardId: row.mainCardId,
      supplementCardIds: [...row.supplementCardIds],
    })),
  }

  return {
    analysisId,
    cfg,
    key: `${analysisId}:${cfg}:${JSON.stringify(normalizedState)}`,
    state: normalizedState,
  }
}

function queuePendingSelectionSync({
  pendingSelectionSyncRef,
  pendingSync,
  setPendingSelectionSyncVersion,
}: {
  pendingSelectionSyncRef: React.MutableRefObject<PendingSelectionSync | null>
  pendingSync: PendingSelectionSync
  setPendingSelectionSyncVersion: React.Dispatch<React.SetStateAction<number>>
}) {
  if (pendingSelectionSyncRef.current?.key === pendingSync.key) {
    return
  }

  pendingSelectionSyncRef.current = pendingSync
  setPendingSelectionSyncVersion((current) => current + 1)
}

function clearPendingSelectionSync({
  key,
  pendingSelectionSyncRef,
  setPendingSelectionSyncVersion,
}: {
  key: string
  pendingSelectionSyncRef: React.MutableRefObject<PendingSelectionSync | null>
  setPendingSelectionSyncVersion: React.Dispatch<React.SetStateAction<number>>
}) {
  if (pendingSelectionSyncRef.current?.key !== key) {
    return
  }

  pendingSelectionSyncRef.current = null
  setPendingSelectionSyncVersion((current) => current + 1)
}

function buildTwoCardStarterRowsView(
  rows: TwoCardStarterRow[],
  mainDeckEntries: DeckCardView[],
) {
  const entriesById = new Map(mainDeckEntries.map((entry) => [entry.id, entry]))

  return rows.map<TwoCardStarterRowView>((row) => ({
    ...row,
    mainEntry: row.mainCardId
      ? (entriesById.get(row.mainCardId) ?? null)
      : null,
    supplementEntries: row.supplementCardIds.flatMap((id) => {
      const entry = entriesById.get(id)
      return entry ? [entry] : []
    }),
  }))
}

function sanitizeOneCardStarterIds(
  ids: string[],
  mainDeckEntryIds: Set<string>,
) {
  const seenIds = new Set<string>()
  const nextIds = ids.filter((id) => {
    if (!mainDeckEntryIds.has(id) || seenIds.has(id)) {
      return false
    }

    seenIds.add(id)
    return true
  })

  return ids.length === nextIds.length &&
    ids.every((id, index) => id === nextIds[index])
    ? ids
    : nextIds
}

function sanitizeTwoCardStarterRows(
  rows: TwoCardStarterRow[],
  mainDeckEntryIds: Set<string>,
  oneCardStarterIds: Set<string>,
) {
  const usedMainCardIds = new Set<string>()
  const nextRows = rows.map((row) => {
    const nextMainCardId =
      row.mainCardId &&
      mainDeckEntryIds.has(row.mainCardId) &&
      !oneCardStarterIds.has(row.mainCardId) &&
      !usedMainCardIds.has(row.mainCardId)
        ? row.mainCardId
        : null

    if (nextMainCardId) {
      usedMainCardIds.add(nextMainCardId)
    }

    const seenSupplementIds = new Set<string>()
    const nextSupplementCardIds = nextMainCardId
      ? row.supplementCardIds.filter((id) => {
          if (
            id === nextMainCardId ||
            oneCardStarterIds.has(id) ||
            !mainDeckEntryIds.has(id) ||
            seenSupplementIds.has(id)
          ) {
            return false
          }

          seenSupplementIds.add(id)
          return true
        })
      : []

    if (
      row.mainCardId !== nextMainCardId ||
      row.supplementCardIds.length !== nextSupplementCardIds.length ||
      row.supplementCardIds.some(
        (id, index) => id !== nextSupplementCardIds[index],
      )
    ) {
      return {
        ...row,
        mainCardId: nextMainCardId,
        supplementCardIds: nextSupplementCardIds,
      }
    }

    return row
  })

  return nextRows.some((row, index) => row !== rows[index]) ? nextRows : rows
}

function MissingAnalysisPage() {
  return (
    <main className="experience-shell stage-config">
      <section className="experience-frame">
        <section className="surface-panel rate-panel">
          <p className="panel-kicker">分析不存在</p>
          <div className="rate-panel-main">
            <strong>这个分析链接不可用</strong>
            <span>
              这份卡组分析可能已经失效，或者链接本身不正确。请回到导入页重新生成一次。
            </span>
            <Link className="secondary-button" to="/">
              返回导入页
            </Link>
          </div>
        </section>
      </section>
    </main>
  )
}
