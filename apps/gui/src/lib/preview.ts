import type { Finding } from '../types'

export interface PickPreview {
  items: Finding[]
  hidden: number
  bytes: number
}

/** The part of a selection shown in the confirm dialog: the largest items first, plus how many are left out. */
export function previewPick(picked: Finding[], limit = 8): PickPreview {
  const sorted = [...picked].sort((a, b) => b.bytes - a.bytes)
  return {
    items: sorted.slice(0, limit),
    hidden: Math.max(0, sorted.length - limit),
    bytes: picked.reduce((s, f) => s + f.bytes, 0),
  }
}
