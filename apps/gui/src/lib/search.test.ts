import { describe, expect, it } from 'vitest'
import { rank, score } from './search'

describe('score', () => {
  it('matches everything for an empty query', () => {
    expect(score('', 'anything')).toBe(0)
    expect(score('   ', 'anything')).toBe(0)
  })
  it('is case-insensitive and needs every word', () => {
    expect(score('XCODE derived', 'Xcode DerivedData')).not.toBeNull()
    expect(score('xcode npm', 'Xcode DerivedData')).toBeNull()
  })
  it('prefers prefixes over word starts over inner matches', () => {
    const p = score('der', 'derived')!
    const w = score('der', 'xcode derived')!
    const i = score('der', 'xcoder')!
    expect(p).toBeGreaterThan(w)
    expect(w).toBeGreaterThan(i)
  })
  it('accepts letters in order only for longer words', () => {
    expect(score('xdd', 'Xcode DerivedData')).not.toBeNull()
    expect(score('xd', 'Xcode DerivedData')).toBeNull() // two letters in order are too loose
  })
})

describe('rank', () => {
  const items = ['Scan again later', 'Scan', 'Settings', 'Show shortcuts']
  it('puts the shorter exact match first and drops non-matches', () => {
    expect(rank('scan', items, (s) => s)).toEqual(['Scan', 'Scan again later'])
  })
  it('keeps the original order for ties and respects the limit', () => {
    expect(rank('', items, (s) => s, 2)).toEqual(['Scan again later', 'Scan'])
  })
})
