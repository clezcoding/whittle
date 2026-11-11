import { useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { Check, CutButton, GhostButton, RiskTag, Segmented } from '../components/Primitives'
import { formatBytes } from '../lib/format'
import { rank } from '../lib/search'
import { groupBySource, KIND_LABEL, type SourceKind } from '../lib/sources'
import type { Finding, InstalledApp } from '../types'

type Kind = 'all' | SourceKind

interface Props {
  findings: Finding[]
  home: string
  selected: Set<string>
  onSelectMany: (ids: string[], on: boolean) => void
  onInspect: (f: Finding) => void
  onReview: () => void
  onScan: () => void
  /** Apps that can be uninstalled, from the Applications folders. */
  installed?: InstalledApp[]
  /** Finds what the app left behind; the items go to Review. */
  onUninstall?: (app: InstalledApp) => void
}

export function Apps({ findings, home, selected, onSelectMany, onInspect, onReview, onScan, installed = [], onUninstall }: Props) {
  const [kind, setKind] = useState<Kind>('all')
  const [q, setQ] = useState('')
  const groups = useMemo(() => groupBySource(findings, home), [findings, home])
  const [open, setOpen] = useState<Set<string>>(() => new Set(groups.slice(0, 1).map((g) => g.source.key)))

  const shown = useMemo(() => {
    const byKind = kind === 'all' ? groups : groups.filter((g) => g.source.kind === kind)
    return q.trim() ? rank(q, byKind, (g) => `${g.source.label} ${KIND_LABEL[g.source.kind]}`) : byKind
  }, [groups, kind, q])
  const max = groups[0]?.bytes ?? 1
  const kinds = useMemo(() => {
    const c: Record<Kind, number> = { all: groups.length, app: 0, project: 0, tool: 0, folder: 0 }
    for (const g of groups) c[g.source.kind]++
    return c
  }, [groups])
  const picked = findings.filter((f) => selected.has(f.id))

  const toggle = (key: string) =>
    setOpen((cur) => {
      const n = new Set(cur)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  return (
    <section className="view apps" aria-labelledby="h-apps">
      <header className="view__head">
        <h1 id="h-apps">Apps</h1>
        {findings.length > 0 && (
          <Segmented
            label="Kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'all', label: `All ${kinds.all}` },
              ...(kinds.app ? [{ value: 'app' as const, label: `Apps ${kinds.app}` }] : []),
              ...(kinds.project ? [{ value: 'project' as const, label: `Projects ${kinds.project}` }] : []),
              ...(kinds.tool ? [{ value: 'tool' as const, label: `Dev tools ${kinds.tool}` }] : []),
              ...(kinds.folder ? [{ value: 'folder' as const, label: `Folders ${kinds.folder}` }] : []),
            ]}
          />
        )}
      </header>

      {findings.length === 0 ? (
        <EmptyState title="No apps to rank yet" text="After a scan this page shows which apps, dev tools and projects hold the most space, and lets you pick a whole app at once.">
          <CutButton onClick={onScan}>Scan now</CutButton>
        </EmptyState>
      ) : (
        <>
          <p className="lede">The same findings, grouped by who made them. Pick everything safe from an app in one click, then review as usual.</p>
          <div className="pick pick--inline">
            <input aria-label="Filter by name" placeholder="Filter by name" value={q} spellCheck={false} onChange={(e) => setQ(e.target.value)} />
            <GhostButton disabled={picked.length === 0} onClick={onReview}>{picked.length > 0 ? `Review ${picked.length} selected` : 'Nothing selected'}</GhostButton>
          </div>

          {shown.length === 0 ? (
            <div className="empty"><p>Nothing matches “{q}”.</p></div>
          ) : (
            <ul className="srcs">
              {shown.map((g, i) => {
                const isOpen = open.has(g.source.key)
                const safe = g.items.filter((f) => f.risk === 'safe')
                const safeAll = safe.length > 0 && safe.every((f) => selected.has(f.id))
                return (
                  <li key={g.source.key} className={`src ${isOpen ? 'is-open' : ''}`} style={{ ['--i' as string]: i }}>
                    <div className="src__head">
                      <button className="src__toggle" aria-expanded={isOpen} onClick={() => toggle(g.source.key)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                        <span className="src__name"><b>{g.source.label}</b><small>{KIND_LABEL[g.source.kind]} · {g.items.length} finding{g.items.length === 1 ? '' : 's'}</small></span>
                        <span className="src__bar" aria-hidden="true"><span style={{ ['--w' as string]: `${Math.max(2, (g.bytes / max) * 100)}%`, ['--s' as string]: `${g.bytes ? (g.safeBytes / g.bytes) * 100 : 0}%` }} /></span>
                        <span className="num src__size">{formatBytes(g.bytes)}</span>
                      </button>
                      {safe.length > 0 ? (
                        <button className="link src__pick" onClick={() => onSelectMany(safe.map((f) => f.id), !safeAll)}>
                          {safeAll ? 'Unselect safe' : `Select ${safe.length} safe`}
                        </button>
                      ) : <span className="src__pick src__pick--none">Nothing safe</span>}
                    </div>
                    {isOpen && (
                      <ul className="src__items">
                        {g.items.map((f) => (
                          <li key={f.id}>
                            <Check checked={selected.has(f.id)} onChange={(v) => onSelectMany([f.id], v)} label={`Select ${f.title}`} />
                            <button className="src__item" onClick={() => onInspect(f)} title="Open details">
                              <span>{f.title}</span>
                              <RiskTag risk={f.risk} />
                              <span className="num">{formatBytes(f.bytes)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
      <section className="uninstall" aria-labelledby="h-uninstall">
        <h2 id="h-uninstall">Uninstall an app</h2>
        <p className="help">Finds the app and the files it left in your Library. Nothing is removed here: the items go to Review, where you confirm first. The app itself is never preselected.</p>
        {installed.length === 0 ? (
          <p className="help">No apps found in Applications.</p>
        ) : (
          <ul className="src__items">
            {installed.map((a) => (
              <li key={a.path}>
                <span>{a.name}</span>
                {onUninstall && <GhostButton onClick={() => onUninstall(a)}>Find leftovers</GhostButton>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
