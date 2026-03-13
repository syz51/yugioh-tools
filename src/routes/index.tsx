import { startTransition, useEffect, useId, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import type { DeckSection } from '../lib/ydk'
import {
  collapseDeckSection,
  getDeckCardCount,
  getDeckCardIds,
  getUniqueDeckCardCount,
  parseYdk,
} from '../lib/ydk'
import type { DeckCardLookup } from '../lib/ygocdb'
import {
  DEFAULT_CARD_FETCH_CONCURRENCY,
  fetchDeckCards,
  getCardImageUrl,
  getPreferredCardName,
} from '../lib/ygocdb'

export const Route = createFileRoute('/')({
  component: DeckViewerPage,
})

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

const SECTION_ORDER: DeckSection[] = ['main', 'extra', 'side']

const SECTION_LABELS: Record<DeckSection, string> = {
  main: 'Main Deck',
  extra: 'Extra Deck',
  side: 'Side Deck',
}

const MAX_UPLOAD_BYTES = 256 * 1024
const MAX_DECK_CARD_LINES = 256
const MAX_UNIQUE_CARD_IDS = 128
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
#extra
44508094
63767246
!side
5851097
5851097
102380
`

function DeckViewerPage() {
  const inputId = useId()
  const latestRequestRef = useRef(0)
  const activeAbortControllerRef = useRef<AbortController | null>(null)
  const [draftText, setDraftText] = useState('')
  const [sourceName, setSourceName] = useState<string | null>(null)
  const [deckView, setDeckView] = useState<DeckView | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    return () => {
      activeAbortControllerRef.current?.abort()
    }
  }, [])

  async function importDeck(deckText: string, nextSourceName: string | null) {
    const parsed = parseYdk(deckText)
    const totalCards = getDeckCardCount(parsed)
    const limitError = getDeckImportLimitError(parsed, deckText)

    if (totalCards === 0) {
      activeAbortControllerRef.current?.abort()
      activeAbortControllerRef.current = null
      setIsLoading(false)
      setDeckView(null)
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
      setErrorMessage(limitError)
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setDeckView(null)

    activeAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    activeAbortControllerRef.current = abortController

    const requestId = latestRequestRef.current + 1
    latestRequestRef.current = requestId

    try {
      const cardLookup = await fetchDeckCards(getDeckCardIds(parsed), {
        concurrency: DEFAULT_CARD_FETCH_CONCURRENCY,
        signal: abortController.signal,
      })

      if (latestRequestRef.current !== requestId) {
        return
      }

      const nextDeckView = buildDeckView(parsed, cardLookup, nextSourceName)
      startTransition(() => {
        setDeckView(nextDeckView)
      })
    } catch (error) {
      if (latestRequestRef.current !== requestId) {
        return
      }

      if (isAbortError(error)) {
        return
      }

      setDeckView(null)
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
  }

  return (
    <main className="page-wrap deck-page">
      <section className="page-intro">
        <div>
          <h1>Deck Viewer</h1>
          <p>
            Upload a <code>.ydk</code> file or paste raw YDK text. The app
            parses your main, extra, and side decks, then loads each unique card
            from the local cache before falling back to YGOCDB.
          </p>
          <p className="privacy-note">
            Card metadata and card art are requested from YGOCDB and its image
            CDN directly from your browser.
          </p>
        </div>
        <div className="page-intro-note">
          <span>Source</span>
          <strong>
            <a href="https://ygocdb.com/api" target="_blank" rel="noreferrer">
              YGOCDB API
            </a>
          </strong>
        </div>
      </section>

      <section className="workspace-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Import deck</h2>
              <p>
                Standard YDK sections are supported: <code>#main</code>,{' '}
                <code>#extra</code>, and <code>!side</code>.
              </p>
              <p>
                Import limits: {MAX_DECK_CARD_LINES} card lines,{' '}
                {MAX_UNIQUE_CARD_IDS} unique passwords, and{' '}
                {formatByteLimit(MAX_UPLOAD_BYTES)} per upload.
              </p>
            </div>
            <label className="button button-primary" htmlFor={inputId}>
              Choose .ydk file
            </label>
            <input
              id={inputId}
              className="sr-only"
              type="file"
              accept=".ydk,text/plain"
              disabled={isLoading}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) {
                  return
                }

                void handleFileSelection(file)
                event.target.value = ''
              }}
            />
          </div>

          <form
            className="editor-stack"
            onSubmit={(event) => {
              event.preventDefault()
              void importDeck(draftText, sourceName)
            }}
          >
            <label className="field-block" htmlFor={`${inputId}-editor`}>
              <span>YDK text</span>
              <textarea
                id={`${inputId}-editor`}
                className="deck-textarea"
                placeholder={`#created by Your Name\n#main\n89631139\n#extra\n!side`}
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
              />
            </label>

            <div className="button-row">
              <button className="button button-primary" type="submit">
                {isLoading ? 'Loading cards...' : 'Render deck'}
              </button>
              <button
                className="button"
                type="button"
                onClick={loadSampleDeck}
                disabled={isLoading}
              >
                Load sample
              </button>
              <button
                className="button"
                type="button"
                onClick={clearWorkspace}
                disabled={isLoading}
              >
                Clear
              </button>
            </div>
          </form>
        </section>

        <aside className="panel panel-muted">
          <div className="panel-header">
            <div>
              <h2>Deck status</h2>
              <p>
                Imported decks are grouped by section and deduplicated by card
                password.
              </p>
            </div>
          </div>

          <div aria-live="polite" className="status-block">
            {errorMessage ? (
              <p className="status-message status-message-error">
                {errorMessage}
              </p>
            ) : isLoading ? (
              <p className="status-message">
                Looking up card data...
              </p>
            ) : deckView ? (
              <p className="status-message">
                Showing {getTotalCards(deckView)} cards from{' '}
                {deckView.sourceName ?? 'the pasted deck'}.
              </p>
            ) : (
              <p className="status-message">
                Nothing loaded yet. Choose a YDK file or paste deck text to
                render it.
              </p>
            )}
          </div>

          <div className="summary-grid">
            {SECTION_ORDER.map((section) => {
              const totalCards =
                deckView?.sections.find((entry) => entry.key === section)
                  ?.totalCards ?? 0

              return (
                <article className="summary-card" key={section}>
                  <span>{SECTION_LABELS[section]}</span>
                  <strong>{totalCards}</strong>
                </article>
              )
            })}
            <article className="summary-card">
              <span>Unique cards</span>
              <strong>{deckView?.uniqueCards ?? 0}</strong>
            </article>
          </div>

          <dl className="meta-list">
            <div>
              <dt>Source</dt>
              <dd>{deckView?.sourceName ?? sourceName ?? 'Not loaded'}</dd>
            </div>
            <div>
              <dt>Created by</dt>
              <dd>{deckView?.createdBy ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt>Imported</dt>
              <dd>{deckView?.importedAt ?? 'Waiting for deck'}</dd>
            </div>
            <div>
              <dt>Missing cards</dt>
              <dd>{deckView?.missingCards ?? 0}</dd>
            </div>
          </dl>

          {deckView?.warnings.length ? (
            <div className="warning-block">
              <h3>Warnings</h3>
              <ul>
                {deckView.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </section>

      <section className="deck-sections">
        {deckView ? (
          deckView.sections.map((section) => (
            <section className="panel section-panel" key={section.key}>
              <div className="section-header">
                <div>
                  <h2>{section.label}</h2>
                  <p>
                    {section.totalCards} cards · {section.entries.length} unique
                  </p>
                </div>
              </div>

              {section.entries.length ? (
                <div className="card-grid">
                  {section.entries.map((entry) => (
                    <article
                      className={`deck-card ${
                        entry.status === 'missing' ? 'is-missing' : ''
                      }`}
                      key={`${section.key}-${entry.id}`}
                    >
                      <div className="deck-card-media">
                        {entry.imageUrl ? (
                          <img
                            src={entry.imageUrl}
                            alt={entry.name}
                            loading="lazy"
                            width={240}
                            height={350}
                          />
                        ) : (
                          <div className="deck-card-fallback">{entry.id}</div>
                        )}
                      </div>

                      <div className="deck-card-body">
                        <div className="deck-card-head">
                          <h3>{entry.name}</h3>
                          <strong>{entry.copies}x</strong>
                        </div>
                        <p className="deck-card-id">{entry.id}</p>
                        {entry.details.map((detail) => (
                          <p
                            className="deck-card-detail"
                            key={`${entry.id}-${detail}`}
                          >
                            {detail}
                          </p>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No cards in this section.</p>
              )}
            </section>
          ))
        ) : (
          <section className="panel section-panel">
            <div className="section-header">
              <div>
                <h2>Deck preview</h2>
                <p>
                  Your uploaded deck will appear here once it has been parsed.
                </p>
              </div>
            </div>
            <p className="empty-state">
              Use a normal YDK file exported by your simulator. The viewer keeps
              your section order intact and pulls card art by password.
            </p>
          </section>
        )}
      </section>
    </main>
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

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}
