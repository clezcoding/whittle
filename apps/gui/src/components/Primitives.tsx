import { GLOSSARY, type TermKey } from '../lib/glossary'
import { useEffect, useId, useRef, useState } from 'react'
import { useFocusTrap } from '../lib/focus'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Risk } from '../types'

/** The primary action. A knife bevel with a red sliver on its left edge: the cut. */
export function CutButton({ children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button className={`cut-btn ${className}`} {...rest}>
      <span className="cut-btn__label">{children}</span>
    </button>
  )
}

export function GhostButton({ children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button className={`ghost-btn ${className}`} {...rest}>
      <span>{children}</span>
    </button>
  )
}

import { RISK_HELP } from '../lib/explain'

const RISK_LABEL: Record<Risk, string> = { safe: 'Safe', caution: 'Review', manual: 'Manual' }

/** Risk is never colour alone: a shape and a word. */
/** A word with a one-sentence explanation on hover, focus and in the accessible name. */
export function Term({ term, children }: { term: TermKey; children: ReactNode }) {
  return (
    <abbr className="term" title={GLOSSARY[term]} tabIndex={0}>
      {children}
    </abbr>
  )
}

export function RiskTag({ risk }: { risk: Risk }) {
  return (
    <span className={`risk risk--${risk}`} title={RISK_HELP[risk]}>
      <i className="risk__dot" aria-hidden="true" />
      {RISK_LABEL[risk]}
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; hint?: string }[]
  label: string
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} title={o.hint} className={`seg__opt ${value === o.value ? 'is-on' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="checkbox" aria-checked={checked} aria-label={label} className={`check ${checked ? 'is-on' : ''}`} onClick={(e) => { e.stopPropagation(); onChange(!checked) }}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.4 12.6 4.8" /></svg>
    </button>
  )
}

/** An on/off switch. A word as well as a position, so it never relies on colour or motion alone. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="toggle__knob" aria-hidden="true" />
      <span className="toggle__word" aria-hidden="true">{checked ? 'On' : 'Off'}</span>
    </button>
  )
}

/** A whole number with − and + buttons. Typing is allowed; the value is clamped when you leave. */
export function Stepper({ value, onChange, min, max, unit, label }: { value: number; onChange: (v: number) => void; min: number; max: number; unit: string; label: string }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = (raw: string) => {
    const n = Math.round(Number(raw))
    const next = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value
    setText(String(next))
    if (next !== value) onChange(next)
  }
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button aria-label={`Less ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <input
        inputMode="numeric"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
      />
      <span className="stepper__unit">{unit}</span>
      <button aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  )
}

/** A dialog: Escape closes it, Tab stays inside it, and focus returns to where it came from. */
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  // Land on the primary action if there is one, else the first control.
  useFocusTrap(ref, onClose, '.cut-btn:not(:disabled)')
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div ref={ref} className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} onMouseDown={(e) => e.stopPropagation()}>
        <h2 id={id}>{title}</h2>
        {children}
      </div>
    </div>
  )
}
