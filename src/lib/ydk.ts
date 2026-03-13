export type DeckSection = 'main' | 'extra' | 'side'

export type ParsedYdkDeck = {
  createdBy: string | null
  sections: Record<DeckSection, string[]>
  warnings: string[]
}

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
