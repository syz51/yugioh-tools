// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StarterCountPanel } from './analysis-panels'
import type {
  DeckAnalysisModel,
  DeckCardView,
  DeckView,
  TwoCardStarterRowView,
} from '../types'

afterEach(() => {
  cleanup()
})

function createDeckCardView(
  overrides: Partial<DeckCardView> & Pick<DeckCardView, 'id' | 'name'>,
): DeckCardView {
  return {
    copies: 3,
    details: [],
    imageUrl: `https://example.com/${overrides.id}.jpg`,
    searchAliases: [overrides.name, overrides.id],
    status: 'ready',
    ...overrides,
  }
}

function createDeckView(): DeckView {
  return {
    createdBy: null,
    importedAt: new Date('2026-03-14T00:00:00.000Z').toISOString(),
    missingCards: 0,
    sections: [],
    sourceName: 'Test Deck',
    uniqueCards: 3,
    warnings: [],
  }
}

function createTwoCardStarterRow(
  overrides: Partial<TwoCardStarterRowView> & Pick<TwoCardStarterRowView, 'id'>,
): TwoCardStarterRowView {
  return {
    mainCardId: null,
    mainEntry: null,
    supplementCardIds: [],
    supplementEntries: [],
    ...overrides,
  }
}

function createModel(
  overrides: Partial<DeckAnalysisModel> = {},
): DeckAnalysisModel {
  const ashBlossom = createDeckCardView({
    id: '14558127',
    name: 'Ash Blossom & Joyous Spring',
    searchAliases: ['Ash Blossom & Joyous Spring', '灰流丽', '14558127'],
  })
  const maxxC = createDeckCardView({
    id: '23434538',
    name: 'Maxx "C"',
    searchAliases: ['Maxx "C"', '增殖的G', '23434538'],
  })
  const calledBy = createDeckCardView({
    id: '24224830',
    name: 'Called by the Grave',
    searchAliases: ['Called by the Grave', '墓穴的指名者', '24224830'],
  })
  const mainDeckEntries = [ashBlossom, maxxC, calledBy]

  return {
    addTwoCardStarterRow: vi.fn(),
    clearTwoCardStarterRowSupplements: vi.fn(),
    combinedStarterResult: null,
    deckView: createDeckView(),
    mainDeckEntries,
    mainDeckSize: 40,
    removeTwoCardStarterRow: vi.fn(),
    selectedOneCardStarterEntries: [],
    selectedOneCardStarterIds: [],
    sourceName: 'Test Deck',
    starterCopies: 0,
    toggleOneCardStarterSelection: vi.fn(),
    toggleTwoCardStarterRowSupplement: vi.fn(),
    twoCardStarterRows: [],
    updateTwoCardStarterRowMainCard: vi.fn(),
    ...overrides,
  }
}

describe('StarterCountPanel', () => {
  it('adds a new two-card starter row', () => {
    const model = createModel()

    render(<StarterCountPanel model={model} />)

    fireEvent.click(screen.getByRole('tab', { name: '二卡动' }))
    fireEvent.click(screen.getByRole('button', { name: '新增主启动行' }))

    expect(model.addTwoCardStarterRow).toHaveBeenCalled()
  })

  it('updates the main card for an individual two-card row', () => {
    const model = createModel({
      twoCardStarterRows: [createTwoCardStarterRow({ id: 'row-1' })],
    })

    render(<StarterCountPanel model={model} />)

    fireEvent.click(screen.getByRole('tab', { name: '二卡动' }))
    fireEvent.click(screen.getByRole('button', { name: '选择主启动卡' }))
    fireEvent.click(
      screen.getByRole('button', { name: /Ash Blossom & Joyous Spring/i }),
    )

    expect(model.updateTwoCardStarterRowMainCard).toHaveBeenCalledWith(
      'row-1',
      '14558127',
    )
  })

  it('toggles partner cards for the active two-card row', () => {
    const ashBlossom = createDeckCardView({
      id: '14558127',
      name: 'Ash Blossom & Joyous Spring',
      searchAliases: ['Ash Blossom & Joyous Spring', '灰流丽', '14558127'],
    })
    const model = createModel({
      twoCardStarterRows: [
        createTwoCardStarterRow({
          id: 'row-1',
          mainCardId: '14558127',
          mainEntry: ashBlossom,
        }),
      ],
    })

    render(<StarterCountPanel model={model} />)

    fireEvent.click(screen.getByRole('tab', { name: '二卡动' }))
    fireEvent.click(screen.getByRole('button', { name: '选择搭配卡' }))
    fireEvent.click(screen.getByRole('button', { name: /Maxx "C"/i }))

    expect(model.toggleTwoCardStarterRowSupplement).toHaveBeenCalledWith(
      'row-1',
      '23434538',
    )
  })

  it('keeps a two-card row collapsed after clicking 收起详情', () => {
    const ashBlossom = createDeckCardView({
      id: '14558127',
      name: 'Ash Blossom & Joyous Spring',
      searchAliases: ['Ash Blossom & Joyous Spring', '灰流丽', '14558127'],
    })
    const model = createModel({
      twoCardStarterRows: [
        createTwoCardStarterRow({
          id: 'row-1',
          mainCardId: '14558127',
          mainEntry: ashBlossom,
        }),
      ],
    })

    render(<StarterCountPanel model={model} />)

    fireEvent.click(screen.getByRole('tab', { name: '二卡动' }))
    fireEvent.click(screen.getByRole('button', { name: '收起详情' }))

    expect(
      screen.queryByRole('button', { name: '更换主启动' }),
    ).toBeNull()
    expect(screen.getByRole('button', { name: '展开详情' })).toBeTruthy()
  })

  it('excludes one-card starters from the main-card options for a row', () => {
    const ashBlossom = createDeckCardView({
      id: '14558127',
      name: 'Ash Blossom & Joyous Spring',
      searchAliases: ['Ash Blossom & Joyous Spring', '灰流丽', '14558127'],
    })
    const model = createModel({
      selectedOneCardStarterEntries: [ashBlossom],
      selectedOneCardStarterIds: ['14558127'],
      twoCardStarterRows: [createTwoCardStarterRow({ id: 'row-1' })],
    })

    render(<StarterCountPanel model={model} />)

    fireEvent.click(screen.getByRole('tab', { name: '二卡动' }))
    fireEvent.click(screen.getByRole('button', { name: '选择主启动卡' }))

    expect(
      screen.queryByRole('button', {
        name: /Ash Blossom & Joyous Spring/i,
      }),
    ).toBeNull()
    expect(
      screen.getByRole('button', {
        name: /Maxx "C"/i,
      }),
    ).toBeTruthy()
  })

  it('excludes one-card starters from the partner picker for a row', () => {
    const ashBlossom = createDeckCardView({
      id: '14558127',
      name: 'Ash Blossom & Joyous Spring',
      searchAliases: ['Ash Blossom & Joyous Spring', '灰流丽', '14558127'],
    })
    const maxxC = createDeckCardView({
      id: '23434538',
      name: 'Maxx "C"',
      searchAliases: ['Maxx "C"', '增殖的G', '23434538'],
    })
    const model = createModel({
      selectedOneCardStarterEntries: [ashBlossom],
      selectedOneCardStarterIds: ['14558127'],
      twoCardStarterRows: [
        createTwoCardStarterRow({
          id: 'row-1',
          mainCardId: '23434538',
          mainEntry: maxxC,
        }),
      ],
    })

    render(<StarterCountPanel model={model} />)

    fireEvent.click(screen.getByRole('tab', { name: '二卡动' }))
    fireEvent.click(screen.getByRole('button', { name: '选择搭配卡' }))

    expect(
      screen.queryByRole('button', {
        name: /Ash Blossom & Joyous Spring/i,
      }),
    ).toBeNull()
    expect(
      screen.getByRole('button', {
        name: /Called by the Grave/i,
      }),
    ).toBeTruthy()
  })
})
