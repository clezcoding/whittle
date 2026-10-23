// Builds the summary shown in the result dialog after an action finishes. Pure functions, so
// the wording and the done / partly done / not done decision can be unit tested.

import type { ApplyReport, Disposal, MigrateOutcome, PurgeReport, UndoReport } from '../types'
import type { View } from '../components/Sidebar'
import { formatBytes } from './format'

export type Tone = 'ok' | 'partial' | 'failed'

export interface ResultRow {
  name: string
  detail: string
  ok: boolean
}

export interface ResultStat {
  label: string
  value: string
}

export interface ResultView {
  title: string
  tone: Tone
  /** One plain sentence saying what happened. */
  headline: string
  stats: ResultStat[]
  rows: ResultRow[]
  /** What this means for the user, and what they can still do. */
  notes: string[]
  run?: string
  /** Undo the run from the dialog. Absent when nothing can be undone. */
  onUndo?: () => Promise<void>
  /** A button that takes the user to the page where the next step happens. */
  next?: { label: string; view: View }
}

const baseName = (path: string) => path.split('/').filter(Boolean).pop() ?? path
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function toneOf(failed: number, done: number): Tone {
  if (failed === 0) return 'ok'
  return done === 0 ? 'failed' : 'partial'
}

export function cleanResult(args: {
  report: ApplyReport
  disposal: Disposal
  quarantineDays: number
  onUndo?: () => Promise<void>
}): ResultView {
  const { report, disposal, quarantineDays, onUndo } = args
  const done = report.applied.length
  const failed = report.failed.length
  const verb = disposal === 'delete' ? 'deleted' : disposal === 'trash' ? 'moved to the Trash' : 'quarantined'
  const bytes = disposal === 'delete' ? report.bytes_freed : report.bytes_handled
  const title = disposal === 'delete' ? 'Deleted' : disposal === 'trash' ? 'Moved to the Trash' : 'Quarantined'

  const notes =
    disposal === 'quarantine'
      ? [
          `Kept in quarantine for ${plural(quarantineDays, 'day')}. Until then you can put everything back.`,
          'After that period Whittle removes the items for good. Free the space earlier from History if you are sure.',
        ]
      : disposal === 'trash'
        ? ['The items are in the Trash. You can restore them from there in Finder.']
        : ['Deleted for good. This cannot be undone.']
  if (failed > 0) notes.push('Items that could not be handled were left where they were. Nothing was half-removed.')

  return {
    title,
    tone: toneOf(failed, done),
    headline: done === 0
      ? 'Nothing was changed.'
      : `${plural(done, 'item')} ${verb}${failed ? `, ${plural(failed, 'item')} could not be handled` : ''}.`,
    stats: [
      { label: 'Handled', value: plural(done, 'item') },
      { label: 'Size', value: formatBytes(bytes) },
      { label: 'Not handled', value: String(failed) },
    ],
    rows: [
      ...report.applied.map((a) => ({ name: a.title || baseName(a.from), detail: `${formatBytes(a.bytes)} · ${verb}`, ok: true })),
      ...report.failed.map((f) => ({ name: f.title || baseName(f.path), detail: f.reason, ok: false })),
    ],
    notes,
    run: report.run,
    onUndo: disposal === 'quarantine' && done > 0 ? onUndo : undefined,
    next: { label: 'Open History', view: 'history' },
  }
}

export function undoResult(report: UndoReport): ResultView {
  const skipped = report.skipped.length
  return {
    title: 'Undo finished',
    tone: skipped === 0 ? 'ok' : report.restored === 0 ? 'failed' : 'partial',
    headline: report.restored === 0 && skipped > 0
      ? 'Nothing could be put back.'
      : `${plural(report.restored, 'item')} put back where they came from${skipped ? `, ${plural(skipped, 'item')} could not be restored` : ''}.`,
    stats: [
      { label: 'Restored', value: String(report.restored) },
      { label: 'Not restored', value: String(skipped) },
    ],
    rows: report.skipped.map((f) => ({ name: f.title || baseName(f.path), detail: f.reason, ok: false })),
    notes: skipped
      ? ['Items that could not be restored are still in quarantine. Check the reasons above; a path that is now taken is the usual cause.']
      : ['The run is closed. It stays in History as a record of what happened.'],
    run: report.run,
    next: { label: 'Open History', view: 'history' },
  }
}

export function purgeResult(report: PurgeReport): ResultView {
  return {
    title: 'Quarantine emptied',
    tone: 'ok',
    headline: `Freed ${formatBytes(report.bytes_freed)} for good.`,
    stats: [
      { label: 'Freed', value: formatBytes(report.bytes_freed) },
      { label: 'Runs removed', value: String(report.runs_removed) },
    ],
    rows: [],
    notes: ['These runs can no longer be undone. Nothing else was touched.'],
    next: { label: 'Open Overview', view: 'overview' },
  }
}

export function tidyResult(report: ApplyReport, folder: string): ResultView {
  const done = report.applied.length
  const failed = report.failed.length
  return {
    title: 'Folder tidied',
    tone: toneOf(failed, done),
    headline: done === 0 ? 'No files needed to move.' : `Moved ${plural(done, 'file')} in ${folder}.`,
    stats: [
      { label: 'Moved', value: String(done) },
      { label: 'Not moved', value: String(failed) },
    ],
    rows: [
      ...report.applied.map((a) => ({ name: baseName(a.from), detail: `moved to ${baseName((a.to ?? '').split('/').slice(0, -1).join('/'))}`, ok: true })),
      ...report.failed.map((f) => ({ name: baseName(f.path), detail: f.reason, ok: false })),
    ],
    notes: [
      'Sub-folders, hidden files, app bundles and files newer than ten minutes were left alone.',
      'Every move is recorded. Undo the whole run from History.',
    ],
    run: report.run,
    next: { label: 'Open History', view: 'history' },
  }
}

export function migrateResult(outcomes: MigrateOutcome[]): ResultView {
  const ok = outcomes.filter((o) => o.ok).length
  const failed = outcomes.length - ok
  return {
    title: 'Projects moved to pnpm',
    tone: toneOf(failed, ok),
    headline: outcomes.length === 0 ? 'No projects were converted.' : `${ok} of ${outcomes.length} project(s) converted to pnpm.`,
    stats: [
      { label: 'Converted', value: String(ok) },
      { label: 'Skipped', value: String(failed) },
    ],
    rows: outcomes.map((o) => ({ name: baseName(o.project), detail: o.message, ok: o.ok })),
    notes: [
      'Each conversion was verified with pnpm install in a scratch copy before it was written.',
      'The old lockfile is in quarantine. Undo a run in History to bring it back.',
    ],
    next: { label: 'Open History', view: 'history' },
  }
}

export function pnpmInstalledResult(version: string): ResultView {
  return {
    title: 'pnpm installed',
    tone: 'ok',
    headline: `pnpm ${version} is installed and ready.`,
    stats: [{ label: 'Version', value: version }],
    rows: [],
    notes: ['Whittle uses it to verify every conversion. You can now convert your projects.'],
  }
}
