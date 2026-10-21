import { GhostButton, Modal } from './Primitives'

export const SHORTCUTS: { keys: string[]; what: string }[] = [
  { keys: ['⌘', 'R'], what: 'Scan' },
  { keys: ['⌘', '1'], what: 'Overview' },
  { keys: ['⌘', '2'], what: 'Review' },
  { keys: ['⌘', '3'], what: 'Tidy a folder' },
  { keys: ['⌘', '4'], what: 'History' },
  { keys: ['⌘', ','], what: 'Settings' },
  { keys: ['?'], what: 'This list' },
  { keys: ['Esc'], what: 'Close a dialog' },
]

export function Shortcuts({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <ul className="keys">
        {SHORTCUTS.map((s) => (
          <li key={s.what}>
            <span>{s.what}</span>
            <span className="keys__combo">{s.keys.map((k) => <kbd key={k}>{k}</kbd>)}</span>
          </li>
        ))}
      </ul>
      <div className="modal__actions">
        <GhostButton onClick={onClose}>Close</GhostButton>
      </div>
    </Modal>
  )
}
