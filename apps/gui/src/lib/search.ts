// Small fuzzy matcher for the command palette. Every word of the query has to match; a word that
// starts a word in the text scores best, then a plain substring, then letters in order.

function wordScore(word: string, text: string): number | null {
  const at = text.indexOf(word)
  if (at === 0) return 100
  if (at > 0) return /[\s/._·-]/.test(text[at - 1]) ? 80 : 60
  // letters in order, e.g. "xdd" for "Xcode DerivedData"
  let pos = 0
  for (const ch of word) {
    pos = text.indexOf(ch, pos)
    if (pos === -1) return null
    pos++
  }
  return word.length >= 3 ? 20 : null
}

/** Higher is better; null means no match. An empty query matches everything equally. */
export function score(query: string, text: string): number | null {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 0
  const hay = text.toLowerCase()
  let total = 0
  for (const w of words) {
    const s = wordScore(w, hay)
    if (s === null) return null
    total += s
  }
  // Shorter texts win ties: "Scan" beats "Scan again later".
  return total - Math.min(hay.length, 60) / 100
}

export function rank<T>(query: string, items: T[], text: (item: T) => string, limit = Infinity): T[] {
  const scored: { item: T; s: number; i: number }[] = []
  items.forEach((item, i) => {
    const s = score(query, text(item))
    if (s !== null) scored.push({ item, s, i })
  })
  scored.sort((a, b) => b.s - a.s || a.i - b.i)
  return scored.slice(0, limit).map((x) => x.item)
}
