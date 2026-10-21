import { useCallback, useEffect, useRef, useState } from 'react'
import { About } from './components/About'
import { Onboarding } from './components/Onboarding'
import { Shortcuts } from './components/Shortcuts'
import { Sidebar, type View } from './components/Sidebar'
import { api } from './lib/api'
import { formatBytes } from './lib/format'
import { errorText, isExcluded } from './lib/paths'
import { moduleWeights, overallFraction, rememberDurations } from './lib/timing'
import type { ApplyRun, AppInfo, Disposal, External, Finding, ModuleId, ModuleRun, Permissions, RunSummary, ScanProgress, ScanRun, Settings as SettingsT } from './types'
import { History } from './views/History'
import { Overview, type Phase } from './views/Overview'
import { Review } from './views/Review'
import { Settings, type SaveState } from './views/Settings'
import { Tidy } from './views/Tidy'

const DEFAULT_MODULES: ModuleId[] = ['caches', 'projects', 'orphans']
const VIEWS: View[] = ['overview', 'review', 'tidy', 'history']

const FALLBACK_SETTINGS: SettingsT = {
  onboarded: true,
  default_disposal: 'quarantine',
  quarantine_days: 30,
  auto_purge: true,
  confirm_before_clean: true,
  default_modules: DEFAULT_MODULES,
  exclusions: [],
  appearance: 'system',
  motion: 'system',
}

export function App() {
  const [info, setInfo] = useState<AppInfo>({ home: '', version: '', demo: false, os: '', state_dir: '', config_dir: '', repo: '' })
  const [settings, setSettings] = useState<SettingsT | null>(null)
  const [permissions, setPermissions] = useState<Permissions | null>(null)
  const [save, setSave] = useState<SaveState>('idle')
  const [dialog, setDialog] = useState<'about' | 'keys' | null>(null)
  const [tour, setTour] = useState(false)
  const [view, setView] = useState<View>('overview')
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [tally, setTally] = useState(0)
  const [scanning, setScanning] = useState<ModuleId | null>(null)
  const [modules, setModules] = useState<ModuleId[]>(DEFAULT_MODULES)
  const [findings, setFindings] = useState<Finding[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [peeling, setPeeling] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; undo?: () => void } | null>(null)
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [quarantine, setQuarantine] = useState(0)
  const [scanRun, setScanRun] = useState<ScanRun | null>(null)
  const [applyRun, setApplyRun] = useState<ApplyRun | null>(null)
  const scanId = useRef(0)
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
      const found = await api.scan(modules, onProgress)
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
  }, [modules])

  const clean = useCallback(
    async (disposal: Disposal) => {
      const ids = findings.filter((f) => selected.has(f.id)).map((f) => f.id)
      if (!ids.length) return
      setBusy(true)
      try {
        const startedAt = Date.now()
        setApplyRun({ done: 0, total: ids.length, bytes_done: 0, bytes_total: 0, fraction: 0, title: '', startedAt })
        const report = await api.apply(ids, disposal, (p) => setApplyRun({ ...p, startedAt }))
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
        setNotice({
          text: text + failed,
          undo: disposal === 'quarantine' ? async () => { await api.undo(report.run); await refreshState(); await scan() } : undefined,
        })
        await refreshState()
      } catch (e) {
        setNotice({ text: `Could not clean: ${String(e)}` })
      } finally {
        setBusy(false)
        setApplyRun(null)
      }
    },
    [findings, selected, refreshState, scan, prefs.quarantine_days],
  )

  // ⌘R scan, ⌘1–4 views, ⌘, settings, ? shortcuts. Dialogs handle their own keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || tour || document.querySelector('.modal')) return
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === ',') {
        e.preventDefault()
        setView('settings')
      } else if (mod && /^[1-4]$/.test(e.key)) {
        e.preventDefault()
        setView(VIEWS[Number(e.key) - 1])
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
  }, [dialog, tour, phase, scan])

  const toggleModule = (m: ModuleId) => setModules((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]))

  return (
    <div className="app">
      <div className="titlebar" data-tauri-drag-region />
      <Sidebar view={view} onView={setView} onAbout={() => setDialog('about')} reviewCount={findings.length} quarantine={quarantine} version={info.version} demo={info.demo} />
      <main className="main">
        {view === 'overview' && (
          <Overview phase={phase} run={scanRun} progress={progress} tally={tally} scanningModule={scanning} findings={findings} modules={modules} onToggleModule={toggleModule} onScan={() => void scan()} onReview={() => setView('review')} />
        )}
        {view === 'review' && (
          <Review findings={findings} selected={selected} onSelected={setSelected} peeling={peeling} home={info.home} busy={busy} run={applyRun} notice={notice} settings={prefs} onClean={(d) => void clean(d)} onScan={() => void scan()} onIgnore={(id) => void ignoreFinding(id)} onReveal={(id) => void api.revealFinding(id).catch((e) => setNotice({ text: errorText(e) }))} />
        )}
        {view === 'tidy' && (
          <Tidy
            home={info.home}
            preview={api.tidyPreview}
            apply={async (dir, onProgress) => {
              await api.tidyApply(dir, onProgress)
              await refreshState()
            }}
          />
        )}
        {view === 'history' && (
          <History
            runs={runs}
            quarantine={quarantine}
            days={prefs.quarantine_days}
            onUndo={async (run) => {
              await api.undo(run)
              await refreshState()
            }}
            onPurge={async () => {
              await api.purge(0)
              await refreshState()
            }}
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
            onPurge={async () => {
              await api.purge(0)
              await refreshState()
            }}
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
        {(view === 'overview' || view === 'settings') && notice && (
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
    </div>
  )
}
