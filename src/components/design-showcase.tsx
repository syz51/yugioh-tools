import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { startTransition, useEffect, useId, useRef, useState } from 'react'
import { calculateOpeningHandProbabilities } from '../lib/opening-hand-calculator'
import {
  collapseDeckSection,
  getDeckCardCount,
  getDeckCardIds,
  getUniqueDeckCardCount,
  parseYdk,
} from '../lib/ydk'
import type { DeckSection } from '../lib/ydk'
import type { DeckCardLookup } from '../lib/ygocdb'
import {
  fetchDeckCards,
  getCardImageUrl,
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
  main: 'Main Deck',
  extra: 'Extra Deck',
  side: 'Side Deck',
}

const MAX_UPLOAD_BYTES = 256 * 1024
const MAX_DECK_CARD_LINES = 256
const MAX_UNIQUE_CARD_IDS = 128
const CARD_FETCH_CONCURRENCY = 8

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
          <span>Yu-Gi-Oh Starter Rate</span>
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
                <LandingDeckInput inputId={inputId} model={model} />
                <div className="landing-right-rail">
                  <ImportGuidePanel />
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
              label: 'One-card starters',
              copies: starterCopies,
            },
          ],
          recipes: [
            {
              id: 'one-card-starter',
              label: 'Any one-card starter',
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
        'The deck is empty. Upload a .ydk file or paste valid YDK text with main, extra, or side sections.',
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
          : 'Unable to load card data from YGOCDB right now.',
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
        `The selected file is too large. Keep YDK uploads under ${formatByteLimit(
          MAX_UPLOAD_BYTES,
        )}.`,
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
    setSourceName('sample-blue-eyes.ydk')
    void importDeck(SAMPLE_YDK, 'sample-blue-eyes.ydk')
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
        <div className="deck-input-intro">
          <p className="panel-kicker">Stage one</p>
          <p className="deck-input-note">
            Upload a <code>.ydk</code> file or paste raw deck text to open the
            starter board immediately.
          </p>
        </div>
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
            Upload .ydk
          </label>
          <button
            className="secondary-button"
            type="button"
            disabled={model.isLoading}
            onClick={model.loadSampleDeck}
          >
            Load sample deck
          </button>
          <button
            className="secondary-button ghost"
            type="button"
            disabled={model.isLoading}
            onClick={model.clearWorkspace}
          >
            Clear
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
          <span>Paste YDK text</span>
          <textarea
            id={`${inputId}-editor`}
            className="deck-editor"
            placeholder={`#created by Your Name\n#main\n89631139\n89631139\n#extra\n!side`}
            value={model.draftText}
            onChange={(event) => model.setDraftText(event.target.value)}
          />
        </label>

        <div className="deck-submit-row">
          <button className="primary-button" type="submit">
            {model.isLoading ? 'Loading deck...' : 'Load into starter board'}
          </button>
          <div className="deck-limit-note">
            {MAX_DECK_CARD_LINES} lines · {MAX_UNIQUE_CARD_IDS} unique cards ·{' '}
            {formatByteLimit(MAX_UPLOAD_BYTES)} max upload
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
        <p className="panel-kicker">How it works</p>
        <p className="guide-panel-note">
          Everything you need for stage one is here. Import first, then tune
          starters on the next screen.
        </p>
      </div>
      <div className="guide-list">
        <article>
          <strong>Import</strong>
          <p>
            Upload a simulator-exported YDK file or paste the raw deck text.
          </p>
        </article>
        <article>
          <strong>Starter count</strong>
          <p>
            Enter the total number of one-card starter copies in the main deck.
          </p>
        </article>
        <article>
          <strong>Output</strong>
          <p>
            The app shows the exact opening-hand rate for finding at least one.
          </p>
        </article>
      </div>

      <dl className="guide-facts">
        <div>
          <dt>Accepted input</dt>
          <dd>.ydk upload or raw text paste</dd>
        </div>
        <div>
          <dt>Starter logic</dt>
          <dd>Main deck only</dd>
        </div>
        <div>
          <dt>Current limits</dt>
          <dd>
            {MAX_DECK_CARD_LINES} lines · {MAX_UNIQUE_CARD_IDS} unique ·{' '}
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
        <p className="status-message">Summoning card data from YGOCDB...</p>
      ) : model.deckView ? (
        <p className="status-message">
          {getTotalCards(model.deckView)} cards loaded from{' '}
          {model.deckView.sourceName ?? 'the pasted deck'}.
        </p>
      ) : (
        <p className="status-message">
          No deck loaded yet. Import a list to unlock the starter board.
        </p>
      )}
    </section>
  )
}

function ConfigHero({ model }: { model: WorkbenchModel }) {
  return (
    <section className="surface-panel config-hero analysis-hero">
      <div className="analysis-toolbar-title">
        <p className="panel-kicker">Starter-rate workspace</p>
        <h2>Opening-hand analysis</h2>
      </div>

      <div className="analysis-toolbar-stats">
        <div>
          <span>Main deck</span>
          <strong>{model.mainDeckSize}</strong>
        </div>
        <div>
          <span>Source</span>
          <strong>
            {model.deckView?.sourceName ?? model.sourceName ?? 'Pasted'}
          </strong>
        </div>
      </div>

      <div className="config-hero-actions analysis-toolbar-actions">
        <button
          className="secondary-button ghost"
          type="button"
          onClick={() => model.setStage('landing')}
        >
          Back to import
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
          <p className="panel-kicker">Starter Input</p>
          <h2>Set the live one-card starter count.</h2>
        </div>
      </div>

      <label className="starter-count-field" htmlFor="starter-count-input">
        <span>Total starter copies in main deck</span>
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
      <p className="panel-kicker">Opening Hand Rate</p>
      <div className="rate-panel-main">
        <strong>{formatPercent(startRate)}</strong>
        <span>
          {model.starterCopies === 0
            ? 'Enter a starter count above to calculate.'
            : 'This pass only calculates the total one-card starter rate. Recipe-level splits for 2-card and 3-card starters need combo rules first.'}
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
        <p className="empty-panel-copy">
          Load a deck first to open the analysis page.
        </p>
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
          <p className="panel-kicker">Deck Reference</p>
          <h2>Open the uploaded list only when you need a deck check.</h2>
        </div>
        <button
          className="secondary-button deck-reference-toggle"
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? 'Hide deck list' : 'Open deck list'}
        </button>
      </div>

      <p className="starter-grid-note">
        Stage two stays focused on the opening-hand rate. Open the imported deck
        only when you need to verify names, counts, or section splits before
        adding combo-specific rules later.
      </p>

      <div className="deck-stage-meta">
        <div>
          <span>Main deck</span>
          <strong>{model.mainDeckSize}</strong>
        </div>
        <div>
          <span>Unique cards</span>
          <strong>{model.deckView.uniqueCards}</strong>
        </div>
        <div>
          <span>Missing cards</span>
          <strong>{model.deckView.missingCards}</strong>
        </div>
      </div>

      {isExpanded ? (
        <div className="deck-reference-shell">
          <div
            className="section-tabs"
            role="tablist"
            aria-label="Deck sections"
          >
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
              aria-label="Deck view mode"
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
                Sortable table
              </button>
              <button
                className={`section-tab ${showCompactView ? 'is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={showCompactView}
                disabled={!compactViewAvailable}
                title={
                  compactViewAvailable
                    ? 'Show a compact text list for the main deck.'
                    : 'Compact mode is only available for the main deck.'
                }
                onClick={() => {
                  if (compactViewAvailable) {
                    setViewMode('compact-main')
                  }
                }}
              >
                Main deck only
              </button>
            </div>
            <p className="deck-view-toolbar-note">
              {showCompactView
                ? 'Extreme-density text mode for the main deck.'
                : 'Click column headers to sort the current section.'}
            </p>
          </div>

          {showCompactView ? (
            <div
              className="deck-compact-list"
              aria-label="Compact main deck list"
            >
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
                    <th scope="col">Art</th>
                    <th scope="col">
                      <button
                        className="deck-sort-button"
                        type="button"
                        onClick={() => handleSortChange('name')}
                      >
                        Card
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
                        Copies
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
                        Password
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
                        Notes
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
                        {entry.status === 'missing'
                          ? 'Missing card data'
                          : entry.id}
                      </td>
                      <td>
                        <div className="deck-list-meta">
                          {entry.details.length > 0 ? (
                            <span className="deck-list-detail">
                              {entry.details.join(' · ')}
                            </span>
                          ) : (
                            <span className="deck-list-detail">
                              No extra card text cached.
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
            Deck preview stays collapsed by default so the starter-rate math
            remains the primary job on this page.
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
            name: `Unknown card ${entry.id}`,
            imageUrl: null,
            details: [
              lookupEntry?.message ??
                `No card data was returned for password ${entry.id}.`,
            ],
          }
        }

        return {
          id: entry.id,
          copies: entry.copies,
          status: 'ready' as const,
          name: getPreferredCardName(lookupEntry.card, entry.id),
          imageUrl: getCardImageUrl(entry.id),
          details: (lookupEntry.card.text.types ?? '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 2),
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
    importedAt: new Intl.DateTimeFormat(undefined, {
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
    return `The pasted deck is too large. Keep YDK text under ${formatByteLimit(
      MAX_UPLOAD_BYTES,
    )}.`
  }

  const totalCards = getDeckCardCount(parsedDeck)
  if (totalCards > MAX_DECK_CARD_LINES) {
    return `This import lists ${totalCards} cards. The viewer currently accepts at most ${MAX_DECK_CARD_LINES} card lines per deck.`
  }

  const uniqueCards = getUniqueDeckCardCount(parsedDeck)
  if (uniqueCards > MAX_UNIQUE_CARD_IDS) {
    return `This import has ${uniqueCards} unique passwords. The viewer currently accepts at most ${MAX_UNIQUE_CARD_IDS} unique cards per deck.`
  }

  return null
}

function formatByteLimit(bytes: number) {
  return `${Math.round(bytes / 1024)} KB`
}

function formatPercent(value: number) {
  return new Intl.NumberFormat(undefined, {
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
      comparison = left.id.localeCompare(right.id, undefined, { numeric: true })
    } else if (sortKey === 'details') {
      comparison = left.details.join(' ').localeCompare(right.details.join(' '))
    } else {
      comparison = left.name.localeCompare(right.name)
    }

    if (comparison === 0) {
      comparison = left.name.localeCompare(right.name)
    }

    if (comparison === 0) {
      comparison = left.id.localeCompare(right.id, undefined, { numeric: true })
    }

    return comparison * direction
  })
}

function getSortDirectionMark(direction: 'asc' | 'desc') {
  return direction === 'asc' ? '↑' : '↓'
}

function choose(n: number, k: number) {
  if (k < 0 || k > n) {
    return 0
  }

  const normalizedK = Math.min(k, n - k)
  if (normalizedK === 0) {
    return 1
  }

  let result = 1
  for (let index = 1; index <= normalizedK; index += 1) {
    result = (result * (n - normalizedK + index)) / index
  }

  return result
}
