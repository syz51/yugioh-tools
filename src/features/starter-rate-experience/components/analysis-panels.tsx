import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { clampStarterCopies, formatPercent } from '../lib/utils'
import type { DeckAnalysisModel } from '../types'

export function ConfigHero({ model }: { model: DeckAnalysisModel }) {
  return (
    <section className="surface-panel config-hero analysis-hero">
      <div className="analysis-toolbar-title">
        <p className="panel-kicker">起手率面板</p>
        <h2>起手分析</h2>
      </div>

      <div className="analysis-toolbar-stats">
        <div>
          <span>主卡组</span>
          <strong>{model.mainDeckSize}</strong>
        </div>
        <div>
          <span>来源</span>
          <strong>{model.deckView.sourceName ?? model.sourceName ?? '直接粘贴'}</strong>
        </div>
      </div>

      <div className="config-hero-actions analysis-toolbar-actions">
        <Link
          className="secondary-button ghost"
          to="/"
        >
          返回导入页
        </Link>
      </div>
    </section>
  )
}

export function StarterCountPanel({ model }: { model: DeckAnalysisModel }) {
  const [draftValue, setDraftValue] = useState(
    model.starterCopies > 0 ? String(model.starterCopies) : '',
  )

  useEffect(() => {
    setDraftValue(model.starterCopies > 0 ? String(model.starterCopies) : '')
  }, [model.starterCopies])

  return (
    <section className="surface-panel side-panel starter-count-panel">
      <div className="panel-header-row compact">
        <div>
          <p className="panel-kicker">起手点设置</p>
          <h2>填写当前的一卡动总数。</h2>
        </div>
      </div>

      <label className="starter-count-field" htmlFor="starter-count-input">
        <span>主卡组内一卡动总张数</span>
        <input
          id="starter-count-input"
          className="starter-count-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="0"
          value={draftValue}
          onChange={(event) => {
            const nextValue = event.target.value.replace(/\D+/g, '')
            if (nextValue === '') {
              setDraftValue('')
              model.updateStarterCopies(0)
              return
            }

            const clampedValue = clampStarterCopies(
              Number(nextValue),
              model.mainDeckSize,
            )
            setDraftValue(String(clampedValue))
            model.updateStarterCopies(clampedValue)
          }}
        />
      </label>
    </section>
  )
}

export function RateBoard({ model }: { model: DeckAnalysisModel }) {
  const startRate = model.combinedStarterResult?.openingHandProbability ?? 0

  return (
    <section className="surface-panel rate-panel">
      <p className="panel-kicker">起手命中率</p>
      <div className="rate-panel-main">
        <strong>{formatPercent(startRate)}</strong>
        <span>
          {model.starterCopies === 0
            ? '先在上方填入一卡动数量，这里会自动计算。'
            : '当前版本只计算一卡动总命中率。二卡动、三卡动和更细的组合拆分，还需要先补充连锁规则。'}
        </span>
      </div>
    </section>
  )
}
