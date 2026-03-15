// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StarterCountPanel } from './analysis-panels'
import type { DeckAnalysisModel, DeckCardView, DeckView } from '../types'

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
    uniqueCards: 2,
    warnings: [],
  }
}

function createModel(
  overrides: Partial<DeckAnalysisModel> = {},
): DeckAnalysisModel {
  const mainDeckEntries = [
    createDeckCardView({
      id: '14558127',
      name: 'Ash Blossom & Joyous Spring',
      searchAliases: ['Ash Blossom & Joyous Spring', '灰流丽', '14558127'],
    }),
    createDeckCardView({
      id: '23434538',
      name: 'Maxx "C"',
      searchAliases: ['Maxx "C"', '增殖的G', '23434538'],
    }),
  ]

  return {
    combinedStarterResult: null,
    clearTwoCardStarterSelections: vi.fn(),
    deckView: createDeckView(),
    mainDeckEntries,
    mainDeckSize: 40,
    maxTwoCardSupplementCopies: 34,
    selectedOneCardStarterEntries: [],
    selectedOneCardStarterIds: [],
    selectedTwoCardStarterEntries: [],
    selectedTwoCardStarterIds: [],
    sourceName: 'Test Deck',
    starterCopies: 0,
    toggleOneCardStarterSelection: vi.fn(),
    toggleTwoCardStarterSelection: vi.fn(),
    twoCardSupplementCopies: 0,
    updateTwoCardSupplementCopies: vi.fn(),
    ...overrides,
  }
}

describe('StarterCountPanel', () => {
  it('filters and toggles two-card main starters from the visual picker', () => {
    const model = createModel()

    render(<StarterCountPanel model={model} />)

    fireEvent.click(screen.getByRole('tab', { name: '二卡动' }))

    const searchInput = screen.getByLabelText('按卡名或卡号筛选主启动')
    fireEvent.change(searchInput, { target: { value: '灰流丽' } })

    expect(screen.getByText('Ash Blossom & Joyous Spring')).toBeTruthy()
    expect(screen.queryByText('Maxx "C"')).toBeNull()

    fireEvent.click(
      screen.getByRole('button', { name: /Ash Blossom & Joyous Spring/i }),
    )

    expect(model.toggleTwoCardStarterSelection).toHaveBeenCalledWith('14558127')
    const supplementInput = screen.getByLabelText('补点总张数')
    expect(supplementInput).toHaveProperty('disabled', true)
  })

  it('allows clearing the selected two-card main starter pool', () => {
    const selectedTwoCardStarter = createDeckCardView({
      id: '14558127',
      name: 'Ash Blossom & Joyous Spring',
      searchAliases: ['Ash Blossom & Joyous Spring', '灰流丽', '14558127'],
    })
    const model = createModel({
      selectedTwoCardStarterEntries: [selectedTwoCardStarter],
      selectedTwoCardStarterIds: ['14558127'],
    })

    render(<StarterCountPanel model={model} />)

    fireEvent.click(screen.getByRole('tab', { name: '二卡动' }))
    fireEvent.click(screen.getByRole('button', { name: '清空已选主启动' }))

    expect(model.clearTwoCardStarterSelections).toHaveBeenCalled()
  })

  it('excludes selected one-card starters from the two-card picker', () => {
    const model = createModel({
      selectedOneCardStarterEntries: [
        createDeckCardView({
          id: '14558127',
          name: 'Ash Blossom & Joyous Spring',
          searchAliases: ['Ash Blossom & Joyous Spring', '灰流丽', '14558127'],
        }),
      ],
      selectedOneCardStarterIds: ['14558127'],
    })

    render(<StarterCountPanel model={model} />)

    fireEvent.click(screen.getByRole('tab', { name: '二卡动' }))

    expect(screen.queryByText('Ash Blossom & Joyous Spring')).toBeNull()
    expect(screen.getByText('Maxx "C"')).toBeTruthy()
  })
})
