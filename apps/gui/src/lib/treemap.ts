// Squarified treemap (Bruls, Huizing, van Wijk). Lays items out as rectangles whose areas are
// proportional to their values and whose shapes stay close to squares.

export interface TreeItem<T> {
  value: number
  data: T
}

export interface Tile<T> {
  x: number
  y: number
  w: number
  h: number
  item: TreeItem<T>
}

function worst(row: number[], side: number): number {
  const s = row.reduce((a, b) => a + b, 0)
  const max = Math.max(...row)
  const min = Math.min(...row)
  return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min))
}

export function squarify<T>(items: TreeItem<T>[], width: number, height: number): Tile<T>[] {
  const data = items.filter((i) => i.value > 0 && Number.isFinite(i.value)).sort((a, b) => b.value - a.value)
  if (data.length === 0 || width <= 0 || height <= 0) return []
  const total = data.reduce((s, i) => s + i.value, 0)
  const areas = data.map((i) => (i.value / total) * width * height)
  const out: Tile<T>[] = []
  let x = 0
  let y = 0
  let rw = width
  let rh = height
  let i = 0
  while (i < data.length) {
    const side = Math.min(rw, rh)
    const row = [areas[i]]
    let j = i + 1
    while (j < data.length && worst([...row, areas[j]], side) <= worst(row, side)) {
      row.push(areas[j])
      j++
    }
    const sum = row.reduce((a, b) => a + b, 0)
    if (rw >= rh) {
      const cw = sum / rh
      let cy = y
      for (let k = i; k < j; k++) {
        const ch = areas[k] / cw
        out.push({ x, y: cy, w: cw, h: ch, item: data[k] })
        cy += ch
      }
      x += cw
      rw -= cw
    } else {
      const ch = sum / rw
      let cx = x
      for (let k = i; k < j; k++) {
        const cw = areas[k] / ch
        out.push({ x: cx, y, w: cw, h: ch, item: data[k] })
        cx += cw
      }
      y += ch
      rh -= ch
    }
    i = j
  }
  return out
}
