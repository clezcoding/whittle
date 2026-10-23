// The model behind the live progress popup. Every long action becomes one task: it has a title,
// the stage it is in now, a fraction when we can measure one, and the last lines it printed.
// Pure functions, so the rules here can be tested without rendering anything.

export type TaskState = 'running' | 'done' | 'failed'

export interface Task {
  /** The action can be stopped early; the popup then shows a Stop button. */
  cancellable?: boolean
  id: number
  title: string
  stage: string
  /** 0..1 when the work can be measured, null when only "still working" is known. */
  fraction: number | null
  done?: number
  total?: number
  /** The item being worked on right now, for example a file or a project. */
  item?: string
  /** The last lines of output, newest last. */
  log: string[]
  startedAt: number
  endedAt?: number
  state: TaskState
  error?: string
  /** Popups appear only after the task has run for a moment, so quick actions do not flicker. */
  shown: boolean
}

export const SHOW_AFTER_MS = 350
export const DONE_HIDE_MS = 2600
export const LOG_KEEP = 6

export function startTask(id: number, title: string, stage: string, now = Date.now()): Task {
  return { id, title, stage, fraction: null, log: [], startedAt: now, state: 'running', shown: false }
}

export function updateTask(task: Task, patch: Partial<Pick<Task, 'stage' | 'fraction' | 'done' | 'total' | 'item'>>): Task {
  const fraction =
    patch.fraction === undefined ? task.fraction : patch.fraction === null ? null : clamp(patch.fraction)
  return { ...task, ...patch, fraction }
}

export function appendLog(task: Task, line: string): Task {
  const clean = line.trim()
  if (!clean) return task
  return { ...task, log: [...task.log, clean].slice(-LOG_KEEP) }
}

export function finishTask(task: Task, state: 'done' | 'failed', error?: string, now = Date.now()): Task {
  return {
    ...task,
    state,
    error: state === 'failed' ? error ?? 'Something went wrong.' : undefined,
    fraction: state === 'done' ? 1 : task.fraction,
    endedAt: now,
    stage: state === 'done' ? 'Done' : 'Stopped',
  }
}

export function clamp(f: number): number {
  return Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : 0
}
