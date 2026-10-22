// Numbers behind the Insights page. Pure functions over the last scan, so they are easy to test.

import type { Finding, Risk } from '../types'
import { categoryLabel, formatBytes, shortPath } from './format'

export interface Slice {
  key: string
  label: string
  bytes: number
  count: number
}

export function byCategory(findings: Finding[]): Slice[] {
  const map = new Map<string, Slice>()
  for (const f of findings) {
    const s = map.get(f.category) ?? { key: f.category, label: categoryLabel(f.category), bytes: 0, count: 0 }
    s.bytes += f.bytes
    s.count++
    map.set(f.category, s)
  }
  return [...map.values()].sort((a, b) => b.bytes - a.bytes)
}

export function byRisk(findings: Finding[]): Record<Risk, { bytes: number; count: number }> {
  const out: Record<Risk, { bytes: number; count: number }> = { safe: { bytes: 0, count: 0 }, caution: { bytes: 0, count: 0 }, manual: { bytes: 0, count: 0 } }
  for (const f of findings) {
    out[f.risk].bytes += f.bytes
    out[f.risk].count++
  }
  return out
}

const DAY = 86_400

export const AGE_BUCKETS = [
  { key: 'month', label: 'Under 1 month', max: 30 },
  { key: 'quarter', label: '1–3 months', max: 90 },
  { key: 'half', label: '3–6 months', max: 180 },
  { key: 'year', label: '6–12 months', max: 365 },
  { key: 'old', label: 'Over a year', max: Infinity },
] as const

/** How long ago things were last changed. Findings without a date are not counted. */
export function byAge(findings: Finding[], nowSec: number): { key: string; label: string; bytes: number; count: number }[] {
  const out = AGE_BUCKETS.map((b) => ({ key: b.key, label: b.label, bytes: 0, count: 0 }))
  for (const f of findings) {
    if (f.modified === null) continue
    const days = Math.max(0, (nowSec - f.modified) / DAY)
    const i = AGE_BUCKETS.findIndex((b) => days < b.max)
    out[i].bytes += f.bytes
    out[i].count++
  }
  return out
}

export function topItems(findings: Finding[], n: number): Finding[] {
  return [...findings].sort((a, b) => b.bytes - a.bytes).slice(0, n)
}

/**
 * What can go. Manual findings are guesses (see Overview), so they are never counted as removable.
 * `safe` is what Whittle pre-selects, `withReview` adds the items you would look at first.
 */
export function reclaimable(findings: Finding[]): { safe: number; withReview: number; regenerable: number; share: number } {
  let safe = 0
  let withReview = 0
  let regenerable = 0
  for (const f of findings) {
    if (f.risk === 'manual') continue
    withReview += f.bytes
    if (f.risk === 'safe') safe += f.bytes
    if (f.regenerable) regenerable += f.bytes
  }
  return { safe, withReview, regenerable, share: withReview > 0 ? regenerable / withReview : 0 }
}

/** Plain-text summary of the last scan, for the clipboard or a bug report. No file contents, only names and sizes. */
export function buildReport(findings: Finding[], home: string, when: Date): string {
  const r = reclaimable(findings)
  const risk = byRisk(findings)
  const lines = [
    `Whittle scan report · ${when.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '',
    `Findings: ${findings.length}`,
    `Can be removed: ${formatBytes(r.withReview)} (safe ${formatBytes(r.safe)})`,
    `By risk: safe ${risk.safe.count} · review ${risk.caution.count} · manual ${risk.manual.count}`,
    '',
    'By category',
    ...byCategory(findings).map((c) => `  ${c.label.padEnd(18)} ${formatBytes(c.bytes).padStart(10)}  ${c.count} item${c.count === 1 ? '' : 's'}`),
    '',
    'Largest items',
    ...topItems(findings, 10).map((f) => `  ${formatBytes(f.bytes).padStart(10)}  ${f.title}  (${shortPath(f.path, home)})`),
  ]
  return lines.join('\n')
}
