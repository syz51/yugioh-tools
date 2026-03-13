import { describe, expect, it } from 'vitest'
import { collapseDeckSection, parseYdk } from './ydk'

describe('parseYdk', () => {
  it('parses standard main, extra, and side sections', () => {
    const deck = parseYdk(`#created by Kaiba
#main
89631139
89631139
23995346
#extra
23995346
!side
5851097
`)

    expect(deck.createdBy).toBe('Kaiba')
    expect(deck.sections.main).toEqual(['89631139', '89631139', '23995346'])
    expect(deck.sections.extra).toEqual(['23995346'])
    expect(deck.sections.side).toEqual(['5851097'])
    expect(deck.warnings).toEqual([])
  })

  it('ignores invalid lines and cards outside sections with warnings', () => {
    const deck = parseYdk(`89631139
#main
abc
53129443
`)

    expect(deck.sections.main).toEqual(['53129443'])
    expect(deck.warnings).toEqual([
      'Line 1 appears before any deck section and was ignored.',
      'Line 3 is not a valid card password: "abc".',
    ])
  })
})

describe('collapseDeckSection', () => {
  it('counts copies while keeping first-seen order', () => {
    expect(
      collapseDeckSection(['89631139', '23995346', '89631139', '5851097']),
    ).toEqual([
      { id: '89631139', copies: 2 },
      { id: '23995346', copies: 1 },
      { id: '5851097', copies: 1 },
    ])
  })
})
