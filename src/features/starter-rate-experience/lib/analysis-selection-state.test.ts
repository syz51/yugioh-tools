import { describe, expect, it } from 'vitest'
import {
  fromRuntimeSelection,
  generateWorkingCfg,
  isValidCfg,
  parseAnalysisSelectionLocalCache,
  sanitizeSelectionState,
  selectionStatesEqual,
  serializeAnalysisSelectionLocalCache,
  toRuntimeSelection,
} from './analysis-selection-state'

describe('analysis-selection-state', () => {
  const mainDeckEntryIds = new Set(['14558127', '23434538', '24224830'])

  it('round-trips local cache serialization', () => {
    const cache = {
      version: 1 as const,
      workingCfg: 'ABCDEFGHIJKLMNOPQRSTUV',
      state: {
        version: 1 as const,
        oneCardStarterIds: ['14558127'],
        twoCardStarterRows: [
          {
            mainCardId: '23434538',
            supplementCardIds: ['24224830'],
          },
        ],
      },
    }

    expect(
      parseAnalysisSelectionLocalCache(
        serializeAnalysisSelectionLocalCache(cache),
      ),
    ).toEqual(cache)
  })

  it('generates compact valid working cfg identifiers', () => {
    const workingCfg = generateWorkingCfg()

    expect(isValidCfg(workingCfg)).toBe(true)
    expect(workingCfg).toHaveLength(22)
  })

  it('compares selection state equality without URL encoding', () => {
    const state = {
      version: 1 as const,
      oneCardStarterIds: ['14558127'],
      twoCardStarterRows: [
        {
          mainCardId: '23434538',
          supplementCardIds: ['24224830'],
        },
      ],
    }

    expect(selectionStatesEqual(state, state)).toBe(true)
    expect(
      selectionStatesEqual(state, {
        ...state,
        oneCardStarterIds: ['23434538'],
      }),
    ).toBe(false)
  })

  it('dedupes duplicate one-card starter ids during sanitization', () => {
    expect(
      sanitizeSelectionState(
        {
          version: 1,
          oneCardStarterIds: ['14558127', '14558127', '23434538'],
          twoCardStarterRows: [],
        },
        mainDeckEntryIds,
      ),
    ).toEqual({
      version: 1,
      oneCardStarterIds: ['14558127', '23434538'],
      twoCardStarterRows: [],
    })
  })

  it('removes invalid ids during sanitization', () => {
    expect(
      sanitizeSelectionState(
        {
          version: 1,
          oneCardStarterIds: ['14558127', '99999999'],
          twoCardStarterRows: [
            {
              mainCardId: '23434538',
              supplementCardIds: ['24224830', '99999999'],
            },
          ],
        },
        mainDeckEntryIds,
      ),
    ).toEqual({
      version: 1,
      oneCardStarterIds: ['14558127'],
      twoCardStarterRows: [
        {
          mainCardId: '23434538',
          supplementCardIds: ['24224830'],
        },
      ],
    })
  })

  it('resolves conflicting two-card main cards deterministically', () => {
    expect(
      sanitizeSelectionState(
        {
          version: 1,
          oneCardStarterIds: [],
          twoCardStarterRows: [
            {
              mainCardId: '23434538',
              supplementCardIds: ['24224830'],
            },
            {
              mainCardId: '23434538',
              supplementCardIds: ['14558127'],
            },
          ],
        },
        mainDeckEntryIds,
      ),
    ).toEqual({
      version: 1,
      oneCardStarterIds: [],
      twoCardStarterRows: [
        {
          mainCardId: '23434538',
          supplementCardIds: ['24224830'],
        },
      ],
    })
  })

  it('removes supplements that equal the main card or duplicate selected one-card ids', () => {
    expect(
      sanitizeSelectionState(
        {
          version: 1,
          oneCardStarterIds: ['14558127'],
          twoCardStarterRows: [
            {
              mainCardId: '23434538',
              supplementCardIds: ['23434538', '14558127', '24224830'],
            },
          ],
        },
        mainDeckEntryIds,
      ),
    ).toEqual({
      version: 1,
      oneCardStarterIds: ['14558127'],
      twoCardStarterRows: [
        {
          mainCardId: '23434538',
          supplementCardIds: ['24224830'],
        },
      ],
    })
  })

  it('omits empty rows from persisted state sanitization', () => {
    expect(
      sanitizeSelectionState(
        {
          version: 1,
          oneCardStarterIds: [],
          twoCardStarterRows: [
            {
              mainCardId: null,
              supplementCardIds: [],
            },
            {
              mainCardId: '14558127',
              supplementCardIds: [],
            },
          ],
        },
        mainDeckEntryIds,
      ),
    ).toEqual({
      version: 1,
      oneCardStarterIds: [],
      twoCardStarterRows: [
        {
          mainCardId: '14558127',
          supplementCardIds: [],
        },
      ],
    })
  })

  it('converts between runtime and persisted selection shapes', () => {
    const runtimeSelection = {
      selectedOneCardStarterIds: ['14558127'],
      twoCardStarterRows: [
        {
          id: 'row-9',
          mainCardId: '23434538',
          supplementCardIds: ['24224830'],
        },
      ],
    }

    const selectionState = fromRuntimeSelection(runtimeSelection)

    expect(selectionState).toEqual({
      version: 1,
      oneCardStarterIds: ['14558127'],
      twoCardStarterRows: [
        {
          mainCardId: '23434538',
          supplementCardIds: ['24224830'],
        },
      ],
    })

    expect(toRuntimeSelection(selectionState)).toEqual({
      selectedOneCardStarterIds: ['14558127'],
      twoCardStarterRows: [
        {
          id: 'two-card-row-1',
          mainCardId: '23434538',
          supplementCardIds: ['24224830'],
        },
      ],
    })
  })
})
