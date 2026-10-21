import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { GhostButton, RiskTag, Segmented } from '../components/Primitives'
import { categoryLabel, formatBytes } from '../lib/format'
import { rank } from '../lib/search'
import type { Finding, RuleInfo } from '../types'

type Filter = 'all' | 'safe' | 'review' | 'manual'

interface Props {
  rules: RuleInfo[] | null
  findings: Finding[]
  /** A rule to open and highlight, set from the command palette or the inspector. */
  focus: string | null
  onFocused: () => void
  onGuide: () => void
}

const SAMPLE = `rules:
  - id: my-build-cache
    name: My build cache
    category: dev
    risk: safe
    paths: ["~/.cache/my-tool/*"]
    min_age_days: 14`

function scope(r: RuleInfo): string[] {
  const out: string[] = []
  if (r.min_age_days > 0) out.push(`untouched ${r.min_age_days} days`)
  if (r.min_size > 0) out.push(`at least ${formatBytes(r.min_size)}`)
  if (r.platform) out.push(r.platform === 'macos' ? 'Mac only' : r.platform)
  if (r.needs_full_disk_access) out.push('needs Full Disk Access')
  if (r.granularity === 'whole') out.push('one finding')
  return out
}

export function Rules({ rules, findings, focus, onFocused, onGuide }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [lit, setLit] = useState<string | null>(null)
  const box = useRef<HTMLUListElement>(null)

  const hits = useMemo(() => {
    const m = new Map<string, { count: number; bytes: number }>()
    for (const f of findings) {
      const h = m.get(f.rule) ?? { count: 0, bytes: 0 }
      h.count++
      h.bytes += f.bytes
      m.set(f.rule, h)
    }
    return m
  }, [findings])

  // Opening a rule from elsewhere clears the filters, expands it and scrolls to it.
  useEffect(() => {
    if (!focus || !rules) return
    setFilter('all')
    setQ('')
    setOpen((cur) => new Set(cur).add(focus))
    setLit(focus)
    onFocused()
    const t = window.setTimeout(() => box.current?.querySelector<HTMLElement>(`[data-rule="${CSS.escape(focus)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60)
    const off = window.setTimeout(() => setLit(null), 2600)
    return () => {
      window.clearTimeout(t)
      window.clearTimeout(off)
    }
    // onFocused only clears the request in the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, rules])

  const counts = useMemo(() => {
    const c = { all: rules?.length ?? 0, safe: 0, review: 0, manual: 0 }
    for (const r of rules ?? []) {
      if (r.risk === 'safe') c.safe++
      else if (r.risk === 'caution') c.review++
      else c.manual++
    }
    return c
  }, [rules])

  const shown = useMemo(() => {
    const byRisk = (rules ?? []).filter((r) => filter === 'all' || (filter === 'safe' ? r.risk === 'safe' : filter === 'review' ? r.risk === 'caution' : r.risk === 'manual'))
    return q.trim() ? rank(q, byRisk, (r) => `${r.name} ${r.id} ${categoryLabel(r.category)} ${r.paths.join(' ')}`) : byRisk
  }, [rules, filter, q])

  const toggle = (id: string) =>
    setOpen((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <section className="view rules" aria-labelledby="h-rules">
      <header className="view__head">
        <h1 id="h-rules">Rules</h1>
        {rules && rules.length > 0 && (
          <Segmented
            label="Risk"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `All ${counts.all}` },
              { value: 'safe', label: `Safe ${counts.safe}` },
              { value: 'review', label: `Review ${counts.review}` },
              { value: 'manual', label: `Manual ${counts.manual}` },
            ]}
          />
        )}
      </header>

      <p className="lede">Rules say where Whittle looks and how careful to be. They never delete anything on their own: each match becomes a finding that you review first. The safety layer sits above all of them.</p>

      {rules === null ? (
        <div className="empty"><p>Reading the rules…</p></div>
      ) : (
        <>
          <div className="pick pick--inline">
            <input aria-label="Filter rules" placeholder="Filter rules by name, folder or category" value={q} spellCheck={false} onChange={(e) => setQ(e.target.value)} />
            <GhostButton onClick={() => setOpen(open.size ? new Set() : new Set(shown.map((r) => r.id)))}>{open.size ? 'Collapse all' : 'Expand all'}</GhostButton>
          </div>

          {shown.length === 0 ? (
            <EmptyState title="No rule matches" text={q ? `Nothing in the rules mentions “${q}”.` : 'No rule has this risk level.'} progress={0.3} />
          ) : (
            <ul ref={box} className="rulelist">
              {shown.map((r, i) => {
                const isOpen = open.has(r.id)
                const hit = hits.get(r.id)
                return (
                  <li key={r.id} data-rule={r.id} className={`rule ${isOpen ? 'is-open' : ''} ${lit === r.id ? 'is-lit' : ''}`} style={{ ['--i' as string]: i }}>
                    <button className="rule__head" aria-expanded={isOpen} onClick={() => toggle(r.id)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                      <span className="rule__name"><b>{r.name}</b><code>{r.id}</code></span>
                      <span className="rule__cat">{categoryLabel(r.category)}</span>
                      <RiskTag risk={r.risk} />
                      <span className="rule__hit num">{hit ? <><b>{formatBytes(hit.bytes)}</b><small>{hit.count} in last scan</small></> : <small>no match</small>}</span>
                    </button>
                    {isOpen && (
                      <div className="rule__body">
                        {r.note && <p className="rule__note">{r.note}</p>}
                        <div className="rule__scope">
                          {scope(r).map((s) => <span key={s} className="tag">{s}</span>)}
                          <span className="tag">{r.regenerable ? 'rebuilt by itself' : 'not rebuilt'}</span>
                        </div>
                        <dl className="rule__lists">
                          <div>
                            <dt>Looks in</dt>
                            <dd>{r.paths.map((p) => <code key={p}>{p}</code>)}</dd>
                          </div>
                          {r.exclude.length > 0 && (
                            <div>
                              <dt>Skips</dt>
                              <dd>{r.exclude.map((p) => <code key={p}>{p}</code>)}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <aside className="yours">
            <div>
              <h2>Write your own</h2>
              <p>One YAML entry is a rule. Put it in <code>~/.config/whittle/rules/</code>; a rule with the same id replaces the built-in one. The safety layer still refuses system folders, <code>.git</code>, Keychains and iCloud, whatever a rule says.</p>
              <GhostButton onClick={onGuide}>Open the guide</GhostButton>
            </div>
            <pre aria-label="Example rule"><code>{SAMPLE}</code></pre>
          </aside>
        </>
      )}
    </section>
  )
}
