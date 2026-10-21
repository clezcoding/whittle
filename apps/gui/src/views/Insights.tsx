import { useMemo, useState } from 'react'
import { ConfidenceMeter, Columns, Donut, HBar, RiskBar, Stat, tone, Treemap } from '../components/Charts'
import { EmptyState } from '../components/EmptyState'
import { Panel } from '../components/Panel'
import { CutButton, GhostButton } from '../components/Primitives'
import { byAge, byCategory, byRisk, reclaimable, topItems } from '../lib/insights'
import { CATEGORY_HELP } from '../lib/explain'
import { formatBytes, shortPath, splitBytes } from '../lib/format'
import { useCountUp } from '../lib/hooks'
import type { Finding, RunSummary } from '../types'

interface Props {
  findings: Finding[]
  runs: RunSummary[]
  home: string
  onInspect: (f: Finding) => void
  onScan: () => void
  onReport: () => void
}

const shortDate = (ts: number) => new Date(ts * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export function Insights({ findings, runs, home, onInspect, onScan, onReport }: Props) {
  const [active, setActive] = useState<string | null>(null)
  const nowSec = Math.floor(Date.now() / 1000)
  const cats = useMemo(() => byCategory(findings), [findings])
  const risk = useMemo(() => byRisk(findings), [findings])
  const age = useMemo(() => byAge(findings, nowSec), [findings, nowSec])
  const top = useMemo(() => topItems(findings, 8), [findings])
  const rec = useMemo(() => reclaimable(findings), [findings])
  const total = findings.reduce((s, f) => s + f.bytes, 0)
  const totalShown = splitBytes(useCountUp(total, 900))
  const sure = useMemo(() => {
    const scored = findings.filter((f) => f.module === 'orphans')
    return scored.length ? scored.reduce((s, f) => s + f.confidence, 0) / scored.length : null
  }, [findings])
  const history = useMemo(() => [...runs].filter((r) => r.bytes > 0).reverse().slice(-8), [runs])

  return (
    <section className="view insights" aria-labelledby="h-insights">
      <header className="view__head">
        <h1 id="h-insights">Insights</h1>
        {findings.length > 0 && <GhostButton onClick={onReport}>Copy report</GhostButton>}
      </header>

      {findings.length === 0 ? (
        <EmptyState title="Nothing to look at yet" text="Run a scan and this page turns the result into charts: where the space sits, what is safe, how old it is.">
          <CutButton onClick={onScan}>Scan now</CutButton>
        </EmptyState>
      ) : (
        <>
          <p className="lede">The last scan from every angle. Nothing here changes your files; click any bar or tile to open the details.</p>

          <div className="stats">
            <Stat accent label="Can be removed" bytes={rec.withReview} note="Safe and review items" />
            <Stat label="Pre-selected" bytes={rec.safe} note="Safe, rebuilt by themselves" />
            <Stat label="Rebuilt automatically" count={Math.round(rec.share * 100)} suffix="%" note="of what can be removed" />
            <Stat label="Findings" count={findings.length} note={`${cats.length} categories`} />
          </div>

          <div className="grid2">
            <Panel title="By category" note="Hover a segment or a row" i={0}>
              <div className="catsplit">
                <Donut slices={cats.map((c) => ({ key: c.key, label: c.label, value: c.bytes }))} active={active} onActive={setActive}>
                  <b className="num">{totalShown.value}<small>{totalShown.unit}</small></b>
                  <span>{active ? cats.find((c) => c.key === active)?.label : 'in total'}</span>
                </Donut>
                <ul className="legend">
                  {cats.map((c, i) => (
                    <li key={c.key} className={active === c.key ? 'is-on' : ''} onMouseEnter={() => setActive(c.key)} onMouseLeave={() => setActive(null)} title={CATEGORY_HELP[c.key]}>
                      <i style={{ background: tone(i) }} aria-hidden="true" />
                      <span>{c.label}</span>
                      <b className="num">{formatBytes(c.bytes)}</b>
                      <small>{Math.round((c.bytes / total) * 100)}%</small>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>

            <div className="stack">
              <Panel title="By risk" note="A shape and a word, never colour alone" i={1}>
                <RiskBar risk={risk} />
              </Panel>
              <Panel title="Age" note="When it was last changed" i={2}>
                <Columns label="Space by age" data={age.map((a) => ({ key: a.key, label: a.label, value: a.bytes, hint: `${a.count} item${a.count === 1 ? '' : 's'}` }))} />
              </Panel>
            </div>
          </div>

          <Panel title="Where the space sits" note="Every finding as a tile. Bigger tile, more space." i={3}>
            <Treemap findings={findings} onPick={onInspect} />
          </Panel>

          <div className="grid2">
            <Panel title="Largest items" i={4}>
              <div className="hbars">
                {top.map((f, i) => (
                  <HBar key={f.id} i={i} label={f.title} sub={shortPath(f.path, home)} value={f.bytes} max={top[0].bytes} onClick={() => onInspect(f)} />
                ))}
              </div>
            </Panel>

            <div className="stack">
              {sure !== null && (
                <Panel title="Leftover matching" note="How sure Whittle is, on average" i={5}>
                  <div className="sure">
                    <ConfidenceMeter value={sure} />
                    <p>App leftovers are matched by name against what is installed, so they are never pre-selected. The lower the certainty, the more you should look inside first.</p>
                  </div>
                </Panel>
              )}
              {history.length > 0 && (
                <Panel title="Cleaned so far" note="Space handled per run" i={6}>
                  <Columns label="Space handled per run" data={history.map((r) => ({ key: r.run, label: shortDate(r.ts), value: r.bytes, hint: `${r.items} items` }))} />
                </Panel>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
