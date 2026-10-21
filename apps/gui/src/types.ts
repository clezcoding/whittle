export type Risk = 'safe' | 'caution' | 'manual'
export type ModuleId = 'caches' | 'projects' | 'orphans' | 'dupes'
export type Disposal = 'quarantine' | 'trash' | 'delete'

export interface Finding {
  id: string
  module: string
  rule: string
  category: string
  title: string
  path: string
  bytes: number
  risk: Risk
  regenerable: boolean
  note: string | null
  related: string | null
  confidence: number
  modified: number | null
}

export interface JournalEntry {
  run: string
  ts: number
  op: 'quarantine' | 'trash' | 'delete' | 'move' | 'restore'
  from: string
  to: string | null
  bytes: number
  title: string
}

export interface Failure {
  path: string
  title: string
  reason: string
}

export interface ApplyReport {
  run: string
  dry_run: boolean
  applied: JournalEntry[]
  failed: Failure[]
  bytes_handled: number
  bytes_freed: number
}

export interface RunSummary {
  run: string
  ts: number
  items: number
  bytes: number
  restored: number
  undoable: number
}

export interface UndoReport {
  run: string
  restored: number
  skipped: Failure[]
}

export interface PurgeReport {
  runs_removed: number
  bytes_freed: number
}

export interface TidyEntry {
  from: string
  to: string
  bytes: number
  reason: string
}

export type ScanProgress =
  | { event: 'started'; module: ModuleId }
  | { event: 'step'; module: ModuleId; phase: string; fraction: number; done: number; total: number }
  | { event: 'finished'; module: ModuleId; findings: number; bytes: number }

/** Measured progress of cleaning or moving, from the backend. */
export interface ApplyProgress {
  done: number
  total: number
  bytes_done: number
  bytes_total: number
  fraction: number
  title: string
}

export interface ModuleRun {
  state: 'wait' | 'run' | 'done'
  fraction: number
  phase: string
  done: number
  total: number
  findings: number
  bytes: number
  /** When the module started / finished (ms since epoch), for measuring real durations. */
  t0: number | null
  t1: number | null
}

/** Everything the progress panel needs to show a scan, running or finished. */
export interface ScanRun {
  startedAt: number
  endedAt: number | null
  order: ModuleId[]
  mods: Record<ModuleId, ModuleRun>
  /** Relative cost of each module, so a quick module does not count as much as a slow one. */
  weights: Record<ModuleId, number>
}

export interface ApplyRun extends ApplyProgress {
  startedAt: number
}

export interface AppInfo {
  home: string
  version: string
  demo: boolean
  os: string
  state_dir: string
  config_dir: string
  repo: string
}

export type Appearance = 'system' | 'dark' | 'light'
export type Motion = 'system' | 'full' | 'reduced'

/** Mirrors `whittle_core::Settings`. The backend validates everything it receives. */
export interface Settings {
  onboarded: boolean
  default_disposal: Disposal
  quarantine_days: number
  auto_purge: boolean
  confirm_before_clean: boolean
  default_modules: ModuleId[]
  exclusions: string[]
  appearance: Appearance
  motion: Motion
}

export interface Permissions {
  /** true granted, false denied, null unknown (not a Mac, or nothing to test with). */
  full_disk_access: boolean | null
  effect: string
}

/** One scan rule, as `whittle_core::rules::Rule` serialises it. Shown on the Rules page. */
export interface RuleInfo {
  id: string
  name: string
  category: string
  risk: Risk
  regenerable: boolean
  note: string | null
  paths: string[]
  granularity: 'each' | 'whole'
  exclude: string[]
  min_age_days: number
  min_size: number
  platform: string | null
  needs_full_disk_access: boolean
}

/** Places the app may open. The addresses live in the Rust backend, not here. */
export type External = 'full-disk-access' | 'repository' | 'releases' | 'issues' | 'discussions' | 'security'

