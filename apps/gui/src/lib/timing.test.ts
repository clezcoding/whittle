import { describe, expect, it } from 'vitest'
import type { ModuleRun, ScanRun } from '../types'
import { EtaSmoother, overallFraction, runElapsed } from './timing'

const mod = (over: Partial<ModuleRun> = {}): ModuleRun => ({
  state: 'wait', fraction: 0, phase: '', done: 0, total: 0, findings: 0, bytes: 0, t0: null, t1: null, ...over,
})

const run = (over: Partial<ScanRun> = {}): ScanRun => ({
  startedAt: 1000,
  endedAt: null,
  order: ['caches', 'projects'],
  mods: { caches: mod(), projects: mod(), orphans: mod(), dupes: mod() },
  weights: { caches: 1000, projects: 3000, orphans: 2000, dupes: 6000 },
  ...over,
})

describe('runElapsed', () => {
  it('follows the clock while running', () => {
    expect(runElapsed(run(), 4000)).toBe(3000)
  })
  it('is frozen once the run has ended, whatever "now" is', () => {
    const r = run({ endedAt: 7000 })
    expect(runElapsed(r, 7000)).toBe(6000)
    expect(runElapsed(r, 99_000)).toBe(6000)
  })
  it('never goes negative', () => {
    expect(runElapsed(run(), 10)).toBe(0)
  })
})

describe('overallFraction', () => {
  it('weights slow modules more than fast ones', () => {
    const r = run()
    r.mods.caches = mod({ state: 'done' })
    expect(overallFraction(r)).toBeCloseTo(0.25)
  })
  it('reaches exactly 1 when every module is done', () => {
    const r = run()
    r.mods.caches = mod({ state: 'done' })
    r.mods.projects = mod({ state: 'done' })
    expect(overallFraction(r)).toBe(1)
  })
  it('clamps module fractions above 1', () => {
    const r = run()
    r.mods.caches = mod({ state: 'run', fraction: 3 })
    expect(overallFraction(r)).toBeCloseTo(0.25)
  })
})

describe('EtaSmoother', () => {
  it('gives no estimate before there is enough signal', () => {
    const e = new EtaSmoother()
    expect(e.next(1000, 0.5)).toBeNull()
    expect(e.next(5000, 0.02)).toBeNull()
  })
  it('counts down and never climbs, even when the raw estimate does', () => {
    const e = new EtaSmoother()
    let prev = e.next(3000, 0.3)! // raw 7000
    expect(prev).toBeCloseTo(7000)
    // progress stalls, so the raw estimate keeps growing; the shown value must not rise
    for (let t = 4000; t <= 20_000; t += 1000) {
      const v = e.next(t, 0.3)!
      expect(v).toBeLessThanOrEqual(prev + 1e-9)
      prev = v
    }
  })
  it('accepts a lower estimate at once', () => {
    const e = new EtaSmoother()
    e.next(3000, 0.3) // 7000
    expect(e.next(4000, 0.9)).toBeCloseTo(444.4, 0)
  })
  it('has no estimate once finished', () => {
    expect(new EtaSmoother().next(9000, 1)).toBeNull()
  })
})
