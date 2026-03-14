import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { startTransition, useEffect, useId, useRef, useState } from 'react'
import { calculateOpeningHandProbabilities } from '../lib/opening-hand-calculator'
import {
  collapseDeckSection,
  EXTRA_DECK_MAX_CARDS,
  getDeckConstructionError,
  getDeckCardCount,
  getDeckCardIds,
  getUniqueDeckCardCount,
  MAIN_DECK_MAX_CARDS,
  MAIN_DECK_MIN_CARDS,
  parseYdk,
  SIDE_DECK_MAX_CARDS,
} from '../lib/ydk'
import type { DeckSection } from '../lib/ydk'
import type { DeckCardLookup } from '../lib/ygocdb'
import {
  APP_LOCALE,
  fetchDeckCards,
  getCardImageUrl,
  getLocalizedCardDetails,
  getPreferredCardName,
} from '../lib/ygocdb'

type DeckCardView = {
  id: string
  copies: number
  status: DeckCardLookup['status']
  name: string
  imageUrl: string | null
  details: string[]
}

type DeckSectionView = {
  key: DeckSection
  label: string
  totalCards: number
  entries: DeckCardView[]
}

type DeckView = {
  createdBy: string | null
  importedAt: string
  sourceName: string | null
  warnings: string[]
  uniqueCards: number
  missingCards: number
  sections: DeckSectionView[]
}

type WorkbenchModel = ReturnType<typeof useDeckWorkbench>
type DeckSortKey = 'name' | 'copies' | 'id' | 'details'
type DeckViewMode = 'table' | 'compact-main'

const SECTION_ORDER: DeckSection[] = ['main', 'extra', 'side']

const SECTION_LABELS: Record<DeckSection, string> = {
  main: '主卡组',
  extra: '额外卡组',
  side: '副卡组',
}

const MAX_UPLOAD_BYTES = 256 * 1024
const CARD_FETCH_CONCURRENCY = 8

const SAMPLE_DECK_NAME = '示例-青眼白龙.ydk'
const SAMPLE_YDK = `#created by YGO Tools
#main
89631139
89631139
89631139
38517737
38517737
38517737
53129443
53129443
53129443
23995346
23995346
23995346
14558127
14558127
14558127
74677422
74677422
74677422
10000010
10000010
10000010
40908371
40908371
40908371
79814787
79814787
79814787
53183600
53183600
53183600
38517737
38517737
63767246
63767246
63767246
72989439
72989439
72989439
9777395
9777395
#extra
44508094
63767246
23995346
!side
5851097
5851097
102380
`

export function StarterRateExperiencePage() {
  const model = useDeckWorkbench()
  const inputId = useId()
  const shouldReduceMotion = useReducedMotion()

  return (
    <main className={`experience-shell stage-${model.stage}`}>
      <section className="experience-topbar">
        <Link className="experience-brand" to="/">
          <span className="experience-brand-mark" aria-hidden="true" />
          <span>游戏王启动率计算器</span>
        </Link>
      </section>

      <section className="experience-frame">
        <AnimatePresence mode="wait" initial={false}>
          {model.stage === 'landing' ? (
            <motion.div
              key="landing"
              className="experience-stage landing-stage"
              initial={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 0, y: 22, scale: 0.985 }
              }
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, scale: 1 }
              }
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -18, scale: 1.01 }
              }
              transition={{
                duration: shouldReduceMotion ? 0.12 : 0.42,
                ease: 'easeOut',
              }}
            >
              <div className="landing-grid">
                <ImportGuidePanel />
                <div className="landing-right-rail">
                  <LandingDeckInput inputId={inputId} model={model} />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="config"
              className="experience-stage config-stage analysis-stage"
              initial={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 0, x: 48, scale: 0.985 }
              }
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, x: 0, scale: 1 }
              }
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: -48, scale: 1.01 }
              }
              transition={{
                duration: shouldReduceMotion ? 0.12 : 0.44,
                ease: 'easeOut',
              }}
            >
              <ConfigHero model={model} />
              <div className="analysis-grid">
                <section className="analysis-canvas">
                  <StarterCountPanel model={model} />
                  <DeckSectionViewer model={model} />
                </section>
                <aside className="analysis-output-stack">
                  <RateBoard model={model} />
                </aside>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!shouldReduceMotion ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`wipe-${model.stage}`}
              className="stage-wipe"
              initial={{ clipPath: 'inset(0 100% 0 0)', opacity: 0.95 }}
              animate={{
                clipPath: [
                  'inset(0 100% 0 0)',
                  'inset(0 0% 0 0)',
                  'inset(0 0% 0 100%)',
                ],
                opacity: [0.65, 0.95, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
            />
          </AnimatePresence>
        ) : null}
      </section>
    </main>
  )
}

function useDeckWorkbench() {
  const latestRequestRef = useRef(0)
  const activeAbortControllerRef = useRef<AbortController | null>(null)
  const [draftText, setDraftText] = useState('')
  const [sourceName, setSourceName] = useState<string | null>(null)
  const [deckView, setDeckView] = useState<DeckView | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [stage, setStage] = useState<'landing' | 'config'>('landing')
  const [starterCopies, setStarterCopies] = useState(0)

  useEffect(() => {
    return () => {
      activeAbortControllerRef.current?.abort()
    }
  }, [])

  const mainSection =
    deckView?.sections.find((section) => section.key === 'main') ?? null
  const mainDeckSize = mainSection?.totalCards ?? 0

  useEffect(() => {
    if (!deckView) {
      setStarterCopies(0)
      setStage('landing')
      return
    }

    setStarterCopies((current) => {
      if (current > 0 && current <= mainDeckSize) {
        return current
      }

      return Math.min(12, mainDeckSize)
    })
  }, [deckView, mainDeckSize])

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

  async function importDeck(deckText: string, nextSourceName: string | null) {
    const parsed = parseYdk(deckText)
    const totalCards = getDeckCardCount(parsed)
    const limitError = getDeckImportLimitError(parsed, deckText)

    if (totalCards === 0) {
      activeAbortControllerRef.current?.abort()
      activeAbortControllerRef.current = null
      setIsLoading(false)
      setDeckView(null)
      setStage('landing')
      setErrorMessage(
        '卡组内容为空。请上传 .ydk 文件，或粘贴包含 main、extra、side 段落的有效 YDK 文本。',
      )
      return
    }

    if (limitError) {
      activeAbortControllerRef.current?.abort()
      activeAbortControllerRef.current = null
      setIsLoading(false)
      setDeckView(null)
      setStage('landing')
      setErrorMessage(limitError)
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    activeAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    activeAbortControllerRef.current = abortController

    const requestId = latestRequestRef.current + 1
    latestRequestRef.current = requestId

    try {
      const cardLookup = await fetchDeckCards(getDeckCardIds(parsed), {
        concurrency: CARD_FETCH_CONCURRENCY,
        signal: abortController.signal,
      })

      if (latestRequestRef.current !== requestId) {
        return
      }

      const nextDeckView = buildDeckView(parsed, cardLookup, nextSourceName)
      startTransition(() => {
        setDeckView(nextDeckView)
        setStage('config')
      })
    } catch (error) {
      if (latestRequestRef.current !== requestId) {
        return
      }

      if (isAbortError(error)) {
        return
      }

      setDeckView(null)
      setStage('landing')
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '暂时无法从 YGOCDB 拉取卡片资料。',
      )
    } finally {
      if (latestRequestRef.current === requestId) {
        if (activeAbortControllerRef.current === abortController) {
          activeAbortControllerRef.current = null
        }
        setIsLoading(false)
      }
    }
  }

  async function handleFileSelection(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      activeAbortControllerRef.current?.abort()
      activeAbortControllerRef.current = null
      setIsLoading(false)
      setDeckView(null)
      setStage('landing')
      setErrorMessage(
        `文件过大，请将 YDK 文件控制在 ${formatByteLimit(
          MAX_UPLOAD_BYTES,
        )} 以内。`,
      )
      return
    }

    const nextDraftText = await file.text()
    setDraftText(nextDraftText)
    setSourceName(file.name)
    await importDeck(nextDraftText, file.name)
  }

  function loadSampleDeck() {
    setDraftText(SAMPLE_YDK)
    setSourceName(SAMPLE_DECK_NAME)
    void importDeck(SAMPLE_YDK, SAMPLE_DECK_NAME)
  }

  function clearWorkspace() {
    latestRequestRef.current += 1
    activeAbortControllerRef.current?.abort()
    activeAbortControllerRef.current = null
    setDraftText('')
    setSourceName(null)
    setDeckView(null)
    setErrorMessage(null)
    setIsLoading(false)
    setStarterCopies(0)
    setStage('landing')
  }

  function updateStarterCopies(nextValue: number) {
    setStarterCopies(clampStarterCopies(nextValue, mainDeckSize))
  }

  return {
    combinedStarterResult,
    clearWorkspace,
    deckView,
    draftText,
    errorMessage,
    handleFileSelection,
    importDeck,
    isLoading,
    loadSampleDeck,
    mainDeckSize,
    setDraftText,
    setStage,
    sourceName,
    starterCopies,
    stage,
    updateStarterCopies,
  }
}

function LandingDeckInput({
  inputId,
  model,
}: {
  inputId: string
  model: WorkbenchModel
}) {
  return (
    <section className="surface-panel deck-input-panel">
      <div className="panel-header-row deck-input-header">
        <input
          id={inputId}
          className="sr-only"
          type="file"
          accept=".ydk,text/plain"
          disabled={model.isLoading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) {
              return
            }

            void model.handleFileSelection(file)
            event.target.value = ''
          }}
        />
        <div className="deck-input-actions">
          <label className="primary-button" htmlFor={inputId}>
            上传 .ydk
          </label>
          <button
            className="secondary-button"
            type="button"
            disabled={model.isLoading}
            onClick={model.loadSampleDeck}
          >
            载入示例卡组
          </button>
          <button
            className="secondary-button ghost"
            type="button"
            disabled={model.isLoading}
            onClick={model.clearWorkspace}
          >
            清空
          </button>
        </div>
      </div>

      <ImportStatusBanner model={model} />

      <form
        className="deck-editor-form"
        onSubmit={(event) => {
          event.preventDefault()
          void model.importDeck(model.draftText, model.sourceName)
        }}
      >
        <label className="deck-text-block" htmlFor={`${inputId}-editor`}>
          <span>直接粘贴</span>
          <textarea
            id={`${inputId}-editor`}
            className="deck-editor"
            placeholder={`#created by 你的名字\n#main\n89631139\n89631139\n#extra\n!side`}
            value={model.draftText}
            onChange={(event) => model.setDraftText(event.target.value)}
          />
        </label>

        <div className="deck-submit-row">
          <button className="primary-button" type="submit">
            {model.isLoading ? '正在载入卡组...' : '导入并开始分析'}
          </button>
          <div className="deck-limit-note">
            主卡组 {MAIN_DECK_MIN_CARDS} - {MAIN_DECK_MAX_CARDS} 张 ·
            额外卡组最多 {EXTRA_DECK_MAX_CARDS} 张 · 副卡组最多{' '}
            {SIDE_DECK_MAX_CARDS} 张 · 文件上限 {formatByteLimit(MAX_UPLOAD_BYTES)}
          </div>
        </div>
      </form>
    </section>
  )
}

function ImportGuidePanel() {
  return (
    <section className="surface-panel guide-panel">
      <div className="guide-panel-head">
        <p className="panel-kicker">使用说明</p>
        <h2>导入卡组，计算先手启动率。</h2>
      </div>
      <div className="guide-list">
        <article>
          <strong>1. 把卡表丢进来</strong>
          <p>
            上传模拟器导出的 <code>.ydk</code>{' '}
            文件，直接粘贴卡组文本，或者先用示例卡组试一下流程都可以。
          </p>
          <p>
            小提示：可以前往{' '}
            <a
              className="guide-inline-link"
              href="https://get-deck.com/"
              target="_blank"
              rel="noreferrer"
            >
              GetDeck工具
            </a>{' '}
            将截图导出为 <code>.ydk</code>。
          </p>
        </article>
        <article>
          <strong>2. 等它解析完成</strong>
          <p>
            系统会去补全卡片资料，准备好之后会自动跳到起手率面板，不需要手动切页。
          </p>
        </article>
        <article>
          <strong>3. 填一卡动数量，看命中率</strong>
          <p>
            在下一页输入主卡组里一共放了多少张一卡动，工具就会给出准确的起手命中率。
          </p>
        </article>
      </div>

      <dl className="guide-facts">
        <div>
          <dt>支持输入</dt>
          <dd>上传 .ydk 或直接粘贴文本</dd>
        </div>
        <div>
          <dt>切换方式</dt>
          <dd>导入成功后自动进入分析页</dd>
        </div>
        <div>
          <dt>统计范围</dt>
          <dd>目前只计算主卡组的一卡动</dd>
        </div>
        <div>
          <dt>当前限制</dt>
          <dd>
            主卡组 {MAIN_DECK_MIN_CARDS} - {MAIN_DECK_MAX_CARDS} 张 · 额外卡组最多{' '}
            {EXTRA_DECK_MAX_CARDS} 张 · 副卡组最多 {SIDE_DECK_MAX_CARDS} 张 ·{' '}
            {formatByteLimit(MAX_UPLOAD_BYTES)}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function ImportStatusBanner({ model }: { model: WorkbenchModel }) {
  return (
    <section className="import-status-banner" aria-live="polite">
      {model.errorMessage ? (
        <p className="status-message is-error">{model.errorMessage}</p>
      ) : model.isLoading ? (
        <p className="status-message">正在从 YGOCDB 拉取卡片资料...</p>
      ) : model.deckView ? (
        <p className="status-message">
          已载入 {getTotalCards(model.deckView)} 张卡，来源：
          {model.deckView.sourceName ?? '粘贴的卡组文本'}。
        </p>
      ) : (
        <p className="status-message">
          还没有导入卡组。先把卡表放进来，才能开始看起手率。
        </p>
      )}
    </section>
  )
}

function ConfigHero({ model }: { model: WorkbenchModel }) {
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
          <strong>
            {model.deckView?.sourceName ?? model.sourceName ?? '直接粘贴'}
          </strong>
        </div>
      </div>

      <div className="config-hero-actions analysis-toolbar-actions">
        <button
          className="secondary-button ghost"
          type="button"
          onClick={() => model.setStage('landing')}
        >
          返回导入页
        </button>
      </div>
    </section>
  )
}

function StarterCountPanel({ model }: { model: WorkbenchModel }) {
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

function RateBoard({ model }: { model: WorkbenchModel }) {
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

function DeckSectionViewer({ model }: { model: WorkbenchModel }) {
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

function buildDeckView(
  parsedDeck: ReturnType<typeof parseYdk>,
  lookup: Map<string, DeckCardLookup>,
  sourceName: string | null,
): DeckView {
  const sections = SECTION_ORDER.map((section) => {
    const cards = collapseDeckSection(parsedDeck.sections[section]).map(
      (entry) => {
        const lookupEntry = lookup.get(entry.id)

        if (!lookupEntry || lookupEntry.status === 'missing') {
          return {
            id: entry.id,
            copies: entry.copies,
            status: 'missing' as const,
            name: `未识别卡片 ${entry.id}`,
            imageUrl: null,
            details: [
              lookupEntry?.message ?? `未返回卡号 ${entry.id} 的卡片资料。`,
            ],
          }
        }

        return {
          id: entry.id,
          copies: entry.copies,
          status: 'ready' as const,
          name: getPreferredCardName(lookupEntry.card, entry.id),
          imageUrl: getCardImageUrl(entry.id),
          details: getLocalizedCardDetails(lookupEntry.card),
        }
      },
    )

    return {
      key: section,
      label: SECTION_LABELS[section],
      totalCards: parsedDeck.sections[section].length,
      entries: cards,
    }
  })

  return {
    createdBy: parsedDeck.createdBy,
    importedAt: new Intl.DateTimeFormat(APP_LOCALE, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date()),
    sourceName,
    warnings: parsedDeck.warnings,
    uniqueCards: lookup.size,
    missingCards: [...lookup.values()].filter(
      (entry) => entry.status === 'missing',
    ).length,
    sections,
  }
}

function getTotalCards(deckView: DeckView) {
  return deckView.sections.reduce((sum, section) => sum + section.totalCards, 0)
}

function getDeckImportLimitError(
  parsedDeck: ReturnType<typeof parseYdk>,
  deckText: string,
) {
  const textBytes = new TextEncoder().encode(deckText).length
  if (textBytes > MAX_UPLOAD_BYTES) {
    return `粘贴的卡组文本过大，请控制在 ${formatByteLimit(
      MAX_UPLOAD_BYTES,
    )} 以内。`
  }

  return getDeckConstructionError(parsedDeck)
}

function formatByteLimit(bytes: number) {
  return `${Math.round(bytes / 1024)} KB`
}

function formatPercent(value: number) {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function clampStarterCopies(value: number, mainDeckSize: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(mainDeckSize, Math.floor(value)))
}

function sortDeckEntries(
  entries: DeckCardView[],
  sortKey: DeckSortKey,
  sortDirection: 'asc' | 'desc',
) {
  const direction = sortDirection === 'asc' ? 1 : -1

  return [...entries].sort((left, right) => {
    let comparison = 0

    if (sortKey === 'copies') {
      comparison = left.copies - right.copies
    } else if (sortKey === 'id') {
      comparison = left.id.localeCompare(right.id, APP_LOCALE, {
        numeric: true,
      })
    } else if (sortKey === 'details') {
      comparison = left.details
        .join(' ')
        .localeCompare(right.details.join(' '), APP_LOCALE)
    } else {
      comparison = left.name.localeCompare(right.name, APP_LOCALE)
    }

    if (comparison === 0) {
      comparison = left.name.localeCompare(right.name, APP_LOCALE)
    }

    if (comparison === 0) {
      comparison = left.id.localeCompare(right.id, APP_LOCALE, {
        numeric: true,
      })
    }

    return comparison * direction
  })
}

function getSortDirectionMark(direction: 'asc' | 'desc') {
  return direction === 'asc' ? '↑' : '↓'
}
