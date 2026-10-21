import { useMemo, useRef, useState } from 'react'
import { useFocusTrap } from '../lib/focus'
import { categoryLabel, formatBytes, middleEllipsis, shortPath, splitBytes } from '../lib/format'
import { explain } from '../lib/explain'
import { useCountUp } from '../lib/hooks'
import { sourceOf, KIND_LABEL } from '../lib/sources'
import type { Finding, RuleInfo } from '../types'
import { moduleLabel } from '../lib/modules'
import { ConfidenceMeter } from './Charts'
import { Check, GhostButton, RiskTag } from './Primitives'

interface Props {
  finding: Finding
  all: Finding[]
  rule: RuleInfo | undefined
  home: string
  selected: boolean
  onSelect: (on: boolean) => void
  onReveal: () => void
  onIgnore: () => void
  onInspect: (f: Finding) => void
  onRule: (id: string) => void
  onClose: () => void
}

function ageText(f: Finding): string {
  if (!f.modified) return 'Unknown'
  const days = Math.max(0, Math.round((Date.now() / 1000 - f.modified) / 86400))
  if (days < 1) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 60) return `${days} days ago`
  if (days < 730) return `${Math.round(days / 30)} months ago`
  return `${Math.round(days / 365)} years ago`
}

/** Everything Whittle knows about one finding, in a drawer from the right. */
export function Inspector({ finding: f, all, rule, home, selected, onSelect, onReveal, onIgnore, onInspect, onRule, onClose }: Props) {
  const ref = useRef<HTMLElement>(null)
  useFocusTrap(ref, onClose, '.drawer__close')
  const [copied, setCopied] = useState(false)
  const ex = explain(f)
  const total = useMemo(() => all.reduce((s, x) => s + x.bytes, 0) || 1, [all])
  const src = sourceOf(f, home)
  const siblings = useMemo(() => all.filter((x) => x.id !== f.id && (x.rule === f.rule || sourceOf(x, home).key === src.key)).sort((a, b) => b.bytes - a.bytes).slice(0, 4), [all, f, home, src.key])
  const size = splitBytes(useCountUp(f.bytes, 600))

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(f.path)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="scrim" onMouseDown={onClose}>
      <aside ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label={`Details: ${f.title}`} onMouseDown={(e) => e.stopPropagation()}>
        <header className="drawer__head">
          <span className="drawer__eyebrow">{categoryLabel(f.category)} · {KIND_LABEL[src.kind]}: {src.label}</span>
          <button className="drawer__close" aria-label="Close details" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <div className="drawer__body">
          <h2 className="drawer__title">{f.title}</h2>
          <div className="drawer__size">
            <b className="num">{size.value}<small>{size.unit}</small></b>
            <RiskTag risk={f.risk} />
          </div>
          <div className="share" title={`${Math.round((f.bytes / total) * 100)}% of everything in the last scan`}>
            <span style={{ ['--w' as string]: `${Math.max(1.5, (f.bytes / total) * 100)}%` }} />
          </div>
          <small className="drawer__sub">{((f.bytes / total) * 100).toFixed(f.bytes / total < 0.1 ? 1 : 0)}% of all findings</small>

          <div className="pathbox">
            <code title={f.path}>{middleEllipsis(shortPath(f.path, home), 64)}</code>
            <button className="link" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</button>
          </div>

          <dl className="facts">
            <div><dt>Found by</dt><dd>{rule ? <button className="link" onClick={() => onRule(rule.id)}>{rule.name}</button> : <span className="num">{f.rule}</span>}</dd></div>
            <div><dt>Scanner</dt><dd>{moduleLabel(f.module as never)}</dd></div>
            <div><dt>Last changed</dt><dd>{ageText(f)}</dd></div>
            <div><dt>Rebuilt by itself</dt><dd>{f.regenerable ? 'Yes' : 'No'}</dd></div>
            <div><dt>Match</dt><dd><ConfidenceMeter value={f.confidence} /></dd></div>
            {f.related && <div><dt>Related</dt><dd className="num">{shortPath(f.related, home)}</dd></div>}
          </dl>

          <section className="notes">
            <div><h3>What it is</h3><p>{ex.what}</p></div>
            <div><h3>Why it is listed</h3><p>{ex.why}</p></div>
            <div><h3>If you remove it</h3><p>{ex.impact}</p></div>
            <div><h3>Getting it back</h3><p>{ex.undo}</p></div>
          </section>

          {siblings.length > 0 && (
            <section className="more">
              <h3>Related findings</h3>
              <ul>
                {siblings.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => onInspect(s)}>
                      <span>{s.title}</span>
                      <span className="num">{formatBytes(s.bytes)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="drawer__foot">
          <label className="drawer__pick">
            <Check checked={selected} onChange={onSelect} label={`Include ${f.title} in the clean`} />
            <span>{selected ? 'Included in the clean' : 'Not selected'}</span>
          </label>
          <div className="drawer__acts">
            <GhostButton onClick={onReveal}>Show in Finder</GhostButton>
            <GhostButton title="Adds it to Settings, Never touch. You can take it off again there." onClick={onIgnore}>Never suggest</GhostButton>
          </div>
        </footer>
      </aside>
    </div>
  )
}
