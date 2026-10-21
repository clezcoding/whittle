const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/** Decimal units, like Finder. Mirrors `whittle_core::format_bytes`. */
export function splitBytes(bytes: number): { value: string; unit: string } {
  let v = bytes
  let i = 0
  while (v >= 1000 && i < UNITS.length - 1) {
    v /= 1000
    i++
  }
  if (i === 0) return { value: String(Math.round(v)), unit: 'B' }
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2
  return { value: v.toFixed(digits), unit: UNITS[i] }
}

export function formatBytes(bytes: number): string {
  const { value, unit } = splitBytes(bytes)
  return `${value} ${unit}`
}

export function shortPath(path: string, home: string): string {
  return home && path.startsWith(home + '/') ? '~' + path.slice(home.length) : path
}

/** `~/Library/Caches/very/long/name` -> `~/Library/…/long/name` without losing the end. */
export function middleEllipsis(s: string, max = 64): string {
  if (s.length <= max) return s
  const keep = max - 1
  const head = Math.ceil(keep * 0.45)
  return s.slice(0, head) + '…' + s.slice(s.length - (keep - head))
}

const CATEGORY_LABELS: Record<string, string> = {
  caches: 'Caches & logs',
  dev: 'Developer data',
  'app-leftovers': 'App leftovers',
  downloads: 'Old installers',
  duplicates: 'Duplicates',
  backups: 'Device backups',
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

export function formatDate(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** `12.4 s`, `1 min 05 s`. Used for elapsed and remaining time. */
export function formatDuration(ms: number): string {
  const s = Math.max(0, ms) / 1000
  if (s < 60) return `${s.toFixed(1)} s`
  const m = Math.floor(s / 60)
  return `${m} min ${String(Math.floor(s % 60)).padStart(2, '0')} s`
}

export function formatPercent(fraction: number): string {
  return `${Math.min(100, Math.floor(fraction * 100))}%`
}

/** Remaining time, or "estimating…" while there is not enough signal yet. */
export function formatRemaining(leftMs: number | null): string {
  if (leftMs === null) return 'estimating…'
  if (leftMs < 1500) return 'almost done'
  return `about ${leftMs < 60000 ? Math.round(leftMs / 1000) + ' s' : formatDuration(leftMs).replace(/ \d+ s$/, '')} left`
}
