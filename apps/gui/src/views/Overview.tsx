import { useMemo } from 'react'
import { Curl } from '../components/Curl'
import { ScanProgress } from '../components/Progress'
import { MODULES } from '../lib/modules'
import { CutButton, GhostButton } from '../components/Primitives'
import { categoryLabel, formatDuration, splitBytes } from '../lib/format'
import { useCountUp } from '../lib/hooks'
import { CATEGORY_HELP, MODULE_HELP } from '../lib/explain'
import type { Finding, ModuleId, ScanRun } from '../types'

export type Phase = 'idle' | 'scanning' | 'done'

interface Props {
  phase: Phase
  run: ScanRun | null
  progress: number
  tally: number
  scanningModule: ModuleId | null
  findings: Finding[]
  modules: ModuleId[]
  onToggleModule: (m: ModuleId) => void
  onScan: () => void
  onReview: () => void
}

export function Overview({ phase, run, progress, tally, scanningModule, findings, modules, onToggleModule, onScan, onReview }: Props) {
  // Manual findings are guesses: listed in Review, but not counted as "can be removed".
  const total = findings.filter((f) => f.risk !== 'manual').reduce((s, f) => s + f.bytes, 0)
  const safe = findings.filter((f) => f.risk === 'safe').reduce((s, f) => s + f.bytes, 0)
  const shown = useCountUp(phase === 'scanning' ? tally : total)
  const { value, unit } = splitBytes(shown)

  const cats = useMemo(() => {
    const map = new Map<string, { bytes: number; safe: number; review: number }>()
    for (const f of findings) {
      const c = map.get(f.category) ?? { bytes: 0, safe: 0, review: 0 }
      c.bytes += f.bytes
      if (f.risk === 'safe') c.safe++
      else c.review++
      map.set(f.category, c)
    }
    return [...map.entries()].sort((a, b) => b[1].bytes - a[1].bytes)
  }, [findings])
  const max = cats[0]?.[1].bytes ?? 1

  return (
    <section className="view overview" aria-labelledby="h-overview">
      <header className="view__head">
        <h1 id="h-overview">Overview</h1>
        <div className="chips" role="group" aria-label="What to scan">
          {MODULES.map((m) => (
            <button key={m.id} className={`chip ${modules.includes(m.id) ? 'is-on' : ''}`} aria-pressed={modules.includes(m.id)} title={m.hint} disabled={phase === 'scanning'} onClick={() => onToggleModule(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </header>

      <div className="hero">
        <div className="hero__text">
          {phase === 'idle' ? (
            <>
              <p className="hero__headline"><span className="line"><span>Find out</span></span><span className="line"><span>what can go.</span></span></p>
              <p className="hero__sub">Whittle looks for caches, app leftovers and stale build folders. Nothing is removed until you say so.</p>
              <ul className="scope" aria-label="What a scan looks at">
                {MODULES.filter((m) => modules.includes(m.id)).map((m) => (
                  <li key={m.id}><b>{m.label}</b> {MODULE_HELP[m.id]}</li>
                ))}
              </ul>
              <div className="hero__actions">
                <CutButton onClick={onScan}>Scan this Mac</CutButton>
              </div>
            </>
          ) : (
            <>
              <div className="hero__num" role="img" aria-label={`${value} ${unit}`}>
                <span className="hero__value">{value}</span>
                <span className="hero__unit">{unit}</span>
              </div>
              <p className="hero__sub" aria-live="polite">
                {phase === 'scanning' ? (
                  <>Scanning {scanningModule ? MODULES.find((m) => m.id === scanningModule)?.label.toLowerCase() : ''}…</>
                ) : findings.length === 0 ? (
                  <>Nothing to remove. Your Mac is in good shape.</>
                ) : (
                  <>
                    can be removed. <b className="shaving">{splitBytes(safe).value} {splitBytes(safe).unit}</b> of it is safe to clear right away.
                    {run?.endedAt && <> Scanned in <b className="num">{formatDuration(run.endedAt - run.startedAt)}</b>.</>}
                  </>
                )}
              </p>
              <div className="hero__actions">
                {phase === 'done' && findings.length > 0 && <CutButton onClick={onReview}>Review &amp; clean</CutButton>}
                {phase === 'done' && <GhostButton onClick={onScan}>Scan again</GhostButton>}
              </div>
            </>
          )}
        </div>
        <Curl key={phase} className="hero__curl" progress={phase === 'idle' ? 1 : phase === 'scanning' ? Math.max(0.06, progress) : 1} idle={phase !== 'scanning'} />
      </div>

      {phase === 'scanning' && run && <ScanProgress run={run} />}

      {phase === 'done' && cats.length > 0 && (
        <table className="cats">
          <caption className="sr">Reclaimable space by category</caption>
          <thead className="sr">
            <tr><th>Category</th><th>Share</th><th>Size</th><th>Items</th></tr>
          </thead>
          <tbody>
            {cats.map(([cat, c], idx) => {
              const s = splitBytes(c.bytes)
              return (
                <tr key={cat} onClick={onReview} style={{ ['--i' as string]: idx }}>
                  <th scope="row">{categoryLabel(cat)}{CATEGORY_HELP[cat] && <small>{CATEGORY_HELP[cat]}</small>}</th>
                  <td className="cats__bar"><span style={{ ['--w' as string]: `${Math.max(2, (c.bytes / max) * 100)}%` }} /></td>
                  <td className="num">{s.value}<small>{s.unit}</small></td>
                  <td className="cats__tag">{c.safe > 0 && <span>{c.safe} safe</span>}{c.review > 0 && <span>{c.review} to review</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
