import { useState } from 'react'
import { CutButton, GhostButton, Modal } from './Primitives'

/** A plain-text summary of the last scan. Names and sizes only, nothing from inside the files. */
export function ReportDialog({ text, onClose }: { text: string; onClose: () => void }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('failed')
    }
  }
  return (
    <Modal title="Scan report" wide onClose={onClose}>
      <p>Only names, sizes and counts. Nothing from inside your files. Safe to paste into a bug report.</p>
      <pre className="report" tabIndex={0} aria-label="Report text">{text}</pre>
      <div className="modal__actions">
        {state === 'failed' && <span className="warn">Could not reach the clipboard. Select the text and copy it.</span>}
        <GhostButton onClick={onClose}>Close</GhostButton>
        <CutButton onClick={() => void copy()}>{state === 'copied' ? 'Copied' : 'Copy report'}</CutButton>
      </div>
    </Modal>
  )
}
