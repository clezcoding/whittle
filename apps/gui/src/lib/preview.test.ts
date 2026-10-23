import { describe, expect, it } from 'vitest'
import { previewPick } from './preview'
import type { Finding } from '../types'

const f = (id: string, bytes: number) => ({ id, bytes }) as Finding

describe('previewPick', () => {
  it('lists the largest items first and counts the rest', () => {
    const p = previewPick([f('a', 10), f('b', 300), f('c', 20)], 2)
    expect(p.items.map((x) => x.id)).toEqual(['b', 'c'])
    expect(p.hidden).toBe(1)
    expect(p.bytes).toBe(330)
  })

  it('hides nothing when the selection fits', () => {
    const p = previewPick([f('a', 1)], 8)
    expect(p.items).toHaveLength(1)
    expect(p.hidden).toBe(0)
  })

  it('handles an empty selection', () => {
    expect(previewPick([])).toEqual({ items: [], hidden: 0, bytes: 0 })
  })
})
