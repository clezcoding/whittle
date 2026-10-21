import { describe, expect, it } from 'vitest'
import { expiryWords, inQuarantine, retention } from './quarantine'
import type { RunSummary } from '../types'

const D = 86_400
const NOW = 1_800_000_000
const run = (ageDays: number, undoable = 3): RunSummary => ({ run: `r${ageDays}`, ts: NOW - ageDays * D, items: 3, bytes: 1000, restored: 0, undoable })

describe('retention', () => {
  it('counts days left, rounding up', () => {
    expect(retention(run(10), 30, NOW).daysLeft).toBe(20)
    expect(retention(run(10), 30, NOW + 1).daysLeft).toBe(20)
    expect(retention(run(29.5), 30, NOW).daysLeft).toBe(1)
  })
  it('clamps at the ends', () => {
    expect(retention(run(45), 30, NOW)).toMatchObject({ daysLeft: 0, elapsed: 1 })
    expect(retention(run(-1), 30, NOW).elapsed).toBe(0)
  })
  it('survives a quarantine period of zero', () => {
    expect(retention(run(1), 0, NOW).elapsed).toBe(1)
  })
})

describe('inQuarantine', () => {
  it('keeps undoable runs only, oldest first', () => {
    const list = inQuarantine([run(3), run(20), run(8, 0)], 30, NOW)
    expect(list.map((r) => r.run.run)).toEqual(['r20', 'r3'])
  })
})

describe('expiryWords', () => {
  it('says what happens next', () => {
    expect(expiryWords(retention(run(10), 30, NOW), true)).toBe('Removed in 20 days')
    expect(expiryWords(retention(run(29.5), 30, NOW), true)).toBe('Removed tomorrow')
    expect(expiryWords(retention(run(40), 30, NOW), true)).toBe('Removed today')
    expect(expiryWords(retention(run(1), 30, NOW), false)).toBe('Kept until you free it')
  })
})
