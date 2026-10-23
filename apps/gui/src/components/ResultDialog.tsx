import { useState } from 'react'
import { CutButton, GhostButton, Modal } from './Primitives'
import type { ResultView } from '../lib/results'
import type { View } from './Sidebar'

const TONE_LABEL = { ok: 'Done', partial: 'Partly done', failed: 'Not done' } as const

/** Shown after an action finishes: what happened, which items, what it means, and what to do next. */
export function ResultDialog({ result, onClose, onNext }: { result: ResultView; onClose: () => void; onNext: (view: View) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const shown = result.rows.slice(0, 50)
  const hidden = result.rows.length - shown.length

  const undo = async () => {
    if (!result.onUndo) return
    setBusy(true); setError(null)
    try {
      await result.onUndo()
    } catch (e) {
      setError(String(e))
      setBusy(false)
    }
  }

  return (
    <Modal title={result.title} wide onClose={onClose}>
      <div className={`result__tone result__tone--${result.tone}`}>{TONE_LABEL[result.tone]}</div>
      <p className="result__headline">{result.headline}</p>

      {result.stats.length > 0 && (
        <dl className="result__stats">
          {result.stats.map((s) => (
            <div key={s.label}><dt>{s.label}</dt><dd className="num">{s.value}</dd></div>
          ))}
        </dl>
      )}

      {result.rows.length > 0 && (
        <div className="result__rows" role="region" aria-label="Items">
          <ul>
            {shown.map((r, i) => (
              <li key={`${r.name}-${i}`} className={r.ok ? '' : 'is-fail'}>
                <span>{r.ok ? '✓' : '!'} {r.name}</span>
                <small>{r.detail}</small>
              </li>
            ))}
          </ul>
          {hidden > 0 && <p className="result__more">and {hidden} more. Open History for the full record.</p>}
        </div>
      )}

      {result.notes.length > 0 && (
        <div className="result__notes">
          <h3>What this means</h3>
          <ul>
            {result.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </div>
      )}

      {result.run && <p className="result__run">Run {result.run}</p>}
      {error && <p className="warn" role="alert">Undo failed: {error}</p>}

      <div className="modal__actions">
        {result.onUndo && <GhostButton onClick={() => void undo()} disabled={busy}>{busy ? 'Undoing…' : 'Undo this run'}</GhostButton>}
        {result.next && <GhostButton onClick={() => onNext(result.next!.view)}>{result.next.label}</GhostButton>}
        <CutButton onClick={onClose}>Done</CutButton>
      </div>
    </Modal>
  )
}
