import { describe, expect, it } from 'vitest'
import { buildReport, byAge, byCategory, byRisk, reclaimable, topItems } from './insights'
import type { Finding } from '../types'

const NOW = 1_800_000_000
const D = 86_400
const mk = (id: string, bytes: number, over: Partial<Finding> = {}): Finding => ({
  id, module: 'caches', rule: 'r', category: 'caches', title: id, path: `/Users/me/${id}`, bytes, risk: 'safe',
  regenerable: true, note: null, related: null, confidence: 1, modified: NOW - 5 * D, ...over,
})

describe('insights', () => {
  const fs = [
    mk('a', 900, { category: 'dev' }),
    mk('b', 100, { category: 'dev', risk: 'caution', regenerable: false, modified: NOW - 100 * D }),
    mk('c', 500, { risk: 'manual', regenerable: false, modified: NOW - 400 * D }),
    mk('d', 50, { modified: null }),
  ]

  it('sums per category, biggest first', () => {
    expect(byCategory(fs).map((c) => [c.key, c.bytes, c.count])).toEqual([['dev', 1000, 2], ['caches', 550, 2]])
  })

  it('splits by risk', () => {
    const r = byRisk(fs)
    expect(r.safe).toEqual({ bytes: 950, count: 2 })
    expect(r.caution.count).toBe(1)
    expect(r.manual.bytes).toBe(500)
  })

  it('buckets by age and ignores undated items', () => {
    const b = Object.fromEntries(byAge(fs, NOW).map((x) => [x.key, x.count]))
    expect(b).toEqual({ month: 1, quarter: 0, half: 1, year: 0, old: 1 })
  })

  it('never counts manual findings as removable', () => {
    const r = reclaimable(fs)
    expect(r.safe).toBe(950)
    expect(r.withReview).toBe(1050)
    expect(r.share).toBeCloseTo(950 / 1050)
  })

  it('handles an empty scan', () => {
    expect(reclaimable([]).share).toBe(0)
    expect(byCategory([])).toEqual([])
    expect(topItems([], 3)).toEqual([])
  })

  it('lists the biggest items first without mutating the input', () => {
    const copy = [...fs]
    expect(topItems(fs, 2).map((f) => f.id)).toEqual(['a', 'c'])
    expect(fs).toEqual(copy)
  })

  it('writes a report that names sizes but never contents', () => {
    const text = buildReport(fs, '/Users/me', new Date('2026-10-21T08:00:00Z'))
    expect(text).toContain('Findings: 4')
    expect(text).toContain('~/a')
    expect(text.split('\n')[0]).toBe('Whittle scan report · 2026-10-21 08:00 UTC')
  })
})
