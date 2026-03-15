import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StarterRateAnalysisPage } from '../features/starter-rate-experience'
import { calculateCombinedStarterRate } from '../features/starter-rate-experience/lib/combined-starter-rate'
import { deckAnalysisQueryOptions } from '../features/starter-rate-experience/lib/deck-analysis.query'
import { sortDeckEntries } from '../features/starter-rate-experience/lib/utils'
import type {
  DeckCardView,
  TwoCardStarterRow,
  TwoCardStarterRowView,
} from '../features/starter-rate-experience/types'

export const Route = createFileRoute('/analysis/$analysisId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      deckAnalysisQueryOptions(params.analysisId),
    ),
  component: AnalysisRouteComponent,
})

function AnalysisRouteComponent() {
  const { analysisId } = Route.useParams()
  const analysis = useSuspenseQuery(deckAnalysisQueryOptions(analysisId)).data

  if (!analysis) {
    return <MissingAnalysisPage />
  }

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
  const [selectedOneCardStarterIds, setSelectedOneCardStarterIds] = useState<
    string[]
  >([])
  const [twoCardStarterRows, setTwoCardStarterRows] = useState<
    TwoCardStarterRow[]
  >([])
  const nextTwoCardStarterRowIdRef = useRef(1)

  useEffect(() => {
    setSelectedOneCardStarterIds([])
    setTwoCardStarterRows([])
    nextTwoCardStarterRowIdRef.current = 1
  }, [analysisId])

  useEffect(() => {
    setTwoCardStarterRows((current) =>
      sanitizeTwoCardStarterRows(
        current,
        mainDeckEntryIds,
        new Set(selectedOneCardStarterIds),
      ),
    )
  }, [mainDeckEntryIds, selectedOneCardStarterIds])

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
