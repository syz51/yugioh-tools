import { describe, expect, it } from 'vitest'
import type { YgocdbCard } from './ygocdb'
import { getLocalizedCardDetails, getPreferredCardName } from './ygocdb'

describe('getPreferredCardName', () => {
  it('prefers simplified Chinese names for Chinese users', () => {
    expect(
      getPreferredCardName(
        {
          en_name: 'Blue-Eyes White Dragon',
          cn_name: '青眼白龙',
          sc_name: '青眼白龙',
        },
        '89631139',
      ),
    ).toBe('青眼白龙')
  })

  it('falls back to a localized unknown label', () => {
    expect(getPreferredCardName(undefined, '12345678')).toBe(
      '未识别卡片 12345678',
    )
  })
})

describe('getLocalizedCardDetails', () => {
  it('translates card type lines and stat labels into Chinese', () => {
    expect(
      getLocalizedCardDetails({
        text: {
          types: 'Monster\nDragon / Effect',
        },
        data: {
          atk: 3000,
          def: 2500,
        },
      } as Partial<YgocdbCard>),
    ).toEqual(['怪兽', '龙族／效果'])
  })

  it('returns translated stats when no type line is available', () => {
    expect(
      getLocalizedCardDetails({
        text: {},
        data: {
          atk: 1200,
          def: 800,
        },
      } as Partial<YgocdbCard>),
    ).toEqual(['攻击 1200 / 守备 800'])
  })
})
