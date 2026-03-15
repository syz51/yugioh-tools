import type {
  AnalysisSelectionLocalCache,
  AnalysisSelectionState,
  TwoCardStarterRow,
} from '../types'

type RuntimeSelectionInput = {
  selectedOneCardStarterIds: string[]
  twoCardStarterRows: Pick<TwoCardStarterRow, 'mainCardId' | 'supplementCardIds'>[]
}

const ANALYSIS_SELECTION_VERSION = 1 as const
const CFG_PATTERN = /^[A-Za-z0-9_-]{1,32}$/u

export const EMPTY_ANALYSIS_SELECTION_STATE: AnalysisSelectionState = {
  version: ANALYSIS_SELECTION_VERSION,
  oneCardStarterIds: [],
  twoCardStarterRows: [],
}

export function isValidCfg(value: string) {
  return CFG_PATTERN.test(value)
}

export function generateWorkingCfg() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))

  return toBase64Url(bytes)
}

export function parseAnalysisSelectionState(
  value: unknown,
): AnalysisSelectionState | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      !('version' in value) ||
      !('oneCardStarterIds' in value) ||
      !('twoCardStarterRows' in value) ||
      value.version !== ANALYSIS_SELECTION_VERSION ||
      !Array.isArray(value.oneCardStarterIds) ||
      !value.oneCardStarterIds.every(
        (entryId) => typeof entryId === 'string',
      ) ||
      !Array.isArray(value.twoCardStarterRows)
    ) {
      return null
    }

    const twoCardStarterRows = value.twoCardStarterRows.map((row) => {
      if (
        row === null ||
        typeof row !== 'object' ||
        !('mainCardId' in row) ||
        !('supplementCardIds' in row) ||
        (row.mainCardId !== null && typeof row.mainCardId !== 'string') ||
        !Array.isArray(row.supplementCardIds) ||
        !row.supplementCardIds.every(
          (entryId: unknown) => typeof entryId === 'string',
        )
      ) {
        throw new Error('Invalid selection row')
      }

      return {
        mainCardId: row.mainCardId,
        supplementCardIds: [...row.supplementCardIds],
      }
    })

    return {
      version: ANALYSIS_SELECTION_VERSION,
      oneCardStarterIds: [...value.oneCardStarterIds],
      twoCardStarterRows,
    }
  } catch {
    return null
  }
}

export function parseAnalysisSelectionLocalCache(
  raw: string,
): AnalysisSelectionLocalCache | null {
  try {
    const parsed = JSON.parse(raw) as unknown

    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      !('version' in parsed) ||
      !('workingCfg' in parsed) ||
      !('state' in parsed) ||
      parsed.version !== ANALYSIS_SELECTION_VERSION ||
      typeof parsed.workingCfg !== 'string' ||
      !isValidCfg(parsed.workingCfg)
    ) {
      return null
    }

    const state = parseAnalysisSelectionState(parsed.state)

    if (!state) {
      return null
    }

    return {
      version: ANALYSIS_SELECTION_VERSION,
      workingCfg: parsed.workingCfg,
      state,
    }
  } catch {
    return null
  }
}

export function serializeAnalysisSelectionLocalCache(
  cache: AnalysisSelectionLocalCache,
) {
  return JSON.stringify({
    version: ANALYSIS_SELECTION_VERSION,
    workingCfg: cache.workingCfg,
    state: cloneSelectionState(cache.state),
  })
}

export function sanitizeSelectionState(
  state: AnalysisSelectionState,
  mainDeckEntryIds: Iterable<string>,
): AnalysisSelectionState {
  const validMainDeckEntryIds = new Set(mainDeckEntryIds)
  const seenOneCardStarterIds = new Set<string>()
  const oneCardStarterIds = state.oneCardStarterIds.filter((id) => {
    if (!validMainDeckEntryIds.has(id) || seenOneCardStarterIds.has(id)) {
      return false
    }

    seenOneCardStarterIds.add(id)
    return true
  })

  const oneCardStarterIdSet = new Set(oneCardStarterIds)
  const usedTwoCardMainIds = new Set<string>()
  const twoCardStarterRows = state.twoCardStarterRows.flatMap((row) => {
    if (
      row.mainCardId === null ||
      !validMainDeckEntryIds.has(row.mainCardId) ||
      oneCardStarterIdSet.has(row.mainCardId) ||
      usedTwoCardMainIds.has(row.mainCardId)
    ) {
      return []
    }

    usedTwoCardMainIds.add(row.mainCardId)

    const seenSupplementIds = new Set<string>()
    const supplementCardIds = row.supplementCardIds.filter((id) => {
      if (
        id === row.mainCardId ||
        !validMainDeckEntryIds.has(id) ||
        oneCardStarterIdSet.has(id) ||
        seenSupplementIds.has(id)
      ) {
        return false
      }

      seenSupplementIds.add(id)
      return true
    })

    return [
      {
        mainCardId: row.mainCardId,
        supplementCardIds,
      },
    ]
  })

  return {
    version: ANALYSIS_SELECTION_VERSION,
    oneCardStarterIds,
    twoCardStarterRows,
  }
}

export function fromRuntimeSelection(
  input: RuntimeSelectionInput,
): AnalysisSelectionState {
  return {
    version: ANALYSIS_SELECTION_VERSION,
    oneCardStarterIds: input.selectedOneCardStarterIds,
    twoCardStarterRows: input.twoCardStarterRows.map((row) => ({
      mainCardId: row.mainCardId,
      supplementCardIds: [...row.supplementCardIds],
    })),
  }
}

export function toRuntimeSelection(state: AnalysisSelectionState): {
  selectedOneCardStarterIds: string[]
  twoCardStarterRows: TwoCardStarterRow[]
} {
  return {
    selectedOneCardStarterIds: [...state.oneCardStarterIds],
    twoCardStarterRows: state.twoCardStarterRows.map((row, index) => ({
      id: `two-card-row-${index + 1}`,
      mainCardId: row.mainCardId,
      supplementCardIds: [...row.supplementCardIds],
    })),
  }
}

export function selectionStatesEqual(
  left: AnalysisSelectionState,
  right: AnalysisSelectionState,
) {
  return JSON.stringify(cloneSelectionState(left)) === JSON.stringify(cloneSelectionState(right))
}

function cloneSelectionState(state: AnalysisSelectionState): AnalysisSelectionState {
  return {
    version: ANALYSIS_SELECTION_VERSION,
    oneCardStarterIds: [...state.oneCardStarterIds],
    twoCardStarterRows: state.twoCardStarterRows.map((row) => ({
      mainCardId: row.mainCardId,
      supplementCardIds: [...row.supplementCardIds],
    })),
  }
}

function toBase64Url(bytes: Uint8Array) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url')
  }

  let binaryValue = ''

  for (const byte of bytes) {
    binaryValue += String.fromCharCode(byte)
  }

  return globalThis.btoa(binaryValue)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}
