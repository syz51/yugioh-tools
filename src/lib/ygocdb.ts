export type YgocdbCard = {
  cid?: number
  id: number | string
  en_name?: string
  md_name?: string
  sc_name?: string
  cn_name?: string
  jp_name?: string
  text: {
    types?: string
    pdesc?: string
    desc?: string
  }
  data: {
    atk?: number
    def?: number
    level?: number
    race?: number
    attribute?: number
    type?: number
  }
}

export type DeckCardLookup =
  | {
      id: string
      status: 'ready'
      card: YgocdbCard
    }
  | {
      id: string
      status: 'missing'
      message: string
    }

const CARD_API_BASE = 'https://ygocdb.com/api/v0/card'
const CARD_IMAGE_BASE = 'https://cdn.233.momobako.com/ygopro/pics'

const cardCache = new Map<string, Promise<DeckCardLookup>>()

export function getCardImageUrl(cardId: string) {
  return `${CARD_IMAGE_BASE}/${cardId}.jpg`
}

export function getPreferredCardName(
  card: Partial<YgocdbCard> | undefined,
  cardId: string,
) {
  if (!card) {
    return `Unknown card ${cardId}`
  }

  return (
    card.en_name ||
    card.md_name ||
    card.sc_name ||
    card.cn_name ||
    card.jp_name ||
    `Unknown card ${cardId}`
  )
}

export async function fetchDeckCards(cardIds: string[]) {
  const uniqueIds = [...new Set(cardIds)]
  const lookups = await Promise.all(
    uniqueIds.map(
      async (cardId) => [cardId, await fetchDeckCard(cardId)] as const,
    ),
  )

  return new Map(lookups)
}

async function fetchDeckCard(cardId: string): Promise<DeckCardLookup> {
  const cached = cardCache.get(cardId)
  if (cached) {
    return cached
  }

  const request = loadDeckCard(cardId)
  cardCache.set(cardId, request)

  try {
    return await request
  } catch (error) {
    cardCache.delete(cardId)
    throw error
  }
}

async function loadDeckCard(cardId: string): Promise<DeckCardLookup> {
  const response = await fetch(`${CARD_API_BASE}/${cardId}?show=all`)

  if (!response.ok) {
    return {
      id: cardId,
      status: 'missing',
      message: `YGOCDB returned ${response.status} for card ${cardId}.`,
    }
  }

  const payload = (await response.json()) as Partial<YgocdbCard>

  if (payload.id == null || payload.text == null || payload.data == null) {
    return {
      id: cardId,
      status: 'missing',
      message: `YGOCDB returned an incomplete record for card ${cardId}.`,
    }
  }

  return {
    id: cardId,
    status: 'ready',
    card: payload as YgocdbCard,
  }
}
