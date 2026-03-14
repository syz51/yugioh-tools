import { useDeferredValue, useEffect, useState } from 'react'
import { clampStarterCopies, formatPercent } from '../lib/utils'
import type { DeckAnalysisModel } from '../types'

export function StarterCountPanel({ model }: { model: DeckAnalysisModel }) {
  const [supplementDraftValue, setSupplementDraftValue] = useState(
    model.twoCardSupplementCopies > 0
      ? String(model.twoCardSupplementCopies)
      : '',
  )
  const [starterSearchValue, setStarterSearchValue] = useState('')
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const deferredStarterSearchValue = useDeferredValue(starterSearchValue)

  useEffect(() => {
    setSupplementDraftValue(
      model.twoCardSupplementCopies > 0
        ? String(model.twoCardSupplementCopies)
        : '',
    )
  }, [model.twoCardSupplementCopies])

  useEffect(() => {
    setStarterSearchValue('')
    setShowSelectedOnly(false)
  }, [model.mainDeckEntries])

  const normalizedStarterSearchValue = deferredStarterSearchValue
    .trim()
    .toLocaleLowerCase()
  const visibleStarterEntries = model.mainDeckEntries.filter((entry) => {
    const matchesSelectedFilter =
      !showSelectedOnly || model.selectedOneCardStarterIds.includes(entry.id)

    if (!matchesSelectedFilter) {
      return false
    }

    if (normalizedStarterSearchValue === '') {
      return true
    }

    return (
      entry.searchAliases.some((name) =>
        name.toLocaleLowerCase().includes(normalizedStarterSearchValue),
      ) || entry.id.includes(normalizedStarterSearchValue)
    )
  })

  return (
    <section className="surface-panel side-panel starter-count-panel">
      <div className="panel-header-row compact">
        <div>
          <p className="panel-kicker">起手点设置</p>
        </div>
      </div>

      <div className="starter-config-group">
        <div className="starter-config-heading">
          <strong>一卡动</strong>
          <span>从主卡组勾出真正的一卡动卡。</span>
        </div>

        <div className="starter-selection-toolbar">
          <div>
            <span>已选一卡动卡</span>
            <strong>{model.selectedOneCardStarterEntries.length} 张卡</strong>
          </div>
          <div>
            <span>累计张数</span>
            <strong>{model.starterCopies} 张</strong>
          </div>
        </div>

        <div className="starter-picker-toolbar">
          <label
            className="starter-picker-search"
            htmlFor="one-card-starter-search"
          >
            <span>按卡名或卡号筛选</span>
            <input
              id="one-card-starter-search"
              className="starter-picker-search-input"
              type="search"
              autoComplete="off"
              placeholder="例如 灰流丽 / Ash Blossom / 灰流うらら"
              value={starterSearchValue}
              onChange={(event) => setStarterSearchValue(event.target.value)}
            />
          </label>

          <div className="starter-picker-actions">
            <button
              className={`starter-picker-toggle ${
                showSelectedOnly ? 'is-active' : ''
              }`}
              type="button"
              onClick={() => setShowSelectedOnly((current) => !current)}
            >
              {showSelectedOnly ? '显示全部' : '仅看已选'}
            </button>
            <button
              className="starter-picker-toggle"
              type="button"
              disabled={model.selectedOneCardStarterIds.length === 0}
              onClick={() => {
                for (const entry of model.selectedOneCardStarterEntries) {
                  model.toggleOneCardStarterSelection(entry.id)
                }
              }}
            >
              清空已选
            </button>
          </div>
        </div>

        {model.mainDeckEntries.length > 0 ? (
          visibleStarterEntries.length > 0 ? (
            <div
              className="starter-pick-grid"
              role="list"
              aria-label="一卡动卡选择"
            >
              {visibleStarterEntries.map((entry) => {
                const isSelected = model.selectedOneCardStarterIds.includes(
                  entry.id,
                )

                return (
                  <button
                    aria-pressed={isSelected}
                    className={`starter-pick-card ${isSelected ? 'is-selected' : ''}`}
                    key={`one-card-${entry.id}`}
                    type="button"
                    onClick={() =>
                      model.toggleOneCardStarterSelection(entry.id)
                    }
                  >
                    <div className="starter-pick-art">
                      {entry.imageUrl ? (
                        <img
                          alt={entry.name}
                          draggable={false}
                          height={350}
                          loading="lazy"
                          src={entry.imageUrl}
                          width={240}
                        />
                      ) : (
                        <div className="starter-card-fallback">{entry.id}</div>
                      )}
                      <span className="starter-pick-copies">
                        {entry.copies}x
                      </span>
                      {isSelected ? (
                        <span className="starter-pick-selected">已选</span>
                      ) : null}
                    </div>
                    <div className="starter-pick-meta">
                      <strong className="starter-pick-name">
                        {entry.name}
                      </strong>
                      <span className="starter-pick-id">
                        {entry.status === 'missing' ? '资料缺失' : entry.id}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="starter-config-note">
              {showSelectedOnly
                ? '当前还没有已选的一卡动卡。'
                : '没有匹配当前筛选条件的主卡组卡片。'}
            </p>
          )
        ) : (
          <p className="starter-config-note">主卡组里还没有可选卡片。</p>
        )}
      </div>

      <div className="starter-config-group">
        <div className="starter-config-heading">
          <strong>二卡动</strong>
          <span>选一张主卡组内的主启动，再填能把它启动起来的补点总数。</span>
        </div>

        {model.mainDeckEntries.length > 0 ? (
          <>
            <label
              className="starter-count-field"
              htmlFor="two-card-starter-select"
            >
              <span>主启动卡</span>
              <select
                id="two-card-starter-select"
                className="starter-count-input starter-select"
                value={model.selectedTwoCardStarter?.id ?? ''}
                onChange={(event) =>
                  model.updateSelectedTwoCardStarter(event.target.value)
                }
              >
                {model.mainDeckEntries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.copies}x {entry.name}
                  </option>
                ))}
              </select>
            </label>

            {model.selectedTwoCardStarter ? (
              <div className="starter-selection-summary">
                <strong>
                  {model.selectedTwoCardStarter.copies}x{' '}
                  {model.selectedTwoCardStarter.name}
                </strong>
                <span>
                  本体张数会自动读取。补点总数只填不属于一卡动池的其他补点卡；
                  这张卡自己的拷贝也不会重复算进去。
                </span>
              </div>
            ) : null}

            <label
              className="starter-count-field"
              htmlFor="two-card-supplement-input"
            >
              <span>补点总张数</span>
              <input
                id="two-card-supplement-input"
                className="starter-count-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="0"
                value={supplementDraftValue}
                onChange={(event) => {
                  const nextValue = event.target.value.replace(/\D+/g, '')
                  if (nextValue === '') {
                    setSupplementDraftValue('')
                    model.updateTwoCardSupplementCopies(0)
                    return
                  }

                  const clampedValue = clampStarterCopies(
                    Number(nextValue),
                    model.maxTwoCardSupplementCopies,
                  )
                  setSupplementDraftValue(String(clampedValue))
                  model.updateTwoCardSupplementCopies(clampedValue)
                }}
              />
            </label>

            <p className="starter-config-note">
              当前最多可填 {model.maxTwoCardSupplementCopies}。这里会自动排除
              已选的一卡动卡，以及这张主启动本体。
            </p>
          </>
        ) : (
          <p className="starter-config-note">
            主卡组里还没有可选卡片，所以暂时不能配置指定主启动。
          </p>
        )}
      </div>
    </section>
  )
}

export function RateBoard({ model }: { model: DeckAnalysisModel }) {
  const overallStartRate =
    model.combinedStarterResult?.openingHandProbability ?? 0
  const hasTwoCardConfig =
    model.selectedTwoCardStarter !== null && model.twoCardSupplementCopies > 0
  const selectedStarterIsAlreadyOneCardStarter =
    model.selectedTwoCardStarter !== null &&
    model.selectedOneCardStarterIds.includes(model.selectedTwoCardStarter.id)

  return (
    <section className="surface-panel rate-panel">
      <p className="panel-kicker">整体起手率</p>
      <div className="rate-panel-main">
        <strong>{formatPercent(overallStartRate)}</strong>
        <span>
          {model.starterCopies === 0 && !hasTwoCardConfig
            ? '先配置一卡动或二卡动，这里会显示整体起手率。'
            : model.starterCopies > 0 &&
                hasTwoCardConfig &&
                !selectedStarterIsAlreadyOneCardStarter
              ? `已把 ${model.selectedOneCardStarterEntries.length} 张一卡动（共 ${model.starterCopies} 张）和 ${model.selectedTwoCardStarter?.name} + 任意 ${model.twoCardSupplementCopies} 张补点合并计算。`
              : model.starterCopies > 0
                ? selectedStarterIsAlreadyOneCardStarter && hasTwoCardConfig
                  ? `当前主启动已包含在一卡动池里，所以整体起手率按已选的一卡动 ${model.starterCopies} 张拷贝计算。`
                  : `当前按已选的一卡动 ${model.selectedOneCardStarterEntries.length} 张卡、共 ${model.starterCopies} 张拷贝计算。`
                : `${model.selectedTwoCardStarter?.name} + 任意 ${model.twoCardSupplementCopies} 张补点的整体起手率。`}
        </span>
      </div>
    </section>
  )
}
