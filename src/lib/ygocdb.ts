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

const CARD_IMAGE_BASE = 'https://cdn.233.momobako.com/ygopro/pics'
export const DEFAULT_CARD_FETCH_CONCURRENCY = 8
type FetchDeckCardsOptions = {
  concurrency?: number
  signal?: AbortSignal
}
const MISSING_CARD_MESSAGE = 'Card data could not be loaded.'

type DeckCardLookupRecord = Partial<Record<string, DeckCardLookup>>

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
  if (uniqueIds.length === 0) {
    return new Map<string, DeckCardLookup>()
  }

  const { getDeckCards } = await import('./ygocdb-cache')
  const lookups = (await getDeckCards({
    data: {
      cardIds: uniqueIds,
      concurrency: options.concurrency ?? DEFAULT_CARD_FETCH_CONCURRENCY,
    },
    signal: options.signal,
  })) as DeckCardLookupRecord

  return new Map(
    uniqueIds.map((cardId) => [
      cardId,
      lookups[cardId] ?? {
        id: cardId,
        status: 'missing' as const,
        message: MISSING_CARD_MESSAGE,
      },
    ]),
  )
}
