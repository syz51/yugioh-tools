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
  const [selectedOneCardStarterIds, setSelectedOneCardStarterIds] = useState<
    string[]
  >([])
  const [selectedTwoCardStarterIds, setSelectedTwoCardStarterIds] = useState<
    string[]
  >([])
  const [twoCardSupplementCopies, setTwoCardSupplementCopies] = useState(0)

  useEffect(() => {
    setSelectedOneCardStarterIds([])
    setSelectedTwoCardStarterIds([])
    setTwoCardSupplementCopies(0)
  }, [analysisId])

  const selectedOneCardStarterEntries = mainDeckEntries.filter((entry) =>
    selectedOneCardStarterIds.includes(entry.id),
  )
  const starterCopies = selectedOneCardStarterEntries.reduce(
    (sum, entry) => sum + entry.copies,
    0,
  )

  const selectedTwoCardStarterEntries = mainDeckEntries.filter((entry) =>
    selectedTwoCardStarterIds.includes(entry.id),
  )
  const selectedTwoCardStarterExclusiveCopies = selectedTwoCardStarterEntries
    .filter((entry) => !selectedOneCardStarterIds.includes(entry.id))
    .reduce((sum, entry) => sum + entry.copies, 0)
  const excludedCopiesForSupplements =
    starterCopies + selectedTwoCardStarterExclusiveCopies
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
    selectedTwoCardStarterCopies: selectedTwoCardStarterExclusiveCopies,
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
        selectedTwoCardStarterEntries,
        selectedTwoCardStarterIds,
        mainDeckEntries,
        sourceName: analysis.sourceName,
        starterCopies,
        twoCardSupplementCopies,
        clearTwoCardStarterSelections: () => setSelectedTwoCardStarterIds([]),
        toggleOneCardStarterSelection: (value) =>
          setSelectedOneCardStarterIds((current) =>
            current.includes(value)
              ? current.filter((id) => id !== value)
              : [...current, value],
          ),
        toggleTwoCardStarterSelection: (value) =>
          setSelectedTwoCardStarterIds((current) =>
            current.includes(value)
              ? current.filter((id) => id !== value)
              : mainDeckEntries.find((entry) => entry.id === value)
                ? [...current, value]
                : current,
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
