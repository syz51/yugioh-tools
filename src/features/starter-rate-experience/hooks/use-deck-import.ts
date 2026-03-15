import { startTransition, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { getDeckCardCount, parseYdk } from '../../../lib/ydk'
import { createDeckAnalysis } from '../lib/deck-analysis.functions'
import { deckAnalysisQueryOptions } from '../lib/deck-analysis.query'
import {
  MAX_UPLOAD_BYTES,
  SAMPLE_DECK_NAME,
  SAMPLE_YDK,
} from '../lib/constants'
import { formatByteLimit, getDeckImportLimitError } from '../lib/utils'

export function useDeckImport() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const latestRequestRef = useRef(0)
  const [draftText, setDraftText] = useState('')
  const [sourceName, setSourceName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const createDeckAnalysisMutation = useMutation({
    mutationFn: ({
      deckText,
      nextSourceName,
    }: {
      deckText: string
      nextSourceName: string | null
    }) =>
      createDeckAnalysis({
        data: {
          deckText,
          sourceName: nextSourceName,
        },
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(
        deckAnalysisQueryOptions(result.analysisId).queryKey,
        result.analysis,
      )
    },
  })

  async function importDeck(deckText: string, nextSourceName: string | null) {
    const parsed = parseYdk(deckText)
    const totalCards = getDeckCardCount(parsed)
    const limitError = getDeckImportLimitError(parsed, deckText)

    if (totalCards === 0) {
      setErrorMessage(
        '卡组内容为空。请上传 .ydk 文件，或粘贴包含 main、extra、side 段落的有效 YDK 文本。',
      )
      return
    }

    if (limitError) {
      setErrorMessage(limitError)
      return
    }

    const requestId = latestRequestRef.current + 1
    latestRequestRef.current = requestId
    setErrorMessage(null)

    try {
      const result = await createDeckAnalysisMutation.mutateAsync({
        deckText,
        nextSourceName,
      })

      if (latestRequestRef.current !== requestId) {
        return
      }

      startTransition(() => {
        void navigate({
          to: '/analysis/$analysisId',
          params: { analysisId: result.analysisId },
          search: {
            cfg: undefined,
          },
        })
      })
    } catch (error) {
      if (latestRequestRef.current !== requestId) {
        return
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : '暂时无法完成卡组分析，请稍后再试。',
      )
    }
  }

  async function handleFileSelection(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
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
    createDeckAnalysisMutation.reset()
    setDraftText('')
    setSourceName(null)
    setErrorMessage(null)
  }

  return {
    clearWorkspace,
    draftText,
    errorMessage,
    handleFileSelection,
    importDeck,
    isLoading: createDeckAnalysisMutation.isPending,
    loadSampleDeck,
    setDraftText,
    sourceName,
  }
}
