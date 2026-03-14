export type DeckSection = 'main' | 'extra' | 'side'

export type ParsedYdkDeck = {
  createdBy: string | null
  sections: Record<DeckSection, string[]>
  warnings: string[]
}

export const MAIN_DECK_MIN_CARDS = 40
export const MAIN_DECK_MAX_CARDS = 60
export const EXTRA_DECK_MAX_CARDS = 15
export const SIDE_DECK_MAX_CARDS = 15

const SECTION_BY_MARKER: Partial<Record<string, DeckSection>> = {
  '#main': 'main',
  '#extra': 'extra',
  '!side': 'side',
}

export function parseYdk(text: string): ParsedYdkDeck {
  const sections: ParsedYdkDeck['sections'] = {
    main: [],
    extra: [],
    side: [],
  }
  const warnings: string[] = []

  let createdBy: string | null = null
  let currentSection: DeckSection | null = null

  for (const [index, rawLine] of text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .entries()) {
    const line = rawLine.trim()

    if (!line) {
      continue
    }

    if (line.startsWith('#created by ')) {
      createdBy = line.slice('#created by '.length).trim() || null
      continue
    }

    const nextSection = SECTION_BY_MARKER[line]
    if (nextSection !== undefined) {
      currentSection = nextSection
      continue
    }

    if (line.startsWith('#') || line.startsWith('!')) {
      continue
    }

    if (!/^\d+$/.test(line)) {
      warnings.push(
        `Line ${index + 1} is not a valid card password: "${line}".`,
      )
      continue
    }

    if (!currentSection) {
      warnings.push(
        `Line ${index + 1} appears before any deck section and was ignored.`,
      )
      continue
    }

    sections[currentSection].push(line)
  }

  return {
    createdBy,
    sections,
    warnings,
  }
}

export function collapseDeckSection(cardIds: string[]) {
  const counts = new Map<string, number>()

  for (const cardId of cardIds) {
    counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
  }

  return [...counts.entries()].map(([id, copies]) => ({
    id,
    copies,
  }))
}

export function getDeckCardIds(deck: ParsedYdkDeck) {
  return [...deck.sections.main, ...deck.sections.extra, ...deck.sections.side]
}

export function getDeckCardCount(deck: ParsedYdkDeck) {
  return getDeckCardIds(deck).length
}

export function getUniqueDeckCardCount(deck: ParsedYdkDeck) {
  return new Set(getDeckCardIds(deck)).size
}

export function getDeckConstructionError(deck: ParsedYdkDeck) {
  const mainCount = deck.sections.main.length
  if (mainCount < MAIN_DECK_MIN_CARDS || mainCount > MAIN_DECK_MAX_CARDS) {
    return `主卡组当前为 ${mainCount} 张。YGO 卡组的主卡组需要 ${MAIN_DECK_MIN_CARDS} - ${MAIN_DECK_MAX_CARDS} 张。`
  }

  const extraCount = deck.sections.extra.length
  if (extraCount > EXTRA_DECK_MAX_CARDS) {
    return `额外卡组当前为 ${extraCount} 张。YGO 卡组的额外卡组最多 ${EXTRA_DECK_MAX_CARDS} 张。`
  }

  const sideCount = deck.sections.side.length
  if (sideCount > SIDE_DECK_MAX_CARDS) {
    return `副卡组当前为 ${sideCount} 张。YGO 卡组的副卡组最多 ${SIDE_DECK_MAX_CARDS} 张。`
  }

  return null
}
