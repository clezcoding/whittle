import { useRef } from 'react'
import { formatBytes, formatDuration, formatPercent, formatRemaining } from '../lib/format'
import { useNow } from '../lib/hooks'
import { moduleLabel } from '../lib/modules'
import { EtaSmoother, overallFraction, runElapsed } from '../lib/timing'
import type { ApplyRun, ScanRun } from '../types'

/** A countdown that only goes down; restarts when `key` changes (a new run). */
function useEta(key: number, running: boolean, elapsed: number, fraction: number): number | null {
  const ref = useRef<{ key: number; eta: EtaSmoother }>({ key, eta: new EtaSmoother() })
  if (ref.current.key !== key) ref.current = { key, eta: new EtaSmoother() }
  return running ? ref.current.eta.next(elapsed, fraction) : null
}

/** Real scan progress: percent, seconds elapsed, time left, and each module's own bar. */
export function ScanProgress({ run }: { run: ScanRun }) {
  // `endedAt` is set the instant the last module reports it is finished. From then on the clock
  // is frozen; what remains is only handing the results over to the interface.
  const running = run.endedAt === null
  const now = useNow(running)
  const elapsed = runElapsed(run, now)
  const overall = running ? Math.min(overallFraction(run), 0.99) : 1
  const left = useEta(run.startedAt, running, elapsed, overall)

  return (
    <section className="prog" aria-label="Scan progress">
      <div className="prog__top">
        <div className="prog__pct num" aria-hidden="true">{Math.floor(overall * 100)}<small>%</small></div>
        <div className="prog__times">
          <span className="num">{formatDuration(elapsed)}</span>
          <small>{running ? 'elapsed' : 'total'}</small>
          <span className="prog__eta">{running ? formatRemaining(left) : 'collecting results…'}</span>
        </div>
        <div className="prog__bar" role="progressbar" aria-label="Scan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(overall * 100)}>
          <span style={{ ['--w' as string]: `${overall * 100}%` }} />
        </div>
      </div>
      <ul className="prog__mods">
        {run.order.map((id, i) => {
          const m = run.mods[id]
          const f = m.state === 'done' ? 1 : m.fraction
          return (
            <li key={id} className={`prog__mod is-${m.state}`} style={{ ['--i' as string]: i }}>
              <span className="prog__dot" aria-hidden="true" />
              <b>{moduleLabel(id)}</b>
              <span className="prog__phase">
                {m.state === 'wait' && 'Waiting'}
                {m.state === 'run' && (m.phase ? `${m.phase}${m.total > 1 ? ` · ${m.done.toLocaleString()} of ${m.total.toLocaleString()}` : ''}` : 'Starting')}
                {m.state === 'done' && `${m.findings} found · ${formatBytes(m.bytes)}`}
              </span>
              <span className="num prog__p">{formatPercent(f)}</span>
              <i className="prog__mbar" style={{ ['--w' as string]: `${f * 100}%` }} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Real progress of cleaning or moving files: percent, bytes, seconds, current item. */
export function ApplyBar({ run, label }: { run: ApplyRun; label: string }) {
  const now = useNow(true)
  const elapsed = Math.max(0, now - run.startedAt)
  const left = useEta(run.startedAt, true, elapsed, Math.min(run.fraction, 0.99))
  return (
    <div className="runbar" role="status" aria-live="off">
      <div className="runbar__num num" aria-hidden="true">{Math.floor(run.fraction * 100)}<small>%</small></div>
      <div className="runbar__body">
        <div className="runbar__bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(run.fraction * 100)}>
          <span style={{ ['--w' as string]: `${run.fraction * 100}%` }} />
        </div>
        <div className="runbar__meta">
          <span>{label} · {run.done} of {run.total}{run.bytes_total > 0 ? ` · ${formatBytes(run.bytes_done)} of ${formatBytes(run.bytes_total)}` : ''}</span>
          <span className="num">{formatDuration(elapsed)}{left !== null ? ` · ${formatRemaining(left)}` : ''}</span>
        </div>
        {run.title && <div className="runbar__item" title={run.title}>{run.title}</div>}
      </div>
    </div>
  )
}
