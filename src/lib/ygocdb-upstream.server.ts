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
      message: `YGOCDB 返回了 ${response.status}，暂时无法获取卡号 ${cardId} 的资料。`,
    }
  }

  const payload = (await response.json()) as Partial<YgocdbCard>

  if (payload.id == null || payload.text == null || payload.data == null) {
    return {
      id: cardId,
      status: 'missing',
      message: `YGOCDB 返回的卡号 ${cardId} 资料不完整。`,
    }
  }

  return {
    id: cardId,
    status: 'ready',
    card: payload as YgocdbCard,
  }
}
