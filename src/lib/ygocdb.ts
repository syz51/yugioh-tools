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
export const APP_LOCALE = 'zh-CN'
type FetchDeckCardsOptions = {
  concurrency?: number
  signal?: AbortSignal
}
const MISSING_CARD_MESSAGE = '暂时无法加载卡片资料。'

const CARD_TYPE_TRANSLATIONS: Record<string, string> = {
  Aqua: '水族',
  Beast: '兽族',
  'Beast-Warrior': '兽战士族',
  Continuous: '永续',
  Counter: '反击',
  Cyberse: '电子界族',
  Dinosaur: '恐龙族',
  Divine: '神',
  'Divine-Beast': '幻神兽族',
  Dragon: '龙族',
  Effect: '效果',
  Equip: '装备',
  Fairy: '天使族',
  Field: '场地',
  Fiend: '恶魔族',
  Fish: '鱼族',
  Flip: '反转',
  Fusion: '融合',
  Gemini: '二重',
  Illusion: '幻想魔族',
  Insect: '昆虫族',
  Link: '连接',
  Machine: '机械族',
  Monster: '怪兽',
  Normal: '通常',
  Pendulum: '灵摆',
  Plant: '植物族',
  Psychic: '念动力族',
  Pyro: '炎族',
  Quick: '速攻',
  'Quick-Play': '速攻',
  Reptile: '爬虫类族',
  Ritual: '仪式',
  Rock: '岩石族',
  'Sea Serpent': '海龙族',
  Spell: '魔法',
  'Spell Card': '魔法',
  Spellcaster: '魔法使族',
  Spirit: '灵魂',
  Synchro: '同调',
  Thunder: '雷族',
  Token: '衍生物',
  Toon: '卡通',
  Trap: '陷阱',
  'Trap Card': '陷阱',
  Tuner: '调整',
  Union: '同盟',
  Warrior: '战士族',
  Winged: '鸟翼',
  'Winged Beast': '鸟兽族',
  Wyrm: '幻龙族',
  Xyz: '超量',
  Zombie: '不死族',
}

type DeckCardLookupRecord = Partial<Record<string, DeckCardLookup>>

export function getCardImageUrl(cardId: string) {
  return `${CARD_IMAGE_BASE}/${cardId}.jpg`
}

export function getPreferredCardName(
  card: Partial<YgocdbCard> | undefined,
  cardId: string,
) {
  if (!card) {
    return `未识别卡片 ${cardId}`
  }

  return (
    card.sc_name ||
    card.cn_name ||
    card.md_name ||
    card.jp_name ||
    card.en_name ||
    `未识别卡片 ${cardId}`
  )
}

export function getSearchableCardNames(
  card: Partial<YgocdbCard> | undefined,
  cardId: string,
) {
  if (!card) {
    return [`未识别卡片 ${cardId}`]
  }

  return [
    ...new Set(
      [card.sc_name, card.cn_name, card.md_name, card.jp_name, card.en_name]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ]
}

export function getLocalizedCardDetails(card: Partial<YgocdbCard> | undefined) {
  if (!card) {
    return []
  }

  const typeLines = (card.text?.types ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(translateCardTypeLine)

  const stats: string[] = []
  if (card.data?.atk != null) {
    stats.push(`攻击 ${formatCardStat(card.data.atk)}`)
  }
  if (card.data?.def != null) {
    stats.push(`守备 ${formatCardStat(card.data.def)}`)
  }

  const details = [...typeLines]
  if (stats.length > 0) {
    details.push(stats.join(' / '))
  }

  return details.slice(0, 2)
}

function translateCardTypeLine(value: string) {
  return value
    .split(/\s*\/\s*/g)
    .map((segment) => CARD_TYPE_TRANSLATIONS[segment] ?? segment)
    .join('／')
}

function formatCardStat(value: number) {
  return value < 0 ? '?' : String(value)
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
