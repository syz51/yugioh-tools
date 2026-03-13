import '@tanstack/react-start/server-only'
import type { DeckCardLookup, YgocdbCard } from './ygocdb'

const CARD_API_BASE = 'https://ygocdb.com/api/v0/card'

export async function loadDeckCardFromYgocdb(
  cardId: string,
): Promise<DeckCardLookup> {
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
