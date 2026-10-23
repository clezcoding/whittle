import { useState } from 'react'
import { api } from '../lib/api'
import { GhostButton } from './Primitives'

/** Opens the Finder folder picker. The chosen folder is handed to `onPick`; cancelling does nothing. */
export function ChooseFolder({ onPick, disabled = false, onError }: { onPick: (path: string) => void; disabled?: boolean; onError?: (message: string) => void }) {
  const [busy, setBusy] = useState(false)
  const choose = async () => {
    setBusy(true)
    try {
      const path = await api.pickFolder()
      if (path) onPick(path)
    } catch (e) {
      onError?.(String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <GhostButton type="button" disabled={disabled || busy} onClick={() => void choose()}>
      {busy ? 'Choosing…' : 'Choose in Finder…'}
    </GhostButton>
  )
}
