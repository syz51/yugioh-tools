import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { StarterRateAnalysisPage } from '../features/starter-rate-experience'
import { calculateCombinedStarterRate } from '../features/starter-rate-experience/lib/combined-starter-rate'
import { deckAnalysisQueryOptions } from '../features/starter-rate-experience/lib/deck-analysis.query'
import {
  clampStarterCopies,
  sortDeckEntries,
} from '../features/starter-rate-experience/lib/utils'

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
  const firstMainDeckEntry = useMemo(
    () => mainDeckEntries.at(0) ?? null,
    [mainDeckEntries],
  )
  const defaultTwoCardStarterId = firstMainDeckEntry?.id ?? null
  const [selectedOneCardStarterIds, setSelectedOneCardStarterIds] = useState<
    string[]
  >([])
  const [selectedTwoCardStarterId, setSelectedTwoCardStarterId] = useState<
    string | null
  >(defaultTwoCardStarterId)
  const [twoCardSupplementCopies, setTwoCardSupplementCopies] = useState(0)

  useEffect(() => {
    setSelectedOneCardStarterIds([])
    setSelectedTwoCardStarterId(defaultTwoCardStarterId)
    setTwoCardSupplementCopies(0)
  }, [analysisId, defaultTwoCardStarterId])

  const selectedOneCardStarterEntries = mainDeckEntries.filter((entry) =>
    selectedOneCardStarterIds.includes(entry.id),
  )
  const starterCopies = selectedOneCardStarterEntries.reduce(
    (sum, entry) => sum + entry.copies,
    0,
  )

  const selectedTwoCardStarter =
    mainDeckEntries.find((entry) => entry.id === selectedTwoCardStarterId) ??
    firstMainDeckEntry
  const selectedStarterIsAlreadyOneCardStarter =
    selectedTwoCardStarter !== null &&
    selectedOneCardStarterIds.includes(selectedTwoCardStarter.id)
  const excludedCopiesForSupplements =
    starterCopies +
    (selectedTwoCardStarter && !selectedStarterIsAlreadyOneCardStarter
      ? selectedTwoCardStarter.copies
      : 0)
  const maxPureSupplementCopies = Math.max(
    mainDeckSize - excludedCopiesForSupplements,
    0,
  )

  useEffect(() => {
    setTwoCardSupplementCopies((current) =>
      clampStarterCopies(current, maxPureSupplementCopies),
    )
  }, [maxPureSupplementCopies])

  const combinedStarterResult = calculateCombinedStarterRate({
    deckSize: mainDeckSize,
    oneCardStarterCopies: starterCopies,
    selectedTwoCardStarter,
    selectedTwoCardStarterIncludedInOneCardPool:
      selectedStarterIsAlreadyOneCardStarter,
    twoCardSupplementCopies,
  })

  return (
    <StarterRateAnalysisPage
      model={{
        combinedStarterResult,
        deckView: analysis.payload.deckView,
        mainDeckSize,
        maxTwoCardSupplementCopies: maxPureSupplementCopies,
        selectedOneCardStarterEntries,
        selectedOneCardStarterIds,
        selectedTwoCardStarter,
        mainDeckEntries,
        sourceName: analysis.sourceName,
        starterCopies,
        twoCardSupplementCopies,
        toggleOneCardStarterSelection: (value) =>
          setSelectedOneCardStarterIds((current) =>
            current.includes(value)
              ? current.filter((id) => id !== value)
              : [...current, value],
          ),
        updateSelectedTwoCardStarter: (value) =>
          setSelectedTwoCardStarterId(
            mainDeckEntries.find((entry) => entry.id === value)?.id ??
              firstMainDeckEntry?.id ??
              null,
          ),
        updateTwoCardSupplementCopies: (value) =>
          setTwoCardSupplementCopies(
            Math.max(0, Math.min(value, maxPureSupplementCopies)),
          ),
      }}
    />
  )
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
