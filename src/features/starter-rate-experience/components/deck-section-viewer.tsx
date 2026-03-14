import { useState } from 'react'
import type { DeckSection } from '../../../lib/ydk'
import type { WorkbenchModel } from '../hooks/use-deck-workbench'
import { SECTION_LABELS, SECTION_ORDER } from '../lib/constants'
import { getSortDirectionMark, sortDeckEntries } from '../lib/utils'
import type { DeckSortKey, DeckViewMode } from '../types'

export function DeckSectionViewer({ model }: { model: WorkbenchModel }) {
  const [activeSection, setActiveSection] = useState<DeckSection>('main')
  const [sortKey, setSortKey] = useState<DeckSortKey>('copies')
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc')
  const [viewMode, setViewMode] = useState<DeckViewMode>('table')
  const [isExpanded, setIsExpanded] = useState(false)

  if (!model.deckView) {
    return (
      <section className="surface-panel starter-grid-panel">
        <p className="empty-panel-copy">请先导入卡组，再进入分析页。</p>
      </section>
    )
  }

  const activeDeckSection =
    model.deckView.sections.find((section) => section.key === activeSection) ??
    model.deckView.sections[0]
  const sortedEntries = sortDeckEntries(
    activeDeckSection.entries,
    sortKey,
    sortDirection,
  )
  const compactViewAvailable = activeSection === 'main'
  const showCompactView = compactViewAvailable && viewMode === 'compact-main'
  const previewDeckSection =
    model.deckView.sections.find((section) => section.key === 'main') ??
    activeDeckSection
  const previewEntries = previewDeckSection.entries.slice(0, 5)

  function handleSectionChange(section: DeckSection) {
    setActiveSection(section)

    if (section !== 'main') {
      setViewMode('table')
    }
  }

  function handleSortChange(nextKey: DeckSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(nextKey)
    setSortDirection(
      nextKey === 'name' || nextKey === 'details' ? 'asc' : 'desc',
    )
  }

  return (
    <section
      className={`surface-panel deck-view-panel ${
        isExpanded ? 'is-expanded' : 'is-collapsed'
      }`}
    >
      <div className="panel-header-row">
        <div>
          <p className="panel-kicker">卡组对照</p>
          <h2>需要核对卡表时，再展开查看。</h2>
        </div>
        <button
          className="secondary-button deck-reference-toggle"
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? '收起卡表' : '展开卡表'}
        </button>
      </div>

      <p className="starter-grid-note">
        这一页默认把注意力放在起手率上。只有在你想核对卡名、张数或主额副分区时，再把卡表展开就行。
      </p>

      <div className="deck-stage-meta">
        <div>
          <span>主卡组</span>
          <strong>{model.mainDeckSize}</strong>
        </div>
        <div>
          <span>不同卡片</span>
          <strong>{model.deckView.uniqueCards}</strong>
        </div>
        <div>
          <span>缺失资料</span>
          <strong>{model.deckView.missingCards}</strong>
        </div>
      </div>

      {isExpanded ? (
        <div className="deck-reference-shell">
          <div className="section-tabs" role="tablist" aria-label="卡组分区">
            {SECTION_ORDER.map((section) => {
              const totalCards =
                model.deckView?.sections.find((entry) => entry.key === section)
                  ?.totalCards ?? 0

              return (
                <button
                  key={section}
                  className={`section-tab ${
                    activeSection === section ? 'is-active' : ''
                  }`}
                  type="button"
                  role="tab"
                  aria-selected={activeSection === section}
                  onClick={() => handleSectionChange(section)}
                >
                  {SECTION_LABELS[section]} · {totalCards}
                </button>
              )
            })}
          </div>

          <div className="deck-view-toolbar">
            <div
              className="deck-view-mode-toggle"
              role="tablist"
              aria-label="卡表视图模式"
            >
              <button
                className={`section-tab ${
                  viewMode === 'table' ? 'is-active' : ''
                }`}
                type="button"
                role="tab"
                aria-selected={viewMode === 'table'}
                onClick={() => setViewMode('table')}
              >
                表格视图
              </button>
              <button
                className={`section-tab ${showCompactView ? 'is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={showCompactView}
                disabled={!compactViewAvailable}
                title={
                  compactViewAvailable
                    ? '以高密度文本列表显示主卡组。'
                    : '紧凑视图目前只支持主卡组。'
                }
                onClick={() => {
                  if (compactViewAvailable) {
                    setViewMode('compact-main')
                  }
                }}
              >
                主卡组紧凑视图
              </button>
            </div>
            <p className="deck-view-toolbar-note">
              {showCompactView
                ? '主卡组高密度文本模式。'
                : '点击表头可以对当前分区排序。'}
            </p>
          </div>

          {showCompactView ? (
            <div className="deck-compact-list" aria-label="主卡组紧凑列表">
              {sortedEntries.map((entry) => (
                <div
                  className="deck-compact-line"
                  key={`${activeSection}-${entry.id}`}
                >
                  <span className="deck-compact-copies">{entry.copies}x</span>
                  <span className="deck-compact-name">{entry.name}</span>
                  <span className="deck-compact-id">{entry.id}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="deck-table-shell">
              <table className="deck-table">
                <thead>
                  <tr>
                    <th scope="col">卡图</th>
                    <th scope="col">
                      <button
                        className="deck-sort-button"
                        type="button"
                        onClick={() => handleSortChange('name')}
                      >
                        卡名
                        <span aria-hidden="true">
                          {sortKey === 'name'
                            ? getSortDirectionMark(sortDirection)
                            : '↕'}
                        </span>
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        className="deck-sort-button"
                        type="button"
                        onClick={() => handleSortChange('copies')}
                      >
                        数量
                        <span aria-hidden="true">
                          {sortKey === 'copies'
                            ? getSortDirectionMark(sortDirection)
                            : '↕'}
                        </span>
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        className="deck-sort-button"
                        type="button"
                        onClick={() => handleSortChange('id')}
                      >
                        卡号
                        <span aria-hidden="true">
                          {sortKey === 'id'
                            ? getSortDirectionMark(sortDirection)
                            : '↕'}
                        </span>
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        className="deck-sort-button"
                        type="button"
                        onClick={() => handleSortChange('details')}
                      >
                        信息
                        <span aria-hidden="true">
                          {sortKey === 'details'
                            ? getSortDirectionMark(sortDirection)
                            : '↕'}
                        </span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry) => (
                    <tr key={`${activeSection}-${entry.id}`}>
                      <td className="deck-table-art-cell">
                        <div className="deck-list-art">
                          {entry.imageUrl ? (
                            <img
                              alt={entry.name}
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
                      </td>
                      <td>
                        <div className="deck-list-content">
                          <strong>{entry.name}</strong>
                        </div>
                      </td>
                      <td className="deck-list-count">
                        <span className="deck-list-copies">
                          {entry.copies}x
                        </span>
                      </td>
                      <td className="deck-table-id-cell">
                        {entry.status === 'missing' ? '资料缺失' : entry.id}
                      </td>
                      <td>
                        <div className="deck-list-meta">
                          {entry.details.length > 0 ? (
                            <span className="deck-list-detail">
                              {entry.details.join(' · ')}
                            </span>
                          ) : (
                            <span className="deck-list-detail">
                              暂无更多资料。
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="deck-reference-collapsed">
          <div className="deck-reference-peek">
            {previewEntries.map((entry) => (
              <span className="deck-reference-pill" key={`peek-${entry.id}`}>
                {entry.copies}x {entry.name}
              </span>
            ))}
          </div>
          <p className="deck-reference-collapsed-note">
            默认收起卡表，方便你先把注意力放在起手率计算上。
          </p>
        </div>
      )}
    </section>
  )
}
