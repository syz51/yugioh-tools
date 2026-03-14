import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { calculateOpeningHandProbabilities } from '../lib/opening-hand-calculator'
import { StarterRateAnalysisPage } from '../features/starter-rate-experience'
import { deckAnalysisQueryOptions } from '../features/starter-rate-experience/lib/deck-analysis.query'
import {
  clampStarterCopies,
  getDefaultStarterCopies,
} from '../features/starter-rate-experience/lib/utils'

export const Route = createFileRoute('/analysis/$analysisId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(deckAnalysisQueryOptions(params.analysisId)),
  component: AnalysisRouteComponent,
})

function AnalysisRouteComponent() {
  const { analysisId } = Route.useParams()
  const analysis = useSuspenseQuery(deckAnalysisQueryOptions(analysisId)).data

  if (!analysis) {
    return <MissingAnalysisPage />
  }

  const mainDeckSize = analysis.payload.mainDeckSize
  const defaultStarterCopies = getDefaultStarterCopies(mainDeckSize)
  const [starterCopies, setStarterCopies] = useState(() =>
    clampStarterCopies(defaultStarterCopies, mainDeckSize),
  )
  const combinedStarterResult =
    mainDeckSize > 0 && starterCopies > 0
      ? calculateOpeningHandProbabilities({
          deckSize: mainDeckSize,
          pools: [
            {
              id: 'one-card-starters',
              label: '一卡动',
              copies: starterCopies,
            },
          ],
          recipes: [
            {
              id: 'one-card-starter',
              label: '任意一卡动',
              requirements: [{ poolId: 'one-card-starters', count: 1 }],
            },
          ],
        })
      : null

  return (
    <StarterRateAnalysisPage
      model={{
        combinedStarterResult,
        deckView: analysis.payload.deckView,
        mainDeckSize,
        sourceName: analysis.sourceName,
        starterCopies,
        updateStarterCopies: (value) =>
          setStarterCopies(clampStarterCopies(value, mainDeckSize)),
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
