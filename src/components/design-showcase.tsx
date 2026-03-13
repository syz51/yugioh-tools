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
        <div className="experience-topbar-links">
          <Link className="experience-topbar-link" to="/about">
            About
          </Link>
        </div>
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
              <section className="landing-hero">
                <div className="landing-copy">
                  <p className="landing-kicker">
                    Yu-Gi-Oh starter-rate playground
                  </p>
                  <h1>
                    Load the deck first. Then move into the starter-rate board.
                  </h1>
                  <p className="landing-body">
                    Stage one is only for import. Upload a <code>.ydk</code>{' '}
                    file or paste raw YDK text here, and once the deck is loaded
                    the app switches to a separate analysis page for one-card
                    starter math.
                  </p>
                </div>

                <div className="landing-side">
                  <div className="landing-note-card">
                    <p>Flow</p>
                    <strong>1. Import deck</strong>
                    <strong>2. Enter one-card starter count</strong>
                    <strong>3. Review deck and live rate</strong>
                  </div>
                  <div className="landing-note-card">
                    <p>Scope</p>
                    <strong>Main-deck starters only for now</strong>
                    <span>
                      Extra deck and more advanced combo recipes can layer in
                      later without changing the foundation.
                    </span>
                  </div>
                </div>
              </section>

              <div className="landing-grid">
                <LandingDeckInput inputId={inputId} model={model} />
                <div className="landing-right-rail">
                  <StatusPanel model={model} />
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
                <aside className="analysis-rail">
                  <StarterCountPanel model={model} />
                  <RateBoard model={model} />
                  <DeckSummaryPanel model={model} />
                  <DeckLedgerPanel model={model} />
                </aside>

                <section className="analysis-canvas">
                  <DeckSectionViewer model={model} />
                </section>
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
  const mainDeckEntries = mainSection?.entries ?? []
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
    const clamped = Math.max(0, Math.min(mainDeckSize, Math.floor(nextValue)))
    setStarterCopies(clamped)
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
    mainDeckEntries,
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
      <div className="panel-header-row">
        <div>
          <p className="panel-kicker">Deck Import</p>
          <h2>Bring in a YDK list.</h2>
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
        <label className="primary-button" htmlFor={inputId}>
          Upload .ydk
        </label>
      </div>

      <div className="panel-action-row">
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
      <p className="panel-kicker">How it works</p>
      <div className="guide-list">
        <article>
          <strong>Stage one</strong>
          <p>
            Upload a simulator-exported YDK file or paste the raw deck text.
          </p>
        </article>
        <article>
          <strong>Stage two</strong>
          <p>
            Enter the total number of one-card starter copies in the main deck.
          </p>
        </article>
        <article>
          <strong>Result</strong>
          <p>
            The app shows the exact opening-hand rate for finding at least one.
          </p>
        </article>
      </div>
    </section>
  )
}

function StatusPanel({ model }: { model: WorkbenchModel }) {
  return (
    <section className="surface-panel status-panel" aria-live="polite">
      <div className="panel-header-row compact">
        <div>
          <p className="panel-kicker">Deck Status</p>
          <h2>Import pulse</h2>
        </div>
      </div>

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

      <dl className="status-grid">
        <div>
          <dt>Main</dt>
          <dd>
            {model.deckView?.sections.find((section) => section.key === 'main')
              ?.totalCards ?? 0}
          </dd>
        </div>
        <div>
          <dt>Extra</dt>
          <dd>
            {model.deckView?.sections.find((section) => section.key === 'extra')
              ?.totalCards ?? 0}
          </dd>
        </div>
        <div>
          <dt>Side</dt>
          <dd>
            {model.deckView?.sections.find((section) => section.key === 'side')
              ?.totalCards ?? 0}
          </dd>
        </div>
        <div>
          <dt>Unique</dt>
          <dd>{model.deckView?.uniqueCards ?? 0}</dd>
        </div>
      </dl>
    </section>
  )
}

function ConfigHero({ model }: { model: WorkbenchModel }) {
  return (
    <section className="surface-panel config-hero analysis-hero">
      <div className="analysis-toolbar-title">
        <p className="panel-kicker">One-card starter board</p>
        <h2>Deck analysis</h2>
      </div>

      <div className="analysis-toolbar-stats">
        <div>
          <span>Main deck</span>
          <strong>{model.mainDeckSize}</strong>
        </div>
        <div>
          <span>Starter copies</span>
          <strong>{model.starterCopies}</strong>
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
  const commonCounts = [6, 9, 12, 15, 18].filter(
    (count) => count <= model.mainDeckSize,
  )

  return (
    <section className="surface-panel side-panel starter-count-panel">
      <div className="panel-header-row compact">
        <div>
          <p className="panel-kicker">Starter Input</p>
          <h2>How many one-card starters are you running?</h2>
        </div>
      </div>

      <label className="starter-count-field" htmlFor="starter-count-input">
        <span>Total starter copies in main deck</span>
        <input
          id="starter-count-input"
          className="starter-count-input"
          type="number"
          min={0}
          max={model.mainDeckSize}
          step={1}
          value={model.starterCopies}
          onChange={(event) => {
            const nextValue = Number(event.target.value)
            model.updateStarterCopies(
              Number.isFinite(nextValue) ? nextValue : 0,
            )
          }}
        />
      </label>

      <input
        className="starter-count-range"
        type="range"
        min={0}
        max={model.mainDeckSize}
        step={1}
        value={model.starterCopies}
        onChange={(event) => {
          model.updateStarterCopies(Number(event.target.value))
        }}
      />

      <div className="preset-row">
        {commonCounts.map((count) => (
          <button
            key={count}
            className={`preset-chip ${
              model.starterCopies === count ? 'is-active' : ''
            }`}
            type="button"
            onClick={() => model.updateStarterCopies(count)}
          >
            {count}
          </button>
        ))}
      </div>

      <p className="starter-count-caption">
        The calculation uses your main-deck size of {model.mainDeckSize} and
        assumes any of these {model.starterCopies} copies count as a valid
        one-card starter.
      </p>
    </section>
  )
}

function RateBoard({ model }: { model: WorkbenchModel }) {
  const startRate = model.combinedStarterResult?.openingHandProbability ?? 0
  const whiffRate = model.combinedStarterResult ? 1 - startRate : 0

  return (
    <section className="surface-panel rate-panel">
      <p className="panel-kicker">Start Rate</p>
      <div className="rate-panel-main">
        <strong>{formatPercent(startRate)}</strong>
        <span>
          {model.starterCopies === 0
            ? 'Enter a starter count above to calculate.'
            : `${model.starterCopies} one-card starter copies in a ${model.mainDeckSize}-card main deck.`}
        </span>
      </div>

      <div className="rate-grid">
        <article>
          <p>Miss rate</p>
          <strong>{formatPercent(whiffRate)}</strong>
        </article>
        <article>
          <p>Main deck</p>
          <strong>{model.mainDeckSize}</strong>
        </article>
        <article>
          <p>Starter copies</p>
          <strong>{model.starterCopies}</strong>
        </article>
        <article>
          <p>Source</p>
          <strong>
            {model.deckView?.sourceName ?? model.sourceName ?? 'Pasted deck'}
          </strong>
        </article>
      </div>
    </section>
  )
}

function DeckSectionViewer({ model }: { model: WorkbenchModel }) {
  const [activeSection, setActiveSection] = useState<DeckSection>('main')

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

  return (
    <section className="surface-panel deck-view-panel">
      <div className="panel-header-row">
        <div>
          <p className="panel-kicker">Deck Viewer</p>
          <h2>Review the uploaded deck while you tune the count.</h2>
        </div>
        <div className="section-tabs" role="tablist" aria-label="Deck sections">
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
                onClick={() => setActiveSection(section)}
              >
                {SECTION_LABELS[section]} · {totalCards}
              </button>
            )
          })}
        </div>
      </div>

      <p className="starter-grid-note">
        This page is for reference and verification. The calculation panel uses
        the number input, while the deck viewer keeps the imported list visible.
      </p>

      <div className="deck-list-header" aria-hidden="true">
        <span>Art</span>
        <span>Card</span>
        <span>Copies</span>
        <span>Password / Notes</span>
      </div>

      <div className="deck-stage-meta">
        <div>
          <span>Showing</span>
          <strong>{activeDeckSection.label}</strong>
        </div>
        <div>
          <span>Total cards</span>
          <strong>{activeDeckSection.totalCards}</strong>
        </div>
        <div>
          <span>Unique entries</span>
          <strong>{activeDeckSection.entries.length}</strong>
        </div>
      </div>

      <div className="deck-list">
        {activeDeckSection.entries.map((entry) => (
          <article
            className="deck-list-row"
            key={`${activeSection}-${entry.id}`}
          >
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
                <div className="starter-card-fallback">{entry.id}</div>
              )}
            </div>
            <div className="deck-list-content">
              <strong>{entry.name}</strong>
            </div>
            <div className="deck-list-count">
              <span className="deck-list-copies">{entry.copies}x</span>
            </div>
            <div className="deck-list-meta">
              <p>
                {entry.status === 'missing' ? 'Missing card data' : entry.id}
              </p>
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
          </article>
        ))}
      </div>
    </section>
  )
}

function DeckSummaryPanel({ model }: { model: WorkbenchModel }) {
  return (
    <section className="surface-panel side-panel">
      <div className="panel-header-row compact">
        <div>
          <p className="panel-kicker">Deck Shape</p>
          <h2>Section totals</h2>
        </div>
      </div>

      <div className="summary-grid">
        {SECTION_ORDER.map((section) => {
          const totalCards =
            model.deckView?.sections.find((entry) => entry.key === section)
              ?.totalCards ?? 0

          return (
            <article className="summary-card" key={section}>
              <p>{SECTION_LABELS[section]}</p>
              <strong>{totalCards}</strong>
            </article>
          )
        })}
      </div>

      {model.deckView?.warnings.length ? (
        <div className="warning-stack">
          {model.deckView.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function DeckLedgerPanel({ model }: { model: WorkbenchModel }) {
  return (
    <section className="surface-panel side-panel">
      <div className="panel-header-row compact">
        <div>
          <p className="panel-kicker">Deck Ledger</p>
          <h2>Import details</h2>
        </div>
      </div>

      <dl className="ledger-list">
        <div>
          <dt>Source</dt>
          <dd>
            {model.deckView?.sourceName ?? model.sourceName ?? 'Not loaded'}
          </dd>
        </div>
        <div>
          <dt>Created by</dt>
          <dd>{model.deckView?.createdBy ?? 'Unknown'}</dd>
        </div>
        <div>
          <dt>Imported</dt>
          <dd>{model.deckView?.importedAt ?? 'Waiting for deck'}</dd>
        </div>
        <div>
          <dt>Missing cards</dt>
          <dd>{model.deckView?.missingCards ?? 0}</dd>
        </div>
      </dl>
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
