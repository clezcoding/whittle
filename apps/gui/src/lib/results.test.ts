import { describe, expect, it } from 'vitest'
import { cleanResult, migrateResult, tidyResult, undoResult } from './results'
import type { ApplyReport, JournalEntry } from '../types'

const entry = (from: string, bytes: number): JournalEntry => ({ run: 'r1', ts: 0, op: 'quarantine', from, to: null, bytes, title: '' })
const report = (applied: JournalEntry[], failed: ApplyReport['failed'] = []): ApplyReport => ({
  run: 'r1', dry_run: false, applied, failed, bytes_handled: 2048, bytes_freed: 0,
})

describe('cleanResult', () => {
  it('is done when everything was handled', () => {
    const r = cleanResult({ report: report([entry('/a/x', 1024)]), disposal: 'quarantine', quarantineDays: 30 })
    expect(r.tone).toBe('ok')
    expect(r.headline).toBe('1 item quarantined.')
    expect(r.notes[0]).toContain('30 days')
  })

  it('is partly done when some items failed', () => {
    const r = cleanResult({
      report: report([entry('/a/x', 1)], [{ path: '/a/y', title: 'y', reason: 'in use' }]),
      disposal: 'quarantine', quarantineDays: 7,
    })
    expect(r.tone).toBe('partial')
    expect(r.headline).toContain('1 item could not be handled')
    expect(r.rows.some((row) => !row.ok && row.detail === 'in use')).toBe(true)
  })

  it('is not done when nothing was handled, and offers no undo', () => {
    const r = cleanResult({ report: report([], [{ path: '/a', title: 'a', reason: 'protected' }]), disposal: 'quarantine', quarantineDays: 7, onUndo: async () => {} })
    expect(r.tone).toBe('failed')
    expect(r.headline).toBe('Nothing was changed.')
    expect(r.onUndo).toBeUndefined()
  })

  it('offers undo only for quarantine', () => {
    const undo = async () => {}
    expect(cleanResult({ report: report([entry('/a', 1)]), disposal: 'trash', quarantineDays: 7, onUndo: undo }).onUndo).toBeUndefined()
    expect(cleanResult({ report: report([entry('/a', 1)]), disposal: 'quarantine', quarantineDays: 7, onUndo: undo }).onUndo).toBe(undo)
  })
})

describe('undoResult and friends', () => {
  it('reports restored and skipped items', () => {
    const r = undoResult({ run: 'r1', restored: 2, skipped: [{ path: '/a', title: 'a', reason: 'path taken' }] })
    expect(r.tone).toBe('partial')
    expect(r.stats[0].value).toBe('2')
  })

  it('counts migrated projects', () => {
    const r = migrateResult([
      { project: '/p/one', ok: true, message: 'ok', run: 'r' },
      { project: '/p/two', ok: false, message: 'pnpm install failed', run: null },
    ])
    expect(r.headline).toBe('1 of 2 project(s) converted to pnpm.')
    expect(r.tone).toBe('partial')
  })

  it('describes a tidy run by file name', () => {
    const r = tidyResult({ ...report([]), applied: [{ ...entry('/Downloads/a.pdf', 5), op: 'move', to: '/Downloads/Documents/a.pdf' }] }, 'Downloads')
    expect(r.rows[0]).toEqual({ name: 'a.pdf', detail: 'moved to Documents', ok: true })
  })
})
