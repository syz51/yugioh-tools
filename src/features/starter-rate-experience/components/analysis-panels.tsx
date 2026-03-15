import { useDeferredValue, useEffect, useState } from 'react'
import { clampStarterCopies, formatPercent } from '../lib/utils'
import type { DeckAnalysisModel, DeckCardView } from '../types'

type StarterConfigTab = 'one-card' | 'two-card'

function matchesStarterSearch(
  entry: DeckCardView,
  normalizedSearchValue: string,
) {
  if (normalizedSearchValue === '') {
    return true
  }

  return (
    entry.searchAliases.some((name) =>
      name.toLocaleLowerCase().includes(normalizedSearchValue),
    ) || entry.id.includes(normalizedSearchValue)
  )
}

export function StarterCountPanel({ model }: { model: DeckAnalysisModel }) {
  const [supplementDraftValue, setSupplementDraftValue] = useState(
    model.twoCardSupplementCopies > 0
      ? String(model.twoCardSupplementCopies)
      : '',
  )
  const [activeTab, setActiveTab] = useState<StarterConfigTab>('one-card')
  const [oneCardStarterSearchValue, setOneCardStarterSearchValue] = useState('')
  const [twoCardStarterSearchValue, setTwoCardStarterSearchValue] = useState('')
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const deferredOneCardStarterSearchValue = useDeferredValue(
    oneCardStarterSearchValue,
  )
  const deferredTwoCardStarterSearchValue = useDeferredValue(
    twoCardStarterSearchValue,
  )

  useEffect(() => {
    setSupplementDraftValue(
      model.twoCardSupplementCopies > 0
        ? String(model.twoCardSupplementCopies)
        : '',
    )
  }, [model.twoCardSupplementCopies])

  useEffect(() => {
    setOneCardStarterSearchValue('')
    setTwoCardStarterSearchValue('')
    setShowSelectedOnly(false)
  }, [model.mainDeckEntries])

  const tabSummary =
    activeTab === 'one-card'
      ? `${model.selectedOneCardStarterEntries.length} 张卡 / ${model.starterCopies} 张拷贝`
      : model.selectedTwoCardStarterEntries.length > 0
        ? `${model.selectedTwoCardStarterEntries.length} 张主启动 / ${model.twoCardSupplementCopies} 张补点`
        : '选择主启动并填写补点总数'
  const normalizedOneCardStarterSearchValue = deferredOneCardStarterSearchValue
    .trim()
    .toLocaleLowerCase()
  const normalizedTwoCardStarterSearchValue = deferredTwoCardStarterSearchValue
    .trim()
    .toLocaleLowerCase()
  const visibleStarterEntries = model.mainDeckEntries.filter((entry) => {
    const matchesSelectedFilter =
      !showSelectedOnly || model.selectedOneCardStarterIds.includes(entry.id)

    if (!matchesSelectedFilter) {
      return false
    }

    return matchesStarterSearch(entry, normalizedOneCardStarterSearchValue)
  })
  const visibleTwoCardStarterEntries = model.mainDeckEntries.filter((entry) => {
    if (model.selectedOneCardStarterIds.includes(entry.id)) {
      return false
    }

    return matchesStarterSearch(entry, normalizedTwoCardStarterSearchValue)
  })
  const selectedTwoCardStarterCopies =
    model.selectedTwoCardStarterEntries.reduce(
      (sum, entry) => sum + entry.copies,
      0,
    )

  return (
    <section className="surface-panel side-panel starter-count-panel">
      <div className="panel-header-row compact">
        <div>
          <p className="panel-kicker">起手点设置</p>
        </div>
      </div>

      <div className="starter-config-shell">
        <div
          className="starter-config-tabs"
          role="tablist"
          aria-label="起手点类型"
        >
          <button
            className={`section-tab ${activeTab === 'one-card' ? 'is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'one-card'}
            aria-controls="starter-tab-one-card"
            id="starter-tab-trigger-one-card"
            onClick={() => setActiveTab('one-card')}
          >
            一卡动
          </button>
          <button
            className={`section-tab ${activeTab === 'two-card' ? 'is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'two-card'}
            aria-controls="starter-tab-two-card"
            id="starter-tab-trigger-two-card"
            onClick={() => setActiveTab('two-card')}
          >
            二卡动
          </button>
        </div>

        <div className="starter-config-summary" aria-live="polite">
          <strong>
            {activeTab === 'one-card' ? '当前配置：一卡动' : '当前配置：二卡动'}
          </strong>
          <span>{tabSummary}</span>
        </div>

        {activeTab === 'one-card' ? (
          <div
            className="starter-config-group"
            id="starter-tab-one-card"
            role="tabpanel"
            aria-labelledby="starter-tab-trigger-one-card"
          >
            <div className="starter-config-heading">
              <strong>一卡动</strong>
              <span>从主卡组勾出真正的一卡动卡。</span>
            </div>

            <div className="starter-selection-toolbar">
              <div>
                <span>已选一卡动卡</span>
                <strong>
                  {model.selectedOneCardStarterEntries.length} 张卡
                </strong>
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
                  value={oneCardStarterSearchValue}
                  onChange={(event) =>
                    setOneCardStarterSearchValue(event.target.value)
                  }
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
                            <div className="starter-card-fallback">
                              {entry.id}
                            </div>
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
        ) : (
          <div
            className="starter-config-group"
            id="starter-tab-two-card"
            role="tabpanel"
            aria-labelledby="starter-tab-trigger-two-card"
          >
            <div className="starter-config-heading">
              <strong>二卡动</strong>
              <span>
                可勾选多张主启动卡。系统会按任意已选主启动 + 任意补点来计算。
              </span>
            </div>

            {model.mainDeckEntries.length > 0 ? (
              <>
                <div className="starter-picker-toolbar">
                  <label
                    className="starter-picker-search"
                    htmlFor="two-card-starter-search"
                  >
                    <span>按卡名或卡号筛选主启动</span>
                    <input
                      id="two-card-starter-search"
                      className="starter-picker-search-input"
                      type="search"
                      autoComplete="off"
                      placeholder="例如 增殖的G / Maxx C / 23434538"
                      value={twoCardStarterSearchValue}
                      onChange={(event) =>
                        setTwoCardStarterSearchValue(event.target.value)
                      }
                    />
                  </label>

                  <div className="starter-picker-actions">
                    <button
                      className="starter-picker-toggle"
                      type="button"
                      disabled={model.selectedTwoCardStarterIds.length === 0}
                      onClick={() => model.clearTwoCardStarterSelections()}
                    >
                      清空已选主启动
                    </button>
                  </div>
                </div>

                {visibleTwoCardStarterEntries.length > 0 ? (
                  <div
                    className="starter-pick-grid starter-pick-grid-two-card"
                    role="list"
                    aria-label="二卡动主启动选择"
                  >
                    {visibleTwoCardStarterEntries.map((entry) => {
                      const isSelected =
                        model.selectedTwoCardStarterIds.includes(entry.id)
                      const isOneCardStarter =
                        model.selectedOneCardStarterIds.includes(entry.id)

                      return (
                        <button
                          aria-pressed={isSelected}
                          className={`starter-pick-card ${
                            isSelected ? 'is-selected is-primary-selected' : ''
                          }`}
                          key={`two-card-${entry.id}`}
                          type="button"
                          onClick={() =>
                            model.toggleTwoCardStarterSelection(entry.id)
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
                              <div className="starter-card-fallback">
                                {entry.id}
                              </div>
                            )}
                            <span className="starter-pick-copies">
                              {entry.copies}x
                            </span>
                            {isSelected ? (
                              <span className="starter-pick-selected">
                                已选
                              </span>
                            ) : null}
                          </div>
                          <div className="starter-pick-meta">
                            <strong className="starter-pick-name">
                              {entry.name}
                            </strong>
                            <span className="starter-pick-id">
                              {entry.status === 'missing'
                                ? '资料缺失'
                                : entry.id}
                            </span>
                            {isOneCardStarter ? (
                              <span className="starter-main-card-flag">
                                已在一卡动池
                              </span>
                            ) : null}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="starter-config-note">
                    {model.selectedOneCardStarterIds.length ===
                    model.mainDeckEntries.length
                      ? '当前主卡组卡片都已经在一卡动池里，暂时没有可选的二卡动主启动。'
                      : '没有匹配当前筛选条件的主卡组卡片。'}
                  </p>
                )}

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
                    disabled={model.selectedTwoCardStarterEntries.length === 0}
                    placeholder={
                      model.selectedTwoCardStarterEntries.length === 0
                        ? '先选主启动'
                        : '0'
                    }
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
                  {model.selectedTwoCardStarterEntries.length > 0
                    ? `当前已选 ${model.selectedTwoCardStarterEntries.length} 张主启动、共 ${selectedTwoCardStarterCopies} 张本体拷贝。补点上限为 ${model.maxTwoCardSupplementCopies}，并会自动排除已选的一卡动卡与已选主启动本体。`
                    : '先选主启动卡，系统才会根据当前一卡动配置计算可填写的补点上限。'}
                </p>
              </>
            ) : (
              <p className="starter-config-note">
                主卡组里还没有可选卡片，所以暂时不能配置指定主启动。
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export function RateBoard({ model }: { model: DeckAnalysisModel }) {
  const overallStartRate =
    model.combinedStarterResult?.openingHandProbability ?? 0
  const hasTwoCardConfig =
    model.selectedTwoCardStarterEntries.length > 0 &&
    model.twoCardSupplementCopies > 0
  const selectedTwoCardStarterExclusiveEntries =
    model.selectedTwoCardStarterEntries.filter(
      (entry) => !model.selectedOneCardStarterIds.includes(entry.id),
    )
  const selectedStarterPoolFullyCoveredByOneCardPool =
    model.selectedTwoCardStarterEntries.length > 0 &&
    selectedTwoCardStarterExclusiveEntries.length === 0

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
                !selectedStarterPoolFullyCoveredByOneCardPool
              ? `已把 ${model.selectedOneCardStarterEntries.length} 张一卡动（共 ${model.starterCopies} 张）和 ${model.selectedTwoCardStarterEntries.length} 张已选主启动 + 任意 ${model.twoCardSupplementCopies} 张补点合并计算。`
              : model.starterCopies > 0
                ? selectedStarterPoolFullyCoveredByOneCardPool &&
                  hasTwoCardConfig
                  ? `当前已选主启动都包含在一卡动池里，所以整体起手率按已选的一卡动 ${model.starterCopies} 张拷贝计算。`
                  : `当前按已选的一卡动 ${model.selectedOneCardStarterEntries.length} 张卡、共 ${model.starterCopies} 张拷贝计算。`
                : `${model.selectedTwoCardStarterEntries.length} 张已选主启动 + 任意 ${model.twoCardSupplementCopies} 张补点的整体起手率。`}
        </span>
      </div>
    </section>
  )
}
