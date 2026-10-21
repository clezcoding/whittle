import { useState } from 'react'
import { GhostButton, Modal, CutButton } from '../components/Primitives'
import { formatBytes, formatDate } from '../lib/format'
import type { RunSummary } from '../types'

interface Props {
  runs: RunSummary[]
  quarantine: number
  days: number
  onUndo: (run: string) => Promise<void>
  onPurge: () => Promise<void>
}

export function History({ runs, quarantine, days, onUndo, onPurge }: Props) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  return (
    <section className="view history" aria-labelledby="h-history">
      <header className="view__head">
        <h1 id="h-history">History</h1>
        {quarantine > 0 && <GhostButton onClick={() => setConfirm(true)}>Free {formatBytes(quarantine)} now</GhostButton>}
      </header>
      <p className="lede">
        {quarantine > 0
          ? `Quarantine holds ${formatBytes(quarantine)}. Items stay for ${days} day${days === 1 ? '' : 's'}, then Whittle removes them for good. Until then every run can be undone.`
          : 'Everything Whittle changes is listed here, and can be undone while it is in quarantine.'}
      </p>
      {runs.length === 0 ? (
        <div className="empty"><p>No runs yet.</p></div>
      ) : (
        <ul className="runs">
          {runs.map((r, i) => (
            <li key={r.run} className="run" style={{ ['--i' as string]: i }}>
              <div>
                <b>{formatDate(r.ts)}</b>
                <small>{r.items} item{r.items === 1 ? '' : 's'} · <span className="num">{formatBytes(r.bytes)}</span></small>
              </div>
              <span className={`run__state ${r.undoable > 0 ? 'is-live' : ''}`}>{r.undoable > 0 ? `${r.undoable} can be undone` : r.restored > 0 ? 'restored' : 'final'}</span>
              {r.undoable > 0 ? (
                <GhostButton disabled={busy === r.run} onClick={async () => { setBusy(r.run); try { await onUndo(r.run) } finally { setBusy(null) } }}>Undo</GhostButton>
              ) : <span />}
            </li>
          ))}
        </ul>
      )}
      {confirm && (
        <Modal title="Free quarantine now?" onClose={() => setConfirm(false)}>
          <p>{formatBytes(quarantine)} will be deleted for good. After this, those runs can no longer be undone.</p>
          <div className="modal__actions">
            <GhostButton onClick={() => setConfirm(false)}>Cancel</GhostButton>
            <CutButton onClick={async () => { setConfirm(false); await onPurge() }}>Delete permanently</CutButton>
          </div>
        </Modal>
      )}
    </section>
  )
}
