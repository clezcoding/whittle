import { describe, expect, it } from 'vitest'
import { squarify } from './treemap'

const items = [60, 30, 20, 10, 5, 5, 1].map((value, i) => ({ value, data: i }))

describe('squarify', () => {
  it('fills the box exactly', () => {
    const tiles = squarify(items, 200, 100)
    const area = tiles.reduce((s, t) => s + t.w * t.h, 0)
    expect(area).toBeCloseTo(200 * 100, 6)
  })

  it('gives every tile an area proportional to its value', () => {
    const total = items.reduce((s, i) => s + i.value, 0)
    for (const t of squarify(items, 200, 100)) {
      expect((t.w * t.h) / (200 * 100)).toBeCloseTo(t.item.value / total, 6)
    }
  })

  it('stays inside the box', () => {
    for (const t of squarify(items, 120, 80)) {
      expect(t.x).toBeGreaterThanOrEqual(-1e-9)
      expect(t.y).toBeGreaterThanOrEqual(-1e-9)
      expect(t.x + t.w).toBeLessThanOrEqual(120 + 1e-9)
      expect(t.y + t.h).toBeLessThanOrEqual(80 + 1e-9)
    }
  })

  it('does not overlap', () => {
    const tiles = squarify(items, 100, 100)
    for (const [i, a] of tiles.entries()) {
      for (const b of tiles.slice(i + 1)) {
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        expect(ox > 1e-9 && oy > 1e-9).toBe(false)
      }
    }
  })

  it('ignores empty, negative and non-finite values', () => {
    expect(squarify([{ value: 0, data: 1 }, { value: -3, data: 2 }, { value: NaN, data: 3 }], 10, 10)).toEqual([])
    expect(squarify(items, 0, 10)).toEqual([])
    expect(squarify([], 10, 10)).toEqual([])
  })

  it('puts a single item over the whole box', () => {
    const [t] = squarify([{ value: 5, data: 'x' }], 40, 30)
    expect(t).toMatchObject({ x: 0, y: 0, w: 40, h: 30 })
  })
})
