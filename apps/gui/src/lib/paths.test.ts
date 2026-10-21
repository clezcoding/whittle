import { describe, expect, it } from 'vitest'
import { errorText, expandPath, isExcluded } from './paths'

const home = '/Users/me'

describe('expandPath', () => {
  it('expands ~ and trims slashes', () => {
    expect(expandPath('~/Dev/x/', home)).toBe('/Users/me/Dev/x')
    expect(expandPath('~', home)).toBe('/Users/me')
    expect(expandPath(' /opt/x ', home)).toBe('/opt/x')
  })
})

describe('isExcluded', () => {
  const ex = ['~/Library/Caches/keep']
  it('matches the path, children, and parents that would take it along', () => {
    expect(isExcluded('/Users/me/Library/Caches/keep', ex, home)).toBe(true)
    expect(isExcluded('/Users/me/Library/Caches/keep/inner', ex, home)).toBe(true)
    expect(isExcluded('/Users/me/Library/Caches', ex, home)).toBe(true)
  })
  it('does not match siblings that merely share a prefix', () => {
    expect(isExcluded('/Users/me/Library/Caches/keeper', ex, home)).toBe(false)
    expect(isExcluded('/Users/me/Library/Caches/other', ex, home)).toBe(false)
  })
  it('is false for an empty list', () => {
    expect(isExcluded('/anything', [], home)).toBe(false)
  })
})

describe('errorText', () => {
  it('handles strings and Errors', () => {
    expect(errorText('plain')).toBe('plain')
    expect(errorText(new Error('boom'))).toBe('boom')
  })
})
