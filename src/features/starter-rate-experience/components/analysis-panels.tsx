import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { formatPercent } from '../lib/utils'
import type {
  DeckAnalysisModel,
  DeckCardView,
  TwoCardStarterRowView,
} from '../types'

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

function getSupplementCopies(row: TwoCardStarterRowView) {
  return row.supplementEntries.reduce((sum, entry) => sum + entry.copies, 0)
}

export function StarterCountPanel({ model }: { model: DeckAnalysisModel }) {
  const [activeTab, setActiveTab] = useState<StarterConfigTab>('one-card')
  const [oneCardStarterSearchValue, setOneCardStarterSearchValue] = useState('')
  const [twoCardMainSearchValue, setTwoCardMainSearchValue] = useState('')
  const [twoCardPartnerSearchValue, setTwoCardPartnerSearchValue] = useState('')
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [showSelectedPartnersOnly, setShowSelectedPartnersOnly] =
    useState(false)
  const [activeTwoCardRowId, setActiveTwoCardRowId] = useState<string | null>(
    model.twoCardStarterRows[0]?.id ?? null,
  )
  const [mainCardPickerRowId, setMainCardPickerRowId] = useState<string | null>(
    null,
  )
  const [partnerEditorRowId, setPartnerEditorRowId] = useState<string | null>(
    null,
  )
  const previousTwoCardRowCountRef = useRef(model.twoCardStarterRows.length)
  const deferredOneCardStarterSearchValue = useDeferredValue(
    oneCardStarterSearchValue,
  )
  const deferredTwoCardMainSearchValue = useDeferredValue(
    twoCardMainSearchValue,
  )
  const deferredTwoCardPartnerSearchValue = useDeferredValue(
    twoCardPartnerSearchValue,
  )

  useEffect(() => {
    setOneCardStarterSearchValue('')
    setTwoCardMainSearchValue('')
    setTwoCardPartnerSearchValue('')
    setShowSelectedOnly(false)
    setShowSelectedPartnersOnly(false)
    setMainCardPickerRowId(null)
    setPartnerEditorRowId(null)
  }, [model.mainDeckEntries])

  useEffect(() => {
    const previousCount = previousTwoCardRowCountRef.current
    const currentRows = model.twoCardStarterRows

    if (currentRows.length === 0) {
      setActiveTwoCardRowId(null)
      setMainCardPickerRowId(null)
      setPartnerEditorRowId(null)
    } else if (currentRows.length > previousCount) {
      const newestRowId = currentRows[currentRows.length - 1]?.id ?? null
      setActiveTwoCardRowId(newestRowId)
      setMainCardPickerRowId(newestRowId)
      setPartnerEditorRowId(null)
      setTwoCardMainSearchValue('')
      setTwoCardPartnerSearchValue('')
      setShowSelectedPartnersOnly(false)
    } else if (
      activeTwoCardRowId !== null &&
      !currentRows.some((row) => row.id === activeTwoCardRowId)
    ) {
      setActiveTwoCardRowId(currentRows[0]?.id ?? null)
    }

    if (!currentRows.some((row) => row.id === mainCardPickerRowId)) {
      setMainCardPickerRowId(null)
    }

    if (!currentRows.some((row) => row.id === partnerEditorRowId)) {
      setPartnerEditorRowId(null)
    }

    previousTwoCardRowCountRef.current = currentRows.length
  }, [
    activeTwoCardRowId,
    mainCardPickerRowId,
    model.twoCardStarterRows,
    partnerEditorRowId,
  ])

  const configuredTwoCardRows = model.twoCardStarterRows.filter(
    (row) => row.mainEntry !== null && row.supplementEntries.length > 0,
  )
  const tabSummary =
    activeTab === 'one-card'
      ? `${model.selectedOneCardStarterEntries.length} 张卡 / ${model.starterCopies} 张拷贝`
      : configuredTwoCardRows.length > 0
        ? `${configuredTwoCardRows.length} 条组合已完成`
        : model.twoCardStarterRows.length > 0
          ? '为每一行分别指定主启动和搭配卡'
          : '新增主启动行后开始配置'
  const normalizedOneCardStarterSearchValue = deferredOneCardStarterSearchValue
    .trim()
    .toLocaleLowerCase()
  const normalizedTwoCardMainSearchValue = deferredTwoCardMainSearchValue
    .trim()
    .toLocaleLowerCase()
  const normalizedTwoCardPartnerSearchValue = deferredTwoCardPartnerSearchValue
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

  function getAvailableTwoCardMainEntries(
    rowId: string,
    rowMainCardId: string | null,
  ) {
    const usedMainIds = new Set(
      model.twoCardStarterRows.flatMap((row) =>
        row.id !== rowId && row.mainCardId ? [row.mainCardId] : [],
      ),
    )

    return model.mainDeckEntries.filter((entry) => {
      if (model.selectedOneCardStarterIds.includes(entry.id)) {
        return false
      }

      return entry.id === rowMainCardId || !usedMainIds.has(entry.id)
    })
  }

  function toggleTwoCardRowDetails(rowId: string) {
    if (activeTwoCardRowId === rowId) {
      setActiveTwoCardRowId(null)
      setMainCardPickerRowId(null)
      setPartnerEditorRowId(null)
      return
    }

    setActiveTwoCardRowId(rowId)
    setMainCardPickerRowId(null)
    setPartnerEditorRowId(null)
    setTwoCardMainSearchValue('')
    setTwoCardPartnerSearchValue('')
    setShowSelectedPartnersOnly(false)
  }

  function toggleTwoCardMainPicker(rowId: string) {
    setActiveTwoCardRowId(rowId)
    setPartnerEditorRowId(null)
    setTwoCardPartnerSearchValue('')
    setShowSelectedPartnersOnly(false)
    setTwoCardMainSearchValue('')
    setMainCardPickerRowId((current) => (current === rowId ? null : rowId))
  }

  function toggleTwoCardPartnerEditor(rowId: string) {
    setActiveTwoCardRowId(rowId)
    setMainCardPickerRowId(null)
    setTwoCardMainSearchValue('')
    setTwoCardPartnerSearchValue('')
    setShowSelectedPartnersOnly(false)
    setPartnerEditorRowId((current) => (current === rowId ? null : rowId))
  }

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
                默认只保留主启动和搭配摘要，需要时再展开选择器或编辑卡池，减少长期占用的空间。
              </span>
            </div>

            <div className="two-card-row-toolbar">
              <div>
                <strong>主启动行</strong>
                <span>先选主启动，再按需展开搭配卡详情。</span>
              </div>
              <button
                className="starter-picker-toggle"
                type="button"
                onClick={() => model.addTwoCardStarterRow()}
              >
                新增主启动行
              </button>
            </div>

            {model.twoCardStarterRows.length > 0 ? (
              <div className="two-card-row-list" role="list">
                {model.twoCardStarterRows.map((row, index) => {
                  const isActive = row.id === activeTwoCardRowId
                  const isMainPickerOpen = row.id === mainCardPickerRowId
                  const isPartnerEditorOpen = row.id === partnerEditorRowId
                  const supplementCopies = getSupplementCopies(row)
                  const availableTwoCardMainEntries = getAvailableTwoCardMainEntries(
                    row.id,
                    row.mainCardId,
                  )
                  const visibleTwoCardMainEntries =
                    availableTwoCardMainEntries.filter((entry) =>
                      matchesStarterSearch(entry, normalizedTwoCardMainSearchValue),
                    )
                  const selectedPartnerIds = new Set(row.supplementCardIds)
                  const otherTwoCardMainIds = new Set(
                    model.twoCardStarterRows.flatMap((candidate) =>
                      candidate.id !== row.id && candidate.mainCardId
                        ? [candidate.mainCardId]
                        : [],
                    ),
                  )
                  const visibleTwoCardPartnerEntries = row.mainEntry
                    ? model.mainDeckEntries.filter((entry) => {
                        if (entry.id === row.mainCardId) {
                          return false
                        }

                        if (model.selectedOneCardStarterIds.includes(entry.id)) {
                          return false
                        }

                        if (
                          showSelectedPartnersOnly &&
                          !selectedPartnerIds.has(entry.id)
                        ) {
                          return false
                        }

                        return matchesStarterSearch(
                          entry,
                          normalizedTwoCardPartnerSearchValue,
                        )
                      })
                    : []
                  const previewEntries = row.supplementEntries.slice(0, 3)
                  const remainingPreviewCount =
                    row.supplementEntries.length - previewEntries.length

                  return (
                    <article
                      className={`two-card-row-card ${
                        isActive ? 'is-active' : ''
                      }`}
                      key={row.id}
                      role="listitem"
                    >
                      <div className="two-card-row-summary">
                        <div className="two-card-row-main-summary">
                          <div className="two-card-row-main-art">
                            {row.mainEntry?.imageUrl ? (
                              <img
                                alt={row.mainEntry.name}
                                draggable={false}
                                height={350}
                                loading="lazy"
                                src={row.mainEntry.imageUrl}
                                width={240}
                              />
                            ) : (
                              <div className="starter-card-fallback">
                                {row.mainEntry?.id ?? '主启动'}
                              </div>
                            )}
                          </div>

                          <div className="two-card-row-main-copy">
                            <span className="two-card-row-index">
                              行 {index + 1}
                            </span>
                            <strong>
                              {row.mainEntry?.name ?? '未选择主启动'}
                            </strong>
                            <span>
                              {row.mainEntry
                                ? `${row.mainEntry.copies}x 本体 · ${
                                    row.mainEntry.status === 'missing'
                                      ? '资料缺失'
                                      : row.mainEntry.id
                                  }`
                                : '展开详情后，从带卡图的选择器里挑选主启动卡。'}
                            </span>
                          </div>
                        </div>

                        <div className="two-card-row-stats">
                          <div>
                            <span>搭配卡</span>
                            <strong>{row.supplementEntries.length} 张</strong>
                          </div>
                          <div>
                            <span>搭配拷贝</span>
                            <strong>{supplementCopies} 张</strong>
                          </div>
                        </div>

                        <div className="two-card-row-preview">
                          {row.supplementEntries.length > 0 ? (
                            <>
                              {previewEntries.map((entry) => (
                                <span
                                  className="two-card-row-preview-chip"
                                  key={`${row.id}-${entry.id}`}
                                >
                                  {entry.name}
                                  <strong>{entry.copies}x</strong>
                                </span>
                              ))}
                              {remainingPreviewCount > 0 ? (
                                <span className="two-card-row-preview-chip is-muted">
                                  +{remainingPreviewCount} 张
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <p className="two-card-row-empty">
                              还没有搭配卡。展开详情后再精确指定。
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="two-card-row-actions">
                        <button
                          aria-expanded={isActive}
                          className="starter-picker-toggle"
                          type="button"
                          onClick={() => toggleTwoCardRowDetails(row.id)}
                        >
                          {isActive ? '收起详情' : '展开详情'}
                        </button>
                        <button
                          className="starter-picker-toggle"
                          type="button"
                          onClick={() => model.removeTwoCardStarterRow(row.id)}
                        >
                          移除此行
                        </button>
                      </div>

                      {isActive ? (
                        <div className="two-card-row-detail">
                          <section className="two-card-editor-section">
                            <div className="two-card-editor-section-head">
                              <div>
                                <strong>主启动卡</strong>
                                <span>
                                  只在需要时展开选择器，按卡图和卡名确认主启动。
                                </span>
                              </div>

                              <div className="two-card-editor-actions">
                                <button
                                  className={`starter-picker-toggle ${
                                    isMainPickerOpen ? 'is-active' : ''
                                  }`}
                                  type="button"
                                  onClick={() => toggleTwoCardMainPicker(row.id)}
                                >
                                  {isMainPickerOpen
                                    ? '收起选择器'
                                    : row.mainEntry
                                      ? '更换主启动'
                                      : '选择主启动卡'}
                                </button>
                                <button
                                  className="starter-picker-toggle"
                                  type="button"
                                  disabled={row.mainCardId === null}
                                  onClick={() => {
                                    setMainCardPickerRowId(null)
                                    setPartnerEditorRowId(null)
                                    model.updateTwoCardStarterRowMainCard(
                                      row.id,
                                      null,
                                    )
                                  }}
                                >
                                  清空
                                </button>
                              </div>
                            </div>

                            {row.mainEntry ? (
                              <div className="starter-selection-summary starter-main-card-summary starter-main-card-summary-compact">
                                <div className="starter-main-card-art">
                                  {row.mainEntry.imageUrl ? (
                                    <img
                                      alt={row.mainEntry.name}
                                      draggable={false}
                                      height={350}
                                      loading="lazy"
                                      src={row.mainEntry.imageUrl}
                                      width={240}
                                    />
                                  ) : (
                                    <div className="starter-card-fallback">
                                      {row.mainEntry.id}
                                    </div>
                                  )}
                                </div>
                                <div className="starter-main-card-copy">
                                  <strong>{row.mainEntry.name}</strong>
                                  <span>
                                    {row.mainEntry.copies}x 本体 ·{' '}
                                    {row.mainEntry.status === 'missing'
                                      ? '资料缺失'
                                      : row.mainEntry.id}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <p className="starter-config-note">
                                还没有主启动卡。打开选择器后可以直接看卡图挑选。
                              </p>
                            )}

                            {isMainPickerOpen ? (
                              <div className="two-card-main-picker">
                                <label
                                  className="starter-picker-search"
                                  htmlFor={`two-card-main-search-${row.id}`}
                                >
                                  <span>按卡名或卡号筛选主启动卡</span>
                                  <input
                                    id={`two-card-main-search-${row.id}`}
                                    className="starter-picker-search-input"
                                    type="search"
                                    autoComplete="off"
                                    placeholder="例如 灰流丽 / Ash Blossom / 14558127"
                                    value={twoCardMainSearchValue}
                                    onChange={(event) =>
                                      setTwoCardMainSearchValue(
                                        event.target.value,
                                      )
                                    }
                                  />
                                </label>

                                {visibleTwoCardMainEntries.length > 0 ? (
                                  <div
                                    className="two-card-main-picker-grid"
                                    role="list"
                                    aria-label={`主启动卡选择 ${index + 1}`}
                                  >
                                    {visibleTwoCardMainEntries.map((entry) => {
                                      const isSelected =
                                        row.mainCardId === entry.id

                                      return (
                                        <button
                                          aria-pressed={isSelected}
                                          className={`two-card-main-picker-card ${
                                            isSelected ? 'is-selected' : ''
                                          }`}
                                          key={`${row.id}-${entry.id}`}
                                          type="button"
                                          onClick={() => {
                                            setMainCardPickerRowId(null)
                                            setTwoCardMainSearchValue('')
                                            model.updateTwoCardStarterRowMainCard(
                                              row.id,
                                              entry.id,
                                            )
                                          }}
                                        >
                                          <div className="two-card-main-picker-art">
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
                                          </div>
                                        </button>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <p className="starter-config-note">
                                    没有匹配当前筛选条件的主卡组卡片。
                                  </p>
                                )}
                              </div>
                            ) : null}
                          </section>

                          <section className="two-card-editor-section">
                            <div className="two-card-editor-section-head">
                              <div>
                                <strong>搭配卡</strong>
                                <span>
                                  先看摘要，需要修改时再展开完整卡池。与其他行重叠的卡会自动去重。
                                </span>
                              </div>

                              <div className="two-card-editor-actions">
                                <button
                                  className={`starter-picker-toggle ${
                                    isPartnerEditorOpen ? 'is-active' : ''
                                  }`}
                                  type="button"
                                  disabled={row.mainEntry === null}
                                  onClick={() =>
                                    toggleTwoCardPartnerEditor(row.id)
                                  }
                                >
                                  {isPartnerEditorOpen
                                    ? '收起搭配编辑'
                                    : row.supplementEntries.length > 0
                                      ? '编辑搭配卡'
                                      : '选择搭配卡'}
                                </button>
                                <button
                                  className="starter-picker-toggle"
                                  type="button"
                                  disabled={row.supplementEntries.length === 0}
                                  onClick={() => {
                                    setPartnerEditorRowId(null)
                                    model.clearTwoCardStarterRowSupplements(
                                      row.id,
                                    )
                                  }}
                                >
                                  清空搭配卡
                                </button>
                              </div>
                            </div>

                            {row.mainEntry ? (
                              row.supplementEntries.length > 0 ? (
                                <div className="two-card-selected-partners">
                                  <div className="two-card-selected-partners-stats">
                                    <span>
                                      已选 {row.supplementEntries.length} 张搭配卡
                                    </span>
                                    <strong>{supplementCopies} 张拷贝</strong>
                                  </div>
                                  <div
                                    className="two-card-selected-partners-list"
                                    role="list"
                                    aria-label={`已选搭配卡 ${index + 1}`}
                                  >
                                    {row.supplementEntries.map((entry) => (
                                      <div
                                        className="two-card-selected-partner"
                                        key={`${row.id}-selected-${entry.id}`}
                                        role="listitem"
                                      >
                                        <div className="two-card-selected-partner-copy">
                                          <strong>{entry.name}</strong>
                                          <span>
                                            {entry.copies}x ·{' '}
                                            {entry.status === 'missing'
                                              ? '资料缺失'
                                              : entry.id}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="starter-config-note">
                                  还没有搭配卡。展开编辑后，只勾选真正能和这张主启动形成二卡动的卡。
                                </p>
                              )
                            ) : (
                              <p className="starter-config-note">
                                先选择主启动卡，再配置搭配卡。
                              </p>
                            )}

                            {row.mainEntry && isPartnerEditorOpen ? (
                              <>
                                <div className="starter-picker-toolbar">
                                  <label
                                    className="starter-picker-search"
                                    htmlFor={`two-card-partner-search-${row.id}`}
                                  >
                                    <span>按卡名或卡号筛选搭配卡</span>
                                    <input
                                      id={`two-card-partner-search-${row.id}`}
                                      className="starter-picker-search-input"
                                      type="search"
                                      autoComplete="off"
                                      placeholder="例如 增殖的G / Maxx C / 23434538"
                                      value={twoCardPartnerSearchValue}
                                      onChange={(event) =>
                                        setTwoCardPartnerSearchValue(
                                          event.target.value,
                                        )
                                      }
                                    />
                                  </label>

                                  <div className="starter-picker-actions">
                                    <button
                                      className={`starter-picker-toggle ${
                                        showSelectedPartnersOnly
                                          ? 'is-active'
                                          : ''
                                      }`}
                                      type="button"
                                      onClick={() =>
                                        setShowSelectedPartnersOnly(
                                          (current) => !current,
                                        )
                                      }
                                    >
                                      {showSelectedPartnersOnly
                                        ? '显示全部'
                                        : '仅看已选'}
                                    </button>
                                  </div>
                                </div>

                                {visibleTwoCardPartnerEntries.length > 0 ? (
                                  <div
                                    className="starter-picker-list"
                                    role="list"
                                    aria-label={`二卡动搭配卡选择 ${index + 1}`}
                                  >
                                    {visibleTwoCardPartnerEntries.map((entry) => {
                                      const isSelected = selectedPartnerIds.has(
                                        entry.id,
                                      )
                                      const isOtherTwoCardMain =
                                        otherTwoCardMainIds.has(entry.id)

                                      return (
                                        <button
                                          aria-pressed={isSelected}
                                          className={`starter-picker-row ${
                                            isSelected ? 'is-selected' : ''
                                          }`}
                                          key={`${row.id}-${entry.id}`}
                                          type="button"
                                          onClick={() =>
                                            model.toggleTwoCardStarterRowSupplement(
                                              row.id,
                                              entry.id,
                                            )
                                          }
                                        >
                                          <div className="starter-picker-row-art">
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
                                          </div>

                                          <div className="starter-picker-row-copy">
                                            <strong>{entry.name}</strong>
                                            <span>
                                              {entry.copies}x ·{' '}
                                              {entry.status === 'missing'
                                                ? '资料缺失'
                                                : entry.id}
                                            </span>
                                            {isOtherTwoCardMain ? (
                                              <span className="starter-main-card-flag">
                                                其他主启动
                                              </span>
                                            ) : null}
                                          </div>

                                          <span className="starter-picker-row-state">
                                            {isSelected ? '已选' : '选择'}
                                          </span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <p className="starter-config-note">
                                    {showSelectedPartnersOnly
                                      ? '当前这一行还没有已选搭配卡。'
                                      : '没有匹配当前筛选条件的主卡组卡片。'}
                                  </p>
                                )}
                              </>
                            ) : null}
                          </section>
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="starter-config-note">
                还没有主启动行。新增一行后，就可以为每张主启动独立配置能配合它的卡。
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
  const configuredTwoCardRows = model.twoCardStarterRows.filter(
    (row) => row.mainEntry !== null && row.supplementEntries.length > 0,
  )
  const hasTwoCardConfig = configuredTwoCardRows.length > 0

  return (
    <section className="surface-panel rate-panel">
      <p className="panel-kicker">整体起手率</p>
      <div className="rate-panel-main">
        <strong>{formatPercent(overallStartRate)}</strong>
        <span>
          {model.starterCopies === 0 && !hasTwoCardConfig
            ? '先配置一卡动或二卡动，这里会显示整体起手率。'
            : model.starterCopies > 0 && hasTwoCardConfig
              ? `已把 ${model.selectedOneCardStarterEntries.length} 张一卡动（共 ${model.starterCopies} 张拷贝）和 ${configuredTwoCardRows.length} 条二卡动组合按实际卡片搭配合并计算。`
              : model.starterCopies > 0
                ? `当前按已选的一卡动 ${model.selectedOneCardStarterEntries.length} 张卡、共 ${model.starterCopies} 张拷贝计算。`
                : `当前按 ${configuredTwoCardRows.length} 条二卡动组合的实际卡片搭配计算。`}
        </span>
      </div>
    </section>
  )
}
