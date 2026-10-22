// Quarantine timing. A run stays undoable for `days` days after it happened, then Whittle
// removes it for good (when auto-purge is on).

import type { RunSummary } from '../types'

const DAY = 86_400

export interface Retention {
  run: RunSummary
  /** Seconds since epoch when the run is removed for good. */
  expiresAt: number
  /** Whole days left, rounded up; 0 means "today". */
  daysLeft: number
  /** 0 = just moved, 1 = about to be removed. */
  elapsed: number
}

export function retention(run: RunSummary, days: number, nowSec: number): Retention {
  const total = Math.max(1, days) * DAY
  const expiresAt = run.ts + total
  const left = expiresAt - nowSec
  return {
    run,
    expiresAt,
    daysLeft: Math.max(0, Math.ceil(left / DAY)),
    elapsed: Math.min(1, Math.max(0, (nowSec - run.ts) / total)),
  }
}

/** Runs that can still be undone, the ones that expire first at the top. */
export function inQuarantine(runs: RunSummary[], days: number, nowSec: number): Retention[] {
  return runs
    .filter((r) => r.undoable > 0)
    .map((r) => retention(r, days, nowSec))
    .sort((a, b) => a.expiresAt - b.expiresAt)
}

export function expiryWords(r: Retention, autoPurge: boolean): string {
  if (!autoPurge) return 'Kept until you free it'
  if (r.daysLeft <= 0) return 'Removed today'
  if (r.daysLeft === 1) return 'Removed tomorrow'
  return `Removed in ${r.daysLeft} days`
}
