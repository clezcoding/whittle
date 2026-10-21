import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useFocusTrap } from '../lib/focus'
import { categoryLabel, formatBytes } from '../lib/format'
import { rank } from '../lib/search'
import type { Finding, RuleInfo } from '../types'

export interface Command {
  id: string
  label: string
  group: string
  hint?: string
  keys?: string[]
  /** Extra words that should find this command ("theme" finds "Appearance"). */
  words?: string
  run: () => void
}

type Item =
  | { kind: 'command'; key: string; cmd: Command }
  | { kind: 'finding'; key: string; f: Finding }
  | { kind: 'rule'; key: string; r: RuleInfo }

interface Props {
  commands: Command[]
  findings: Finding[]
  rules: RuleInfo[]
  onInspect: (f: Finding) => void
  onRule: (id: string) => void
  onClose: () => void
}

export function CommandPalette({ commands, findings, rules, onInspect, onRule, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const id = useId()
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  useFocusTrap(ref, onClose, 'input')

  const items = useMemo<Item[]>(() => {
    const cmds = rank(q, commands, (c) => `${c.label} ${c.group} ${c.words ?? ''}`, q ? 7 : Infinity).map<Item>((cmd) => ({ kind: 'command', key: `c:${cmd.id}`, cmd }))
    if (!q.trim()) return cmds
    const fs = rank(q, findings, (f) => `${f.title} ${f.path} ${f.rule} ${categoryLabel(f.category)}`, 6).map<Item>((f) => ({ kind: 'finding', key: `f:${f.id}`, f }))
    const rs = rank(q, rules, (r) => `${r.name} ${r.id} ${r.category} ${r.paths.join(' ')}`, 4).map<Item>((r) => ({ kind: 'rule', key: `r:${r.id}`, r }))
    return [...cmds, ...fs, ...rs]
  }, [q, commands, findings, rules])

  useEffect(() => setAt(0), [q])
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [at, items])

  const run = (it: Item | undefined) => {
    if (!it) return
    onClose()
    if (it.kind === 'command') it.cmd.run()
    else if (it.kind === 'finding') onInspect(it.f)
    else onRule(it.r.id)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAt((a) => (items.length ? (a + 1) % items.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAt((a) => (items.length ? (a - 1 + items.length) % items.length : 0))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setAt(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setAt(Math.max(0, items.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(items[at])
    }
  }

  const heading = (it: Item, prev?: Item) => {
    const g = it.kind === 'command' ? it.cmd.group : it.kind === 'finding' ? 'Findings' : 'Rules'
    const pg = prev ? (prev.kind === 'command' ? prev.cmd.group : prev.kind === 'finding' ? 'Findings' : 'Rules') : null
    return g !== pg ? g : null
  }

  return (
    <div className="scrim scrim--top" onMouseDown={onClose}>
      <div ref={ref} className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette__field">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-activedescendant={items[at] ? `${id}-${at}` : undefined}
            aria-label="Search commands, findings and rules"
            placeholder="Search commands, findings and rules"
            value={q}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
          />
          <kbd>esc</kbd>
        </div>
        <ul ref={list} id={`${id}-list`} role="listbox" className="palette__list">
          {items.length === 0 && <li className="palette__none" role="presentation">Nothing matches “{q}”.</li>}
          {items.map((it, i) => {
            const h = heading(it, items[i - 1])
            return (
              <li key={it.key} role="presentation">
                {h && <div className="palette__group" aria-hidden="true">{h}</div>}
                <div
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={i === at}
                  className={`palette__item ${i === at ? 'is-on' : ''}`}
                  onMouseMove={() => at !== i && setAt(i)}
                  onClick={() => run(it)}
                >
                  {it.kind === 'command' && (
                    <>
                      <span className="palette__label">{it.cmd.label}{it.cmd.hint && <small>{it.cmd.hint}</small>}</span>
                      {it.cmd.keys && <span className="keys__combo">{it.cmd.keys.map((k) => <kbd key={k}>{k}</kbd>)}</span>}
                    </>
                  )}
                  {it.kind === 'finding' && (
                    <>
                      <span className="palette__label">{it.f.title}<small>{categoryLabel(it.f.category)} · {it.f.risk === 'safe' ? 'Safe' : it.f.risk === 'caution' ? 'Review' : 'Manual'}</small></span>
                      <span className="num palette__size">{formatBytes(it.f.bytes)}</span>
                    </>
                  )}
                  {it.kind === 'rule' && (
                    <>
                      <span className="palette__label">{it.r.name}<small>{it.r.id}</small></span>
                      <span className="palette__size">Rule</span>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        <footer className="palette__foot" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </footer>
      </div>
    </div>
  )
}
