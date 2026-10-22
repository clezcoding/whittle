import { useMemo, useState } from 'react'
import { Ring } from '../components/Charts'
import { EmptyState } from '../components/EmptyState'
import { CutButton, GhostButton, Modal } from '../components/Primitives'
import { formatBytes, formatDate, splitBytes } from '../lib/format'
import { useCountUp } from '../lib/hooks'
import { expiryWords, inQuarantine } from '../lib/quarantine'
import type { RunSummary } from '../types'

interface Props {
  runs: RunSummary[]
  quarantine: number
  days: number
  autoPurge: boolean
  onUndo: (run: string) => Promise<void>
  onPurge: () => Promise<void>
  onSettings: () => void
}

export function Quarantine({ runs, quarantine, days, autoPurge, onUndo, onPurge, onSettings }: Props) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const nowSec = Math.floor(Date.now() / 1000)
  const held = useMemo(() => inQuarantine(runs, days, nowSec), [runs, days, nowSec])
  const size = splitBytes(useCountUp(quarantine, 800))
  const next = held[0]

  const undo = async (run: string) => {
    setBusy(run)
    try {
      await onUndo(run)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="view quarantine" aria-labelledby="h-quarantine">
      <header className="view__head">
        <h1 id="h-quarantine">Quarantine</h1>
        {quarantine > 0 && <GhostButton onClick={() => setConfirm(true)}>Free {formatBytes(quarantine)} now</GhostButton>}
      </header>

      {held.length === 0 ? (
        <EmptyState title="Quarantine is empty" text={`When you clean with “Keep ${days} days”, the items wait here. You can put them back at any time before the ${days} days are over.`} progress={0.4}>
          <GhostButton onClick={onSettings}>Change the period</GhostButton>
        </EmptyState>
      ) : (
        <>
          <div className="qhero">
            <div>
              <span className="qhero__l">Waiting here</span>
              <b className="qhero__v num">{size.value}<small>{size.unit}</small></b>
              <p>
                {held.length} run{held.length === 1 ? '' : 's'} can still be undone.
                {autoPurge && next ? ` The first one is removed ${next.daysLeft <= 0 ? 'today' : next.daysLeft === 1 ? 'tomorrow' : `in ${next.daysLeft} days`}.` : ' Nothing is removed on its own until you free it.'}
              </p>
            </div>
            <ol className="flow" aria-label="How quarantine works">
              <li><i /><b>Moved</b><small>Out of the way, not deleted</small></li>
              <li><i /><b>Kept {days} day{days === 1 ? '' : 's'}</b><small>Undo from here</small></li>
              <li><i /><b>{autoPurge ? 'Removed' : 'Yours to free'}</b><small>{autoPurge ? 'Space comes back' : 'Auto-remove is off'}</small></li>
            </ol>
          </div>

          <ul className="qruns">
            {held.map((h, i) => (
              <li key={h.run.run} className="qrun" style={{ ['--i' as string]: i }}>
                <Ring fraction={h.elapsed}>
                  <b className="num">{autoPurge ? h.daysLeft : '∞'}</b>
                  <small>{autoPurge ? 'days' : ''}</small>
                </Ring>
                <div className="qrun__main">
                  <b>{formatDate(h.run.ts)}</b>
                  <small>{h.run.undoable} of {h.run.items} item{h.run.items === 1 ? '' : 's'} can be put back · <span className="num">{formatBytes(h.run.bytes)}</span></small>
                </div>
                <span className={`qrun__when ${autoPurge && h.daysLeft <= 3 ? 'is-soon' : ''}`}>{expiryWords(h, autoPurge)}</span>
                <GhostButton disabled={busy === h.run.run} onClick={() => void undo(h.run.run)}>{busy === h.run.run ? 'Restoring…' : 'Put back'}</GhostButton>
              </li>
            ))}
          </ul>

          <p className="qnote">
            Automatic removal is <b>{autoPurge ? 'on' : 'off'}</b>, after {days} day{days === 1 ? '' : 's'}.{' '}
            <button className="link" onClick={onSettings}>Change in Settings</button>
          </p>
        </>
      )}

      {confirm && (
        <Modal title="Free quarantine now?" onClose={() => setConfirm(false)}>
          <p>{formatBytes(quarantine)} will be deleted for good. After this, {held.length} run{held.length === 1 ? '' : 's'} can no longer be undone.</p>
          <div className="modal__actions">
            <GhostButton onClick={() => setConfirm(false)}>Cancel</GhostButton>
            <CutButton onClick={async () => { setConfirm(false); await onPurge() }}>Delete permanently</CutButton>
          </div>
        </Modal>
      )}
    </section>
  )
}
