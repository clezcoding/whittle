// All time and progress arithmetic for scans lives here, in pure functions, so the live counter,
// the frozen total and the "Scanned in" label can never disagree: they are all derived from the
// same two timestamps on the run (`startedAt`, `endedAt`).

import type { ModuleId, ScanRun } from '../types'

/** Milliseconds a run has taken: live while running, frozen once `endedAt` is set. */
export function runElapsed(run: Pick<ScanRun, 'startedAt' | 'endedAt'>, now: number): number {
  return Math.max(0, (run.endedAt ?? now) - run.startedAt)
}

/** Rough relative cost of each module, used until we have measured real durations. */
const DEFAULT_WEIGHTS: Record<ModuleId, number> = { caches: 1, projects: 3, orphans: 2, dupes: 6 }
const WEIGHTS_KEY = 'whittle.moduleDurations.v1'

type Durations = Partial<Record<ModuleId, number>>

function readDurations(): Durations {
  try {
    const raw = window.localStorage.getItem(WEIGHTS_KEY)
    return raw ? (JSON.parse(raw) as Durations) : {}
  } catch {
    return {}
  }
}

/** Weights for the overall percentage: this machine's measured durations, else sensible defaults. */
export function moduleWeights(order: ModuleId[]): Record<ModuleId, number> {
  const learned = readDurations()
  const out = {} as Record<ModuleId, number>
  for (const m of order) {
    const ms = learned[m]
    out[m] = typeof ms === 'number' && ms > 0 ? Math.max(300, ms) : DEFAULT_WEIGHTS[m] * 1000
  }
  return out
}

/** Remember how long each module really took, so the next scan's percentage is honest. */
export function rememberDurations(run: ScanRun): void {
  try {
    const learned = readDurations()
    for (const m of run.order) {
      const { t0, t1 } = run.mods[m]
      if (t0 !== null && t1 !== null && t1 > t0) learned[m] = t1 - t0
    }
    window.localStorage.setItem(WEIGHTS_KEY, JSON.stringify(learned))
  } catch {
    /* storage unavailable: weights fall back to defaults */
  }
}

/** Overall fraction: modules weighted by how long they take, never above 1, never going back. */
export function overallFraction(run: ScanRun): number {
  if (!run.order.length) return 0
  const w = run.weights
  let total = 0
  let done = 0
  for (const m of run.order) {
    const weight = w[m] ?? 1
    total += weight
    done += weight * (run.mods[m].state === 'done' ? 1 : Math.min(1, run.mods[m].fraction))
  }
  return total > 0 ? Math.min(1, done / total) : 0
}

/**
 * Time left, as a countdown that only ever goes down.
 *
 * A raw estimate `elapsed * (1 - f) / f` jumps around whenever a slow module starts, which makes a
 * naive display climb. This keeps the last shown value, subtracts the real time that has passed,
 * accepts any *lower* new estimate at once, and lets a *higher* one in only slowly (at most half
 * the elapsed delta), so the number counts down while still converging on the truth.
 */
export class EtaSmoother {
  private shown: number | null = null
  private lastElapsed = 0

  next(elapsedMs: number, fraction: number): number | null {
    if (fraction >= 1) return null
    if (fraction < 0.08 || elapsedMs < 2000) return null
    const raw = (elapsedMs * (1 - fraction)) / fraction
    if (this.shown === null) {
      this.shown = raw
    } else {
      const dt = Math.max(0, elapsedMs - this.lastElapsed)
      const counted = Math.max(0, this.shown - dt)
      const delta = raw - counted
      this.shown = delta <= 0 ? raw : counted + Math.min(delta, dt * 0.5)
    }
    this.lastElapsed = elapsedMs
    return this.shown
  }
}
