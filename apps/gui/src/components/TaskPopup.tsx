import { useEffect, useRef, useState } from 'react'
import { formatDuration, formatRemaining } from '../lib/format'
import { useNow } from '../lib/hooks'
import { DONE_HIDE_MS, type Task } from '../lib/tasks'
import { EtaSmoother } from '../lib/timing'

/**
 * A live card in the corner that follows the current action: the stage, a bar when progress is
 * measurable, the item being worked on, the time taken and left, and the last lines of output.
 * It never blocks the window, so you can keep working while it runs.
 */
export function TaskPopup({ task, onClose, onCancel }: { task: Task; onClose: () => void; onCancel?: () => void }) {
  const running = task.state === 'running'
  const [open, setOpen] = useState(false)
  const now = useNow(running)
  const elapsed = Math.max(0, (task.endedAt ?? now) - task.startedAt)

  // One smoother per task, so the countdown only goes down and restarts for each new action.
  const eta = useRef<{ id: number; s: EtaSmoother }>({ id: task.id, s: new EtaSmoother() })
  if (eta.current.id !== task.id) eta.current = { id: task.id, s: new EtaSmoother() }
  const left = running && task.fraction !== null ? eta.current.s.next(elapsed, Math.min(task.fraction, 0.99)) : null

  // A finished task leaves on its own after a moment; a failed one stays until closed.
  useEffect(() => {
    if (task.state !== 'done') return
    const timer = window.setTimeout(onClose, DONE_HIDE_MS)
    return () => window.clearTimeout(timer)
  }, [task.state, onClose])

  const pct = task.fraction === null ? null : Math.floor(task.fraction * 100)
  const role = task.state === 'failed' ? 'alert' : 'status'

  return (
    <aside className={`taskpop taskpop--${task.state}`} role={role} aria-label={`${task.title}: ${task.stage}`}>
      <header className="taskpop__head">
        <span className="taskpop__dot" aria-hidden="true" />
        <b className="taskpop__title">{task.title}</b>
        {running && task.cancellable && onCancel && (
          <button type="button" className="taskpop__stop" onClick={onCancel}>Stop</button>
        )}
        {!running && <button type="button" className="taskpop__close" aria-label="Close" onClick={onClose}>×</button>}
      </header>

      <div className="taskpop__main">
        <div className="taskpop__pct num" aria-hidden="true">
          {task.state === 'done' ? '✓' : pct === null ? <span className="taskpop__spin" /> : <>{pct}<small>%</small></>}
        </div>
        <div className="taskpop__body">
          <p className="taskpop__stage" aria-live="polite">{task.error ?? task.stage}</p>
          <div
            className={`taskpop__bar ${task.fraction === null && running ? 'is-indeterminate' : ''}`}
            role="progressbar"
            aria-label={task.title}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct ?? undefined}
          >
            <span style={task.fraction === null ? undefined : { ['--w' as string]: `${task.fraction * 100}%` }} />
          </div>
          <div className="taskpop__meta num">
            <span>{formatDuration(elapsed)} elapsed</span>
            {task.done !== undefined && task.total ? <span>{task.done} of {task.total}</span> : null}
            {running && <span>{formatRemaining(left)}</span>}
          </div>
          {task.item && <div className="taskpop__item" title={task.item}>{task.item}</div>}
        </div>
      </div>

      {task.log.length > 0 && (
        <>
          <button type="button" className="taskpop__more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide details' : 'Show details'}
          </button>
          <pre className={`taskpop__log${open ? ' taskpop__log--open' : ''}`} aria-label="Recent output">
            {(open ? task.log : task.log.slice(-3)).map((l, i) => <div key={`${i}-${l}`}>{l}</div>)}
          </pre>
        </>
      )}
    </aside>
  )
}
