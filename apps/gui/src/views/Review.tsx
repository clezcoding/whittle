import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { ApplyBar } from '../components/Progress'
import { Check, CutButton, GhostButton, Modal, RiskTag, Segmented } from '../components/Primitives'
import { useCountUp } from '../lib/hooks'
import { categoryLabel, formatBytes, middleEllipsis, shortPath, splitBytes } from '../lib/format'
import { CATEGORY_HELP, explain, oneLine, RISK_HELP } from '../lib/explain'
import { previewPick } from '../lib/preview'
import type { ApplyRun, Disposal, Finding, Risk, Settings } from '../types'

type Filter = 'all' | 'safe' | 'review'

const riskWord = (r: Risk) => (r === 'safe' ? 'Safe' : r === 'caution' ? 'Review' : 'Manual')

interface Props {
  /** Opens the clean preview each time it changes (the Overview quick clean uses this). */
  confirmRequest?: number
  findings: Finding[]
  selected: Set<string>
  onSelected: (s: Set<string>) => void
  peeling: Set<string>
  home: string
  busy: boolean
  run: ApplyRun | null
  notice: { text: string; undo?: () => void } | null
  settings: Settings
  onClean: (disposal: Disposal) => void
  onScan: () => void
  onIgnore: (id: string) => void
  onReveal: (id: string) => void
  onInspect: (f: Finding) => void
}

export function Review({ confirmRequest, findings, selected, onSelected, peeling, home, busy, run, notice, settings, onClean, onScan, onIgnore, onReveal, onInspect }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [disposal, setDisposal] = useState<Disposal>(settings.default_disposal)
  useEffect(() => setDisposal(settings.default_disposal), [settings.default_disposal])
  const days = settings.quarantine_days
  const [confirm, setConfirm] = useState(false)
  useEffect(() => { if (confirmRequest) setConfirm(true) }, [confirmRequest])
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggleOpen = (id: string) =>
    setOpen((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const visible = useMemo(() => findings.filter((f) => (filter === 'all' ? true : filter === 'safe' ? f.risk === 'safe' : f.risk !== 'safe')), [findings, filter])
  const groups = useMemo(() => {
    const m = new Map<string, Finding[]>()
    for (const f of visible) m.set(f.category, [...(m.get(f.category) ?? []), f])
    return [...m.entries()].map(([cat, items]) => ({ cat, items, bytes: items.reduce((s, f) => s + f.bytes, 0) })).sort((a, b) => b.bytes - a.bytes)
  }, [visible])

  const picked = findings.filter((f) => selected.has(f.id))
  const pickedBytes = picked.reduce((s, f) => s + f.bytes, 0)
  const counts = { all: findings.length, safe: findings.filter((f) => f.risk === 'safe').length, review: findings.filter((f) => f.risk !== 'safe').length }
  const preview = previewPick(picked)

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected)
    if (on) next.add(id)
    else next.delete(id)
    onSelected(next)
  }
  const toggleGroup = (items: Finding[], on: boolean) => {
    const next = new Set(selected)
    for (const f of items) (on ? next.add(f.id) : next.delete(f.id))
    onSelected(next)
  }

  const cautionCount = picked.filter((f) => f.risk === 'caution').length
  const manualCount = picked.filter((f) => f.risk === 'manual').length
  // Every clean goes through the confirm dialog, so the user always sees what moves and what it means.
  const go = () => setConfirm(true)

  // Keyboard in the list: ↑/↓ move between findings, Space selects the focused one, Enter opens the preview.
  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (confirm) return
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('.row'))
    const i = rows.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))
      rows[next]?.focus()
    } else if (e.key === ' ' && i >= 0) {
      e.preventDefault()
      const id = rows[i].dataset.id
      if (id) toggle(id, !selected.has(id))
    } else if (e.key === 'Enter' && i >= 0 && picked.length > 0) {
      e.preventDefault()
      go()
    }
  }
  const pb = splitBytes(useCountUp(pickedBytes, 450))

  return (
    <section className="view review" aria-labelledby="h-review">
      <header className="view__head">
        <h1 id="h-review">Review</h1>
        <Segmented
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All ${counts.all}` },
            { value: 'safe', label: `Safe ${counts.safe}` },
            { value: 'review', label: `To review ${counts.review}` },
          ]}
        />
      </header>

      {notice && (
        <div className="notice" role="status">
          <span>{notice.text}</span>
          {notice.undo && <button className="link" onClick={notice.undo}>Undo</button>}
        </div>
      )}

      {findings.length === 0 ? (
        <div className="empty">
          <p>Nothing to review.</p>
          <button className="link" onClick={onScan}>Scan again</button>
        </div>
      ) : (
        <div className="list" role="table" aria-label="Findings" onKeyDown={onListKey}>
          {groups.map((g) => {
            const all = g.items.every((f) => selected.has(f.id))
            const some = g.items.some((f) => selected.has(f.id))
            return (
              <div className="group" role="rowgroup" key={g.cat}>
                <div className="group__head" role="row">
                  <Check checked={all} onChange={(v) => toggleGroup(g.items, v)} label={`Select all in ${categoryLabel(g.cat)}`} />
                  <div className="group__title">
                    <h2 role="columnheader">{categoryLabel(g.cat)}{!all && some && <em> · partly selected</em>}</h2>
                    {CATEGORY_HELP[g.cat] && <p>{CATEGORY_HELP[g.cat]}</p>}
                  </div>
                  <span className="num" role="cell">{formatBytes(g.bytes)}</span>
                </div>
                {g.items.map((f, i) => {
                  const ex = open.has(f.id) ? explain(f) : null
                  return (
                  <div key={f.id} role="row" tabIndex={-1} data-id={f.id} style={{ ['--i' as string]: i }} className={`row ${selected.has(f.id) ? 'is-picked' : ''} ${peeling.has(f.id) ? 'is-peeling' : ''}`} onClick={() => toggle(f.id, !selected.has(f.id))} onDoubleClick={() => onInspect(f)}>
                    <span role="cell"><Check checked={selected.has(f.id)} onChange={(v) => toggle(f.id, v)} label={`Select ${f.title}`} /></span>
                    <span role="cell" className="row__main">
                      <b>{f.title}</b>
                      <code title={f.path}>{middleEllipsis(shortPath(f.path, home), 78)}</code>
                      <small>{oneLine(f)}</small>
                      <button className="why" aria-expanded={!!ex} onClick={(e) => { e.stopPropagation(); toggleOpen(f.id) }}>
                        {ex ? 'Hide details' : 'Why is this here?'}
                      </button>
                    </span>
                    <span role="cell"><RiskTag risk={f.risk} /></span>
                    <span role="cell" className="num">{formatBytes(f.bytes)}</span>
                    {ex && (
                      <>
                      <dl className="row__detail" onClick={(e) => e.stopPropagation()}>
                        <div><dt>What it is</dt><dd>{ex.what}</dd></div>
                        <div><dt>Why it is listed</dt><dd>{ex.why}</dd></div>
                        <div><dt>If you remove it</dt><dd>{ex.impact}</dd></div>
                        <div><dt>Risk: {riskWord(f.risk)}</dt><dd>{RISK_HELP[f.risk]} {ex.undo}</dd></div>
                      </dl>
                      <div className="row__actions" onClick={(e) => e.stopPropagation()}>
                        <button className="link" onClick={() => onInspect(f)}>Open full details</button>
                        <button className="link" onClick={() => onReveal(f.id)}>Show in Finder</button>
                        <button className="link" title="Adds it to Settings, Never touch. You can take it off again there." onClick={() => onIgnore(f.id)}>Never suggest this again</button>
                      </div>
                      </>
                    )}
                  </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      <footer className={`bar ${run ? 'bar--running' : ''}`}>
        {run ? (
          <ApplyBar run={run} label={disposal === 'delete' ? 'Deleting' : disposal === 'trash' ? 'Moving to Trash' : 'Moving to quarantine'} />
        ) : (
          <>
        <div className="bar__sum" aria-live="polite">
          <span className="bar__n">{picked.length} selected</span>
          <b className="num">{pb.value}<small>{pb.unit}</small></b>
        </div>
        <Segmented
          label="What happens to selected items"
          value={disposal}
          onChange={setDisposal}
          options={[
            { value: 'quarantine', label: `Keep ${days} days`, hint: `Moved to Whittle’s quarantine. Undo anytime. Space frees after ${days} days.` },
            { value: 'trash', label: 'Trash', hint: 'Moved to the system Trash.' },
            { value: 'delete', label: 'Free now', hint: 'Deleted for good. Cannot be undone.' },
          ]}
        />
        <CutButton disabled={picked.length === 0 || busy} onClick={go}>{busy ? 'Working…' : disposal === 'delete' ? 'Delete' : 'Clean'} {picked.length > 0 ? `${pb.value} ${pb.unit}` : ''}</CutButton>
          </>
        )}
      </footer>

      {confirm && (
        <Modal title={disposal === 'delete' ? 'Delete permanently?' : `Clean ${picked.length} item${picked.length === 1 ? '' : 's'}?`} onClose={() => setConfirm(false)}>
          <dl className="sum">
            <div><dt>Items</dt><dd>{picked.length}</dd></div>
            <div><dt>Size</dt><dd className="num">{formatBytes(pickedBytes)}</dd></div>
            <div>
              <dt>Items</dt>
              <dd>
                <ul className="sum__items">
                  {preview.items.map((f) => (
                    <li key={f.id}><span>{f.title}</span> <span className="num">{formatBytes(f.bytes)}</span></li>
                  ))}
                </ul>
                {preview.hidden > 0 && <small>and {preview.hidden} more</small>}
              </dd>
            </div>
            <div>
              <dt>What happens</dt>
              <dd>
                {disposal === 'quarantine' && `Moved to quarantine. You can undo it for ${days} day${days === 1 ? '' : 's'}.`}
                {disposal === 'trash' && 'Moved to the Trash. Put Back in Finder restores it.'}
                {disposal === 'delete' && 'Deleted for good. This cannot be undone.'}
              </dd>
            </div>
            {(cautionCount > 0 || manualCount > 0) && (
              <div>
                <dt>Needs your eye</dt>
                <dd>
                  {cautionCount > 0 && `${cautionCount} marked “Review”. `}
                  {manualCount > 0 && `${manualCount} marked “Manual”: Whittle cannot tell whether they hold data you still need.`}
                </dd>
              </div>
            )}
          </dl>
          <div className="modal__actions">
            <GhostButton onClick={() => setConfirm(false)}>Cancel</GhostButton>
            <CutButton onClick={() => { setConfirm(false); onClean(disposal) }}>{disposal === 'delete' ? 'Delete permanently' : disposal === 'trash' ? 'Move to Trash' : 'Clean'}</CutButton>
          </div>
        </Modal>
      )}
    </section>
  )
}
