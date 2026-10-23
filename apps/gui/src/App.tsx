import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { About } from './components/About'
import { CommandPalette, type Command } from './components/CommandPalette'
import { Inspector } from './components/Inspector'
import { Onboarding } from './components/Onboarding'
import { ReportDialog } from './components/ReportDialog'
import { ResultDialog } from './components/ResultDialog'
import { cleanResult, purgeResult, tidyResult, undoResult, type ResultView } from './lib/results'
import { Shortcuts } from './components/Shortcuts'
import { Sidebar, VIEW_ORDER, type View } from './components/Sidebar'
import { Migrate } from './views/Migrate'
import { api } from './lib/api'
import { categoryLabel, formatBytes } from './lib/format'
import { buildReport } from './lib/insights'
import { errorText, isExcluded } from './lib/paths'
import { moduleWeights, overallFraction, rememberDurations } from './lib/timing'
import { appendLog, finishTask, SHOW_AFTER_MS, startTask, updateTask, type Task } from './lib/tasks'
import { TaskPopup } from './components/TaskPopup'
import type { ApplyProgress, ApplyRun, AppInfo, Disposal, External, Finding, ModuleId, ModuleRun, Permissions, RuleInfo, RunSummary, ScanProgress, ScanRun, Settings as SettingsT } from './types'
import { Apps } from './views/Apps'
import { History } from './views/History'
import { Insights } from './views/Insights'
import { Overview, type Phase } from './views/Overview'
import { Quarantine } from './views/Quarantine'
import { Review } from './views/Review'
import { Rules } from './views/Rules'
import { Settings, type SaveState } from './views/Settings'
import { Tidy } from './views/Tidy'

const DEFAULT_MODULES: ModuleId[] = ['caches', 'projects', 'orphans']

const FALLBACK_SETTINGS: SettingsT = {
  onboarded: true,
  default_disposal: 'quarantine',
  quarantine_days: 30,
  auto_purge: true,
  confirm_before_clean: true,
  default_modules: DEFAULT_MODULES,
  exclusions: [],
  migrate_roots: [],
  appearance: 'system',
  motion: 'system',
}

/** Maps a progress event to the popup's fields. */
function progressPatch(p: ApplyProgress, verb: string) {
  return { fraction: p.fraction, done: p.done, total: p.total, item: p.title, stage: p.title ? `${verb} ${p.title}` : `${verb}…` }
}

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1)

export interface TaskHandle {
  update(patch: Partial<Pick<Task, 'stage' | 'fraction' | 'done' | 'total' | 'item'>>): void
  log(line: string): void
}

/** The scan shows its own progress on the overview, so its popup only appears on other pages. */
const SCAN_TITLE = 'Scanning your Mac'

export function App() {
  const [info, setInfo] = useState<AppInfo>({ home: '', version: '', demo: false, os: '', state_dir: '', config_dir: '', repo: '' })
  const [settings, setSettings] = useState<SettingsT | null>(null)
  const [permissions, setPermissions] = useState<Permissions | null>(null)
  const [save, setSave] = useState<SaveState>('idle')
  const [dialog, setDialog] = useState<'about' | 'keys' | 'report' | null>(null)
  const [palette, setPalette] = useState(false)
  const [inspectId, setInspectId] = useState<string | null>(null)
  const [rules, setRules] = useState<RuleInfo[] | null>(null)
  const [ruleFocus, setRuleFocus] = useState<string | null>(null)
  const [tour, setTour] = useState(false)
  const [view, setView] = useState<View>('overview')
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [tally, setTally] = useState(0)
  const [scanning, setScanning] = useState<ModuleId | null>(null)
  const [modules, setModules] = useState<ModuleId[]>(DEFAULT_MODULES)
  const [findings, setFindings] = useState<Finding[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  /** Bumped to ask Review to open its clean preview. A counter, so every request fires once. */
  const [confirmRequest, setConfirmRequest] = useState(0)
  const [peeling, setPeeling] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; undo?: () => void } | null>(null)
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [quarantine, setQuarantine] = useState(0)
  const [scanRun, setScanRun] = useState<ScanRun | null>(null)
  const [applyRun, setApplyRun] = useState<ApplyRun | null>(null)
  /** The summary dialog shown when an action finishes. */
  const [result, setResult] = useState<ResultView | null>(null)
  const scanId = useRef(0)
  const taskSeq = useRef(0)
  const stopRef = useRef<(() => void) | null>(null)
  const stopTask = useCallback(() => stopRef.current?.(), [])
  const [task, setTask] = useState<Task | null>(null)

  // Stable on purpose: TaskPopup restarts its auto-close timer whenever this changes. It only clears
  // a task that has finished, so a stale timer never hides a newer task that is still running.
  const closeTask = useCallback(() => setTask((t) => (t && t.state !== 'running' ? null : t)), [])

  /**
   * Runs one action and shows the live popup for it. Quick actions finish before the popup
   * appears (SHOW_AFTER_MS), so the window is not cluttered with flashes.
   */
  const runTask = useCallback(
    async <T,>(
      title: string,
      stage: string,
      fn: (h: TaskHandle) => Promise<T>,
      opts?: { cancel?: () => void },
    ): Promise<T> => {
      const id = ++taskSeq.current
      const edit = (f: (t: Task) => Task) => setTask((t) => (t && t.id === id ? f(t) : t))
      setTask(startTask(id, title, stage))
      if (opts?.cancel) {
        const cancel = opts.cancel
        stopRef.current = () => {
          edit((t) => ({ ...t, stage: 'Stopping after the current step…' }))
          cancel()
        }
        edit((t) => ({ ...t, cancellable: true }))
      }
      const reveal = window.setTimeout(() => edit((t) => ({ ...t, shown: true })), SHOW_AFTER_MS)
      const handle: TaskHandle = {
        update: (patch) => edit((t) => updateTask(t, patch)),
        log: (line) => edit((t) => appendLog(t, line)),
      }
      try {
        const out = await fn(handle)
        window.clearTimeout(reveal)
        stopRef.current = null
        edit((t) => finishTask(t, 'done'))
        return out
      } catch (e) {
        window.clearTimeout(reveal)
        stopRef.current = null
        // A failure is always shown, even when it was quick, so it can never disappear unseen.
        edit((t) => ({ ...finishTask(t, 'failed', errorText(e)), shown: true }))
        throw e
      }
    },
    [],
  )
  const latest = useRef<SettingsT | null>(null)
  const savedTimer = useRef(0)
  const prefs = settings ?? FALLBACK_SETTINGS

  const refreshState = useCallback(async () => {
    const [r, q] = await Promise.all([api.history(), api.quarantineSize()])
    setRuns(r)
    setQuarantine(q)
  }, [])

  const recheck = useCallback(() => {
    void api.permissions().then(setPermissions).catch(() => setPermissions(null))
  }, [])

  useEffect(() => {
    void api.info().then(setInfo).then(refreshState)
    void api.getSettings().then((st) => {
      latest.current = st
      setSettings(st)
      setModules(st.default_modules)
    }).catch((e) => {
      latest.current = FALLBACK_SETTINGS
      setSettings(FALLBACK_SETTINGS)
      setNotice({ text: `Could not read your settings, using the defaults. ${errorText(e)}` })
    })
    void api.rules().then(setRules).catch(() => setRules([]))
    recheck()
  }, [refreshState, recheck])

  // Theme and motion are attributes on <html>, so CSS and the animation hooks agree.
  useEffect(() => {
    const root = document.documentElement
    if (prefs.appearance === 'system') delete root.dataset.theme
    else root.dataset.theme = prefs.appearance
    if (prefs.motion === 'system') delete root.dataset.motion
    else root.dataset.motion = prefs.motion
  }, [prefs.appearance, prefs.motion])

  // Notices without an action fade on their own.
  useEffect(() => {
    if (!notice || notice.undo) return
    const t = window.setTimeout(() => setNotice(null), 9000)
    return () => window.clearTimeout(t)
  }, [notice])

  const updateSettings = useCallback(async (patch: Partial<SettingsT>) => {
    const before = latest.current
    if (!before) return
    const next = { ...before, ...patch }
    latest.current = next
    setSettings(next)
    if (patch.default_modules) setModules(patch.default_modules)
    setSave('saving')
    window.clearTimeout(savedTimer.current)
    try {
      const saved = await api.saveSettings(next)
      latest.current = saved
      setSettings(saved)
      setSave('saved')
      savedTimer.current = window.setTimeout(() => setSave('idle'), 1800)
    } catch (e) {
      latest.current = before
      setSettings(before)
      setSave('error')
      setNotice({ text: `Could not save: ${errorText(e)}` })
    }
  }, [])

  const adoptSettings = useCallback((st: SettingsT) => {
    latest.current = st
    setSettings(st)
  }, [])

  const dropExcluded = useCallback((st: SettingsT) => {
    setFindings((fs) => fs.filter((f) => !isExcluded(f.path, st.exclusions, info.home)))
  }, [info.home])

  const addExclusion = useCallback(async (path: string): Promise<string | null> => {
    try {
      const st = await api.addExclusion(path)
      adoptSettings(st)
      dropExcluded(st)
      return null
    } catch (e) {
      return errorText(e)
    }
  }, [adoptSettings, dropExcluded])

  const removeExclusion = useCallback(async (path: string) => {
    try {
      adoptSettings(await api.removeExclusion(path))
      setNotice({ text: 'No longer excluded. It can show up in the next scan.' })
    } catch (e) {
      setNotice({ text: `Could not change the list: ${errorText(e)}` })
    }
  }, [adoptSettings])

  const ignoreFinding = useCallback(async (id: string) => {
    try {
      const st = await api.ignoreFinding(id)
      adoptSettings(st)
      dropExcluded(st)
      setSelected((sel) => new Set([...sel].filter((x) => x !== id)))
      setNotice({ text: 'Added to “Never touch” in Settings. Whittle will leave it alone.' })
    } catch (e) {
      setNotice({ text: errorText(e) })
    }
  }, [adoptSettings, dropExcluded])

  const openExternal = useCallback((t: External) => {
    void api.openExternal(t).catch((e) => setNotice({ text: `Could not open it: ${errorText(e)}` }))
  }, [])

  const scan = useCallback(async () => {
    const id = ++scanId.current
    setPhase('scanning')
    setView('overview')
    setProgress(0)
    setTally(0)
    setNotice(null)
    const blank = (): ModuleRun => ({ state: 'wait', fraction: 0, phase: '', done: 0, total: 0, findings: 0, bytes: 0, t0: null, t1: null })
    const order = [...modules]
    const run: ScanRun = {
      startedAt: Date.now(),
      endedAt: null,
      order,
      mods: Object.fromEntries(order.map((m) => [m, blank()])) as Record<ModuleId, ModuleRun>,
      weights: moduleWeights(order),
    }
    setScanRun({ ...run })
    const onProgress = (e: ScanProgress) => {
      if (id !== scanId.current) return
      const m = run.mods[e.module]
      const stamp = Date.now()
      if (e.event === 'started') {
        m.state = 'run'
        m.t0 = stamp
        setScanning(e.module)
      } else if (e.event === 'step') {
        m.state = 'run'
        m.fraction = Math.max(m.fraction, e.fraction)
        m.phase = e.phase
        m.done = e.done
        m.total = e.total
      } else {
        m.state = 'done'
        m.fraction = 1
        m.findings = e.findings
        m.bytes = e.bytes
        m.t1 = stamp
        m.t0 ??= stamp
        // The scan itself is over the moment the last module finishes. Freeze the clock here, so
        // the live counter, the total and "Scanned in" are one and the same number.
        if (run.endedAt === null && order.every((k) => run.mods[k].state === 'done')) {
          run.endedAt = stamp
          rememberDurations(run)
        }
      }
      const next: ScanRun = { ...run, mods: { ...run.mods } }
      setScanRun(next)
      setProgress(overallFraction(next))
      setTally(order.reduce((sum, k) => sum + (run.mods[k].state === 'done' ? run.mods[k].bytes : 0), 0))
    }
    try {
      let stopped = false
      const found = await runTask(
        SCAN_TITLE,
        'Starting',
        (h) =>
          api.scan(modules, (e) => {
            onProgress(e)
            h.update({
              stage: e.event === 'step' ? e.phase : `${e.event === 'started' ? 'Scanning' : 'Finished'} ${categoryLabel(e.module)}`,
              fraction: overallFraction(run),
            })
          }),
        { cancel: () => { stopped = true; void api.cancelScan() } },
      )
      if (stopped) setNotice({ text: 'Scan stopped. The findings of the finished modules are shown.' })
      if (id !== scanId.current) return
      setFindings(found)
      setSelected(new Set(found.filter((f) => f.risk === 'safe').map((f) => f.id)))
      // Normally already frozen by the last `finished` event; this is only the fallback.
      setScanRun((r) => (r && r.endedAt === null ? { ...r, endedAt: Date.now() } : r))
      setProgress(1)
      setPhase('done')
    } catch (e) {
      setNotice({ text: `Scan failed: ${String(e)}` })
      setPhase('idle')
    } finally {
      setScanning(null)
    }
  }, [modules, runTask])

  const clean = useCallback(
    async (disposal: Disposal) => {
      const ids = findings.filter((f) => selected.has(f.id)).map((f) => f.id)
      if (!ids.length) return
      setBusy(true)
      try {
        const startedAt = Date.now()
        setApplyRun({ done: 0, total: ids.length, bytes_done: 0, bytes_total: 0, fraction: 0, title: '', startedAt })
        const verb = disposal === 'delete' ? 'Deleting' : disposal === 'trash' ? 'Moving to Trash' : 'Quarantining'
        const report = await runTask(verb, `${ids.length} item(s)`, (h) =>
          api.apply(ids, disposal, (p) => {
            setApplyRun({ ...p, startedAt })
            h.update(progressPatch(p, verb))
          }),
        )
        const gone = new Set(findings.filter((f) => report.applied.some((a) => a.from === f.path)).map((f) => f.id))
        setPeeling(gone)
        window.setTimeout(() => {
          setFindings((fs) => fs.filter((f) => !gone.has(f.id)))
          setSelected((s) => new Set([...s].filter((id) => !gone.has(id))))
          setPeeling(new Set())
        }, 560)
        const text =
          disposal === 'delete'
            ? `Deleted ${gone.size} item(s) and freed ${formatBytes(report.bytes_freed)}.`
            : disposal === 'trash'
              ? `Moved ${gone.size} item(s), ${formatBytes(report.bytes_handled)}, to the Trash.`
              : `Quarantined ${gone.size} item(s), ${formatBytes(report.bytes_handled)}. Kept for ${prefs.quarantine_days} days.`
        const failed = report.failed.length ? ` ${report.failed.length} could not be handled.` : ''
        setResult(
          cleanResult({
            report,
            disposal,
            quarantineDays: prefs.quarantine_days,
            onUndo: disposal === 'quarantine'
              ? async () => {
                  const undone = await runTask('Undoing', 'Restoring the files', () => api.undo(report.run))
                  await refreshState()
                  await scan()
                  setResult(undoResult(undone))
                }
              : undefined,
          }),
        )
        setNotice({
          text: text + failed,
          undo: disposal === 'quarantine' ? async () => { await undoRun(report.run); await scan() } : undefined,
        })
        await refreshState()
      } catch (e) {
        setNotice({ text: `Could not clean: ${String(e)}` })
      } finally {
        setBusy(false)
        setApplyRun(null)
      }
    },
    [findings, selected, refreshState, scan, prefs.quarantine_days, runTask],
  )

  /** Undo a run from History or Quarantine. A failure is shown as a notice, never swallowed. */
  const undoRun = useCallback(
    async (run?: string) => {
      try {
        const undone = await runTask('Undoing', 'Restoring the files', () => api.undo(run))
        await refreshState()
        setResult(undoResult(undone))
      } catch (e) {
        setNotice({ text: `Could not undo: ${errorText(e)}` })
      }
    },
    [refreshState],
  )

  const purgeAll = useCallback(async () => {
    try {
      const purged = await runTask('Freeing the quarantine', 'Deleting old files', () => api.purge(0))
      await refreshState()
      setResult(purgeResult(purged))
    } catch (e) {
      setNotice({ text: `Could not free the quarantine: ${errorText(e)}` })
    }
  }, [refreshState, runTask])

  const selectMany = useCallback((ids: string[], on: boolean) => {
    setSelected((sel) => {
      const next = new Set(sel)
      for (const id of ids) (on ? next.add(id) : next.delete(id))
      return next
    })
  }, [])

  const inspected = inspectId ? (findings.find((f) => f.id === inspectId) ?? null) : null
  useEffect(() => {
    if (inspectId && !inspected) setInspectId(null)
  }, [inspectId, inspected])

  const openRule = useCallback((id: string) => {
    setInspectId(null)
    setRuleFocus(id)
    setView('rules')
  }, [])

  const commands = useMemo<Command[]>(() => {
    const go = (v: View, label: string, keys?: string[]): Command => ({ id: `go-${v}`, group: 'Go to', label, keys, run: () => setView(v) })
    const hasFindings = findings.length > 0
    const safeIds = findings.filter((f) => f.risk === 'safe').map((f) => f.id)
    const list: Command[] = [
      go('overview', 'Overview', ['⌘', '1']),
      go('review', 'Review', ['⌘', '2']),
      go('tidy', 'Tidy a folder', ['⌘', '3']),
      go('migrate', 'Move projects to pnpm'),
      go('history', 'History', ['⌘', '4']),
      go('insights', 'Insights', ['⌘', '5']),
      go('apps', 'Apps', ['⌘', '6']),
      go('rules', 'Rules', ['⌘', '7']),
      go('quarantine', 'Quarantine', ['⌘', '8']),
      go('settings', 'Settings', ['⌘', ',']),
      ...(phase === 'scanning' ? [{ id: 'stop-scan', group: 'Actions', label: 'Stop the scan', words: 'cancel abort', run: () => stopTask() }] : []),
      { id: 'scan', group: 'Actions', label: phase === 'scanning' ? 'Scan is running…' : 'Scan now', keys: ['⌘', 'R'], words: 'start find', run: () => { if (phase !== 'scanning') void scan() } },
    ]
    if (hasFindings) {
      list.push(
        { id: 'select-safe', group: 'Actions', label: 'Select all safe findings', hint: `${safeIds.length} item${safeIds.length === 1 ? '' : 's'}`, words: 'pick check', run: () => setSelected(new Set(safeIds)) },
        { id: 'clear-sel', group: 'Actions', label: 'Clear the selection', words: 'unselect none', run: () => setSelected(new Set()) },
        { id: 'to-review', group: 'Actions', label: 'Review what is selected', hint: `${selected.size} selected`, words: 'clean', run: () => setView('review') },
        { id: 'report', group: 'Actions', label: 'Copy the scan report', words: 'summary export share', run: () => setDialog('report') },
      )
    }
    list.push(
      { id: 'appearance-dark', group: 'Appearance', label: 'Use the dark theme', words: 'night', run: () => void updateSettings({ appearance: 'dark' }) },
      { id: 'appearance-light', group: 'Appearance', label: 'Use the light theme', words: 'day', run: () => void updateSettings({ appearance: 'light' }) },
      { id: 'appearance-system', group: 'Appearance', label: 'Follow the system theme', words: 'auto', run: () => void updateSettings({ appearance: 'system' }) },
      { id: 'motion-reduced', group: 'Appearance', label: 'Reduce motion', words: 'animation calm', run: () => void updateSettings({ motion: 'reduced' }) },
      { id: 'motion-full', group: 'Appearance', label: 'Use full motion', words: 'animation', run: () => void updateSettings({ motion: 'full' }) },
      { id: 'keys', group: 'Help', label: 'Keyboard shortcuts', keys: ['?'], run: () => setDialog('keys') },
      { id: 'tour', group: 'Help', label: 'Take the tour again', words: 'welcome onboarding', run: () => setTour(true) },
      { id: 'about', group: 'Help', label: 'About Whittle', words: 'version licence', run: () => setDialog('about') },
      { id: 'repo', group: 'Project', label: 'Open the repository on GitHub', words: 'source code', run: () => openExternal('repository') },
      { id: 'releases', group: 'Project', label: 'Open releases', words: 'download update changelog', run: () => openExternal('releases') },
      { id: 'issues', group: 'Project', label: 'Report a problem', words: 'bug issue feedback', run: () => openExternal('issues') },
      { id: 'security', group: 'Project', label: 'Security policy', words: 'vulnerability report', run: () => openExternal('security') },
    )
    return list
  }, [findings, selected.size, phase, scan, updateSettings, openExternal])

  // ⌘K palette, ⌘R scan, ⌘1–8 views, ⌘, settings, ? shortcuts. Dialogs handle their own keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const blocked = dialog || tour || document.querySelector('.modal')
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (blocked) return
        setInspectId(null)
        setPalette((p) => !p)
        return
      }
      if (palette || inspectId || blocked) return
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (mod && e.key === ',') {
        e.preventDefault()
        setView('settings')
      } else if (mod && /^[1-8]$/.test(e.key)) {
        e.preventDefault()
        setView(VIEW_ORDER[Number(e.key) - 1])
      } else if (mod && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        if (phase !== 'scanning') void scan()
      } else if (!mod && !typing && e.key === '?') {
        e.preventDefault()
        setDialog('keys')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, tour, palette, inspectId, phase, scan])

  const toggleModule = (m: ModuleId) => setModules((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]))

  return (
    <div className="app">
      <div className="titlebar" data-tauri-drag-region />
      <Sidebar view={view} onView={setView} onAbout={() => setDialog('about')} onPalette={() => { setInspectId(null); setPalette(true) }} reviewCount={findings.length} quarantine={quarantine} version={info.version} demo={info.demo} />
      <main className="main">
        {view === 'overview' && (
          <Overview onStop={stopTask} phase={phase} run={scanRun} progress={progress} tally={tally} scanningModule={scanning} findings={findings} modules={modules} onToggleModule={toggleModule} onScan={() => void scan()} onReview={() => setView('review')} onQuickClean={() => { setSelected(new Set(findings.filter((f) => f.risk === 'safe').map((f) => f.id))); setConfirmRequest((n) => n + 1); setView('review') }} />
        )}
        {view === 'review' && (
          <Review confirmRequest={confirmRequest} findings={findings} selected={selected} onSelected={setSelected} peeling={peeling} home={info.home} busy={busy} run={applyRun} notice={notice} settings={prefs} onClean={(d) => void clean(d)} onScan={() => void scan()} onIgnore={(id) => void ignoreFinding(id)} onReveal={(id) => void api.revealFinding(id).catch((e) => setNotice({ text: errorText(e) }))} onInspect={(f) => setInspectId(f.id)} />
        )}
        {view === 'insights' && (
          <Insights findings={findings} runs={runs} home={info.home} onInspect={(f) => setInspectId(f.id)} onScan={() => void scan()} onReport={() => setDialog('report')} />
        )}
        {view === 'apps' && (
          <Apps findings={findings} home={info.home} selected={selected} onSelectMany={selectMany} onInspect={(f) => setInspectId(f.id)} onReview={() => setView('review')} onScan={() => void scan()} />
        )}
        {view === 'rules' && (
          <Rules rules={rules} findings={findings} focus={ruleFocus} onFocused={() => setRuleFocus(null)} onGuide={() => openExternal('repository')} />
        )}
        {view === 'quarantine' && (
          <Quarantine
            runs={runs}
            quarantine={quarantine}
            days={prefs.quarantine_days}
            autoPurge={prefs.auto_purge}
            onUndo={async (run) => {
              await undoRun(run)
            }}
            onPurge={purgeAll}
            onSettings={() => setView('settings')}
          />
        )}
        {view === 'tidy' && (
          <Tidy
            home={info.home}
            preview={(dir) => runTask('Checking the folder', 'Looking at the files', () => api.tidyPreview(dir))}
            apply={async (dir, onProgress) => {
              const moved = await runTask('Tidying up', 'Moving files', (h) =>
                api.tidyApply(dir, (p) => {
                  onProgress(p)
                  h.update(progressPatch(p, 'Moving'))
                }),
              )
              await refreshState()
              setResult(tidyResult(moved, dir))
            }}
          />
        )}
        {view === 'migrate' && (
          <Migrate
            home={info.home}
            roots={settings?.migrate_roots ?? []}
            onRoots={async (roots) => { await updateSettings({ migrate_roots: roots }) }}
            preview={() => runTask('Finding projects', 'Looking in your folders', () => api.migratePreview())}
            installPnpm={() =>
              runTask('Installing pnpm', 'Installing with npm', (h) =>
                api.migrateInstallPnpm((line) => h.log(line)),
              )
            }
            apply={(ids, onProgress) =>
              runTask('Converting projects', `${ids.length} project(s)`, (h) =>
                api.migrateApply(
                  ids,
                  (p) => {
                    onProgress(p)
                    h.update({ fraction: p.total ? p.done / p.total : null, done: p.done, total: p.total, item: basename(p.project) })
                  },
                  (ph) => h.update({ stage: ph.phase, item: basename(ph.project) }),
                ),
              )
            }
            onResult={setResult}
            onChanged={() => void refreshState()}
          />
        )}
        {view === 'history' && (
          <History
            runs={runs}
            quarantine={quarantine}
            days={prefs.quarantine_days}
            onUndo={undoRun}
            onPurge={purgeAll}
          />
        )}
        {view === 'settings' && settings && (
          <Settings
            settings={settings}
            info={info}
            permissions={permissions}
            quarantine={quarantine}
            save={save}
            onChange={(patch) => void updateSettings(patch)}
            onAddExclusion={addExclusion}
            onRemoveExclusion={(p) => void removeExclusion(p)}
            onPurge={purgeAll}
            onReset={async () => {
              adoptSettings(await api.resetSettings())
              setModules((await api.getSettings()).default_modules)
            }}
            onRecheck={recheck}
            onOpen={openExternal}
            onOpenFolder={(config) => void api.openDataFolder(config)}
            onTour={() => setTour(true)}
            onAbout={() => setDialog('about')}
          />
        )}
        {view !== 'review' && notice && (
          <div className="notice notice--floating" role="status">
            <span>{notice.text}</span>
            <button className="link" onClick={() => setNotice(null)}>Dismiss</button>
          </div>
        )}
      </main>
      {settings && (!settings.onboarded || tour) && (
        <Onboarding
          days={settings.quarantine_days}
          permissions={permissions}
          onRecheck={recheck}
          onOpenAccess={() => openExternal('full-disk-access')}
          onDone={() => {
            setTour(false)
            if (!settings.onboarded) void updateSettings({ onboarded: true })
          }}
        />
      )}
      {dialog === 'about' && <About info={info} onOpen={openExternal} onClose={() => setDialog(null)} />}
      {dialog === 'keys' && <Shortcuts onClose={() => setDialog(null)} />}
      {task && task.shown && !result && !(view === 'overview' && task.title === SCAN_TITLE) && <TaskPopup task={task} onClose={closeTask} onCancel={stopTask} />}
      {result && (
        <ResultDialog
          result={result}
          onClose={() => setResult(null)}
          onNext={(v) => { setResult(null); setView(v) }}
        />
      )}
      {dialog === 'report' && <ReportDialog text={buildReport(findings, info.home, new Date())} onClose={() => setDialog(null)} />}
      {inspected && (
        <Inspector
          finding={inspected}
          all={findings}
          rule={rules?.find((r) => r.id === inspected.rule)}
          home={info.home}
          selected={selected.has(inspected.id)}
          onSelect={(on) => selectMany([inspected.id], on)}
          onReveal={() => void api.revealFinding(inspected.id).catch((e) => setNotice({ text: errorText(e) }))}
          onIgnore={() => void ignoreFinding(inspected.id)}
          onInspect={(f) => setInspectId(f.id)}
          onRule={openRule}
          onClose={() => setInspectId(null)}
        />
      )}
      {palette && (
        <CommandPalette
          commands={commands}
          findings={findings}
          rules={rules ?? []}
          onInspect={(f) => setInspectId(f.id)}
          onRule={openRule}
          onClose={() => setPalette(false)}
        />
      )}
    </div>
  )
}
