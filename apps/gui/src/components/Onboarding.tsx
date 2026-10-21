import { useEffect, useState } from 'react'
import { Curl } from './Curl'
import { CutButton, GhostButton } from './Primitives'
import type { Permissions } from '../types'

interface Props {
  days: number
  permissions: Permissions | null
  onRecheck: () => void
  onOpenAccess: () => void
  onDone: () => void
}

const STEPS = ['Welcome', 'Safety', 'Access'] as const

/** First run: what Whittle is, what it promises, and the one optional permission. */
export function Onboarding({ days, permissions, onRecheck, onOpenAccess, onDone }: Props) {
  const [step, setStep] = useState(0)
  const fda = permissions?.full_disk_access

  // While the permission step is open, look again every couple of seconds: the user is in System Settings.
  useEffect(() => {
    if (step !== 2 || fda === true) return
    const t = window.setInterval(onRecheck, 2500)
    return () => window.clearInterval(t)
  }, [step, fda, onRecheck])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label="Welcome to Whittle">
      <div className="welcome__drag" data-tauri-drag-region />
      <div className="welcome__card" key={step}>
        {step === 0 && (
          <>
            <Curl className="welcome__curl" />
            <h1>Shave your Mac down to what you use.</h1>
            <ul className="welcome__list">
              <li><b>Leftovers.</b> Files that apps you removed left behind.</li>
              <li><b>Caches.</b> Build folders and caches that rebuild themselves.</li>
              <li><b>Clutter.</b> A messy Downloads folder, sorted without guessing.</li>
            </ul>
          </>
        )}
        {step === 1 && (
          <>
            <h1>Nothing happens behind your back.</h1>
            <ol className="welcome__list welcome__list--num">
              <li><b>Scanning changes nothing.</b> You see every item first, with the reason it is listed.</li>
              <li><b>Cleaning is undoable.</b> Items wait in quarantine for {days} day{days === 1 ? '' : 's'}. One click puts them back.</li>
              <li><b>Some things are off limits.</b> System files, other users, git data, and your Photos, Mail and Keychain stay untouched.</li>
              <li><b>It all stays on this Mac.</b> No account, no network, no tracking.</li>
            </ol>
          </>
        )}
        {step === 2 && (
          <>
            <h1>One optional permission.</h1>
            <p className="welcome__p">
              macOS hides some folders from every app. With <b>Full Disk Access</b>, Whittle can also find leftovers in those. It never removes more because of it, and it works without.
            </p>
            <div className="welcome__access">
              <span className={`status status--${fda === true ? 'ok' : fda === false ? 'off' : 'na'}`}>
                <i aria-hidden="true" />
                {fda === true ? 'Granted' : fda === false ? 'Not granted yet' : 'Cannot be checked here'}
              </span>
              {fda !== true && fda !== null && <GhostButton onClick={onOpenAccess}>Open System Settings</GhostButton>}
            </div>
            {fda === false && <p className="welcome__hint">In System Settings, turn on Whittle under Privacy &amp; Security, then Full Disk Access. macOS applies it the next time Whittle starts.</p>}
          </>
        )}
        <div className="welcome__foot">
          <div className="dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => <i key={s} className={i === step ? 'is-on' : i < step ? 'is-past' : ''} />)}
          </div>
          <div className="welcome__actions">
            {step > 0 && <GhostButton onClick={() => setStep(step - 1)}>Back</GhostButton>}
            {step < STEPS.length - 1 ? (
              <CutButton onClick={() => setStep(step + 1)}>Continue</CutButton>
            ) : (
              <CutButton onClick={onDone}>{fda === true ? 'Start' : 'Start without'}</CutButton>
            )}
          </div>
        </div>
      </div>
      <button className="welcome__skip link" onClick={onDone}>Skip</button>
    </div>
  )
}
