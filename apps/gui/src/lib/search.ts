// Small fuzzy matcher for the command palette. Every word of the query has to match; a word that
// starts a word in the text scores best, then a plain substring, then letters in order.

function wordScore(word: string, text: string): number | null {
  const at = text.indexOf(word)
  if (at === 0) return 100
  if (at > 0) return /[\s/._·-]/.test(text[at - 1]) ? 80 : 60
  // Letters in order, e.g. "xdd" for "Xcode DerivedData". The letters must sit close together,
  // otherwise "xcode" would match any long path that happens to contain x, c, o, d, e somewhere.
  if (word.length < 3) return null
  const window = word.length * 2 + 2
  for (let start = text.indexOf(word[0]); start !== -1; start = text.indexOf(word[0], start + 1)) {
    let pos = start
    let ok = true
    for (let i = 1; i < word.length; i++) {
      pos = text.indexOf(word[i], pos + 1)
      if (pos === -1) {
        ok = false
        break
      }
    }
    if (ok && pos - start <= window) return 20
    if (!ok) return null
  }
  return null
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
