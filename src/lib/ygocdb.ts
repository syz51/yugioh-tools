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
const DEFAULT_FETCH_CONCURRENCY = 8

const cardCache = new Map<string, DeckCardLookup>()

type FetchDeckCardsOptions = {
  concurrency?: number
  signal?: AbortSignal
}

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

export async function fetchDeckCards(
  cardIds: string[],
  options: FetchDeckCardsOptions = {},
) {
  const uniqueIds = [...new Set(cardIds)]
  const lookups = new Map<string, DeckCardLookup>()

  if (uniqueIds.length === 0) {
    return lookups
  }

  const signal = options.signal
  const concurrency = Math.max(
    1,
    Math.min(
      options.concurrency ?? DEFAULT_FETCH_CONCURRENCY,
      uniqueIds.length,
    ),
  )
  let nextIndex = 0

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (nextIndex < uniqueIds.length) {
        signal?.throwIfAborted()

        const currentIndex = nextIndex
        nextIndex += 1
        const cardId = uniqueIds[currentIndex]
        if (!cardId) {
          continue
        }

        lookups.set(cardId, await fetchDeckCard(cardId, signal))
      }
    }),
  )

  return lookups
}

async function fetchDeckCard(
  cardId: string,
  signal?: AbortSignal,
): Promise<DeckCardLookup> {
  const cached = cardCache.get(cardId)
  if (cached) {
    return cached
  }

  const result = await loadDeckCard(cardId, signal)
  cardCache.set(cardId, result)
  return result
}

async function loadDeckCard(
  cardId: string,
  signal?: AbortSignal,
): Promise<DeckCardLookup> {
  const response = await fetch(`${CARD_API_BASE}/${cardId}?show=all`, {
    signal,
  })

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
