import { startTransition, useEffect, useRef, useState } from 'react'
import { calculateOpeningHandProbabilities } from '../../../lib/opening-hand-calculator'
import { getDeckCardCount, getDeckCardIds, parseYdk } from '../../../lib/ydk'
import { fetchDeckCards } from '../../../lib/ygocdb'
import {
  CARD_FETCH_CONCURRENCY,
  MAX_UPLOAD_BYTES,
  SAMPLE_DECK_NAME,
  SAMPLE_YDK,
} from '../lib/constants'
import type { DeckView, WorkbenchStage } from '../types'
import {
  buildDeckView,
  clampStarterCopies,
  formatByteLimit,
  getDeckImportLimitError,
  isAbortError,
} from '../lib/utils'

export function useDeckWorkbench() {
  const latestRequestRef = useRef(0)
  const activeAbortControllerRef = useRef<AbortController | null>(null)
  const [draftText, setDraftText] = useState('')
  const [sourceName, setSourceName] = useState<string | null>(null)
  const [deckView, setDeckView] = useState<DeckView | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [stage, setStage] = useState<WorkbenchStage>('landing')
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
      resetFailedImport(
        '卡组内容为空。请上传 .ydk 文件，或粘贴包含 main、extra、side 段落的有效 YDK 文本。',
      )
      return
    }

    if (limitError) {
      resetFailedImport(limitError)
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
      if (latestRequestRef.current !== requestId || isAbortError(error)) {
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
      resetFailedImport(
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

  function resetFailedImport(message: string) {
    activeAbortControllerRef.current?.abort()
    activeAbortControllerRef.current = null
    setIsLoading(false)
    setDeckView(null)
    setStage('landing')
    setErrorMessage(message)
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

export type WorkbenchModel = ReturnType<typeof useDeckWorkbench>
