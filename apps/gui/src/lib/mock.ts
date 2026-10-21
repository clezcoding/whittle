// Demo data for running the interface in a plain browser (`pnpm dev`) without the Rust backend.
// It mimics what `whittle-core` would return on a developer's Mac.

import type { ApplyProgress, ApplyReport, Disposal, Failure, Finding, ModuleId, Permissions, PurgeReport, RunSummary, ScanProgress, Settings, TidyEntry, UndoReport } from '../types'

export const DEMO_HOME = '/Users/clez'
const DAY = 86_400
const now = () => Math.floor(Date.now() / 1000)

function f(
  id: string,
  module: string,
  category: string,
  title: string,
  path: string,
  gb: number,
  risk: Finding['risk'],
  note: string | null,
  ageDays: number,
  regenerable = true,
  confidence = 1,
): Finding {
  return {
    id,
    module,
    rule: id,
    category,
    title,
    path: DEMO_HOME + '/' + path,
    bytes: Math.round(gb * 1e9),
    risk,
    regenerable,
    note,
    related: null,
    confidence,
    modified: now() - ageDays * DAY,
  }
}

export const MOCK_FINDINGS: Finding[] = [
  f('a1', 'caches', 'dev', 'Xcode DerivedData · Atlas-bnxqk', 'Library/Developer/Xcode/DerivedData/Atlas-bnxqkd', 9.4, 'safe', 'Build products and indexes. Xcode rebuilds them.', 21),
  f('a2', 'caches', 'dev', 'Xcode DerivedData · Magari-fqzw', 'Library/Developer/Xcode/DerivedData/Magari-fqzwlc', 5.1, 'safe', 'Build products and indexes. Xcode rebuilds them.', 44),
  f('a3', 'caches', 'dev', 'Xcode device support · iOS 17.4', 'Library/Developer/Xcode/iOS DeviceSupport/iPhone15,2 17.4', 3.2, 'safe', 'Debug symbols copied from devices.', 130),
  f('b1', 'projects', 'dev', 'node_modules · clared-web', 'Developer/clared-web/node_modules', 1.9, 'safe', 'Project untouched for 96 days. Restore with: npm install / pnpm install.', 96),
  f('b2', 'projects', 'dev', 'Rust target · old-tool', 'Developer/old-tool/target', 4.6, 'safe', 'Project untouched for 212 days. Restore with: cargo build.', 212),
  f('b3', 'projects', 'dev', 'node_modules · creatoros', 'Developer/creatoros/node_modules', 1.4, 'safe', 'Project untouched for 71 days. Restore with: npm install / pnpm install.', 71),
  f('c1', 'caches', 'caches', 'App caches · com.spotify.client', 'Library/Caches/com.spotify.client', 2.8, 'safe', 'Apps rebuild their caches on demand.', 18),
  f('c2', 'caches', 'caches', 'App caches · Google', 'Library/Caches/Google', 1.7, 'safe', 'Apps rebuild their caches on demand.', 33),
  f('c3', 'caches', 'caches', 'Old logs · DiagnosticReports', 'Library/Logs/DiagnosticReports', 0.6, 'safe', 'Log files older than two weeks, including crash reports.', 40),
  f('c4', 'caches', 'caches', 'Electron app caches · Slack', 'Library/Application Support/Slack/Cache', 0.9, 'safe', 'GPU, shader and code caches of Electron apps.', 12),
  f('d1', 'orphans', 'app-leftovers', 'com.getdropbox.dropbox', 'Library/Application Support/com.getdropbox.dropbox', 1.3, 'caution', 'Belongs to com.getdropbox.dropbox, which is not installed.', 210, false, 0.9),
  f('d2', 'orphans', 'app-leftovers', 'com.adobe.Reader', 'Library/Caches/com.adobe.Reader', 0.7, 'caution', 'Belongs to com.adobe.Reader, which is not installed.', 330, false, 0.9),
  f('d3', 'orphans', 'app-leftovers', 'Sublime Text 3', 'Library/Application Support/Sublime Text 3', 0.2, 'manual', 'No installed app is called “Sublime Text 3”. It may still belong to a command-line tool.', 500, false, 0.4),
  f('d4', 'orphans', 'app-leftovers', 'com.gone.agent.plist', 'Library/LaunchAgents/com.gone.agent.plist', 0.00002, 'caution', 'Starts /Applications/Gone.app/Contents/MacOS/gone, which no longer exists.', 400, false, 0.95),
  f('e1', 'caches', 'downloads', 'Old installers · Docker.dmg', 'Downloads/Docker.dmg', 0.6, 'caution', 'Disk images and installer packages in Downloads that are older than 30 days.', 80, false),
  f('e2', 'caches', 'downloads', 'Old installers · macOS-Sonoma.pkg', 'Downloads/macOS-Sonoma.pkg', 1.1, 'caution', 'Disk images and installer packages in Downloads that are older than 30 days.', 150, false),
  f('g1', 'caches', 'backups', 'iPhone / iPad backups · 00008110', 'Library/Application Support/MobileSync/Backup/00008110-001A', 12.3, 'manual', 'Local device backups. Only you know if you still need them. Needs Full Disk Access.', 400, false, 0.5),
]

const PHASES: Record<ModuleId, { label: string; total: number }[]> = {
  caches: [{ label: 'Looking up locations', total: 22 }, { label: 'Measuring folders', total: 118 }],
  projects: [{ label: 'Walking project folders', total: 64 }, { label: 'Measuring build folders', total: 9 }],
  orphans: [{ label: 'Reading installed apps', total: 1 }, { label: 'Checking app folders', total: 315 }, { label: 'Checking login items', total: 1 }],
  dupes: [{ label: 'Listing files', total: 410 }, { label: 'Comparing files', total: 36 }],
}

type Handlers = {
  scan(modules: ModuleId[], onProgress: (e: ScanProgress) => void): Promise<Finding[]>
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

let live = [...MOCK_FINDINGS]
let settings: Settings = {
  onboarded: false,
  default_disposal: 'quarantine',
  quarantine_days: 30,
  auto_purge: true,
  confirm_before_clean: true,
  default_modules: ['caches', 'projects', 'orphans'],
  exclusions: [],
  appearance: 'system',
  motion: 'system',
}
const expand = (p: string) => p.trim().replace(/^~(?=\/|$)/, DEMO_HOME).replace(/\/+$/, '')
const excluded = (path: string) => settings.exclusions.some((e) => path === expand(e) || path.startsWith(expand(e) + '/') || expand(e).startsWith(path + '/'))

/** Same rules as `Settings::resolve_exclusion` in the Rust core. */
function resolveExclusion(raw: string): string {
  const p = expand(raw)
  if (!p) throw new Error('the path is empty')
  if (!p.startsWith('/')) throw new Error(`\`${raw.trim()}\` is not an absolute path (start with / or ~/)`)
  if (p.split('/').includes('..')) throw new Error('`..` is not allowed in an excluded path')
  if (p === '') throw new Error('the root folder cannot be excluded')
  return p
}
let runs: RunSummary[] = []
let quarantine = 0
const quarantined: Record<string, { items: Finding[]; bytes: number }> = {}

/** Plays back a plausible apply: bytes-weighted fraction, like the backend reports. */
async function simulate(items: { title: string; bytes: number }[], onProgress?: (p: ApplyProgress) => void) {
  const weight = (b: number) => Math.max(b, 256 * 1024)
  const totalW = items.reduce((s, i) => s + weight(i.bytes), 0)
  const bytesTotal = items.reduce((s, i) => s + i.bytes, 0)
  let w = 0
  let b = 0
  onProgress?.({ done: 0, total: items.length, bytes_done: 0, bytes_total: bytesTotal, fraction: 0, title: '' })
  for (const [i, it] of items.entries()) {
    await wait(120 + Math.min(500, it.bytes / 4e7))
    w += weight(it.bytes)
    b += it.bytes
    onProgress?.({ done: i + 1, total: items.length, bytes_done: b, bytes_total: bytesTotal, fraction: w / totalW, title: it.title })
  }
}

export const mock: Handlers & {
  apply(ids: string[], disposal: Disposal, onProgress?: (p: ApplyProgress) => void): Promise<ApplyReport>
  history(): Promise<RunSummary[]>
  undo(run?: string): Promise<UndoReport>
  purge(olderThan: number): Promise<PurgeReport>
  quarantineSize(): Promise<number>
  tidyPreview(dir: string): Promise<TidyEntry[]>
  tidyApply(dir: string, onProgress?: (p: ApplyProgress) => void): Promise<ApplyReport>
  getSettings(): Promise<Settings>
  saveSettings(s: Settings): Promise<Settings>
  resetSettings(): Promise<Settings>
  addExclusion(path: string): Promise<Settings>
  removeExclusion(path: string): Promise<Settings>
  ignoreFinding(id: string): Promise<Settings>
  permissions(): Promise<Permissions>
} = {
  async scan(modules, onProgress) {
    const order: ModuleId[] = modules.length ? modules : ['caches', 'projects', 'orphans']
    const out: Finding[] = []
    for (const module of order) {
      onProgress({ event: 'started', module })
      const phases = PHASES[module]
      const steps = 14
      for (let i = 1; i <= steps; i++) {
        await wait(55 + Math.random() * 70)
        const fraction = i / steps
        const p = phases[Math.min(phases.length - 1, Math.floor(fraction * phases.length))]
        const total = p.total
        onProgress({ event: 'step', module, phase: p.label, fraction, done: Math.round(total * ((fraction * phases.length) % 1 || 1)), total })
      }
      const found = live.filter((x) => x.module === module && !excluded(x.path))
      out.push(...found)
      onProgress({ event: 'finished', module, findings: found.length, bytes: found.reduce((s, x) => s + x.bytes, 0) })
    }
    return out
  },
  async apply(ids, disposal, onProgress) {
    const picked = live.filter((x) => ids.includes(x.id))
    const bytes = picked.reduce((s, x) => s + x.bytes, 0)
    await simulate(picked.map((x) => ({ title: x.title, bytes: x.bytes })), onProgress)
    const run = String(now()).padStart(10, '0') + '-demo'
    live = live.filter((x) => !ids.includes(x.id))
    if (disposal === 'quarantine') {
      quarantine += bytes
      quarantined[run] = { items: picked, bytes }
    }
    runs = [{ run, ts: now(), items: picked.length, bytes, restored: 0, undoable: disposal === 'quarantine' ? picked.length : 0 }, ...runs]
    return {
      run,
      dry_run: false,
      applied: picked.map((x) => ({ run, ts: now(), op: disposal, from: x.path, to: null, bytes: x.bytes, title: x.title })),
      failed: [] as Failure[],
      bytes_handled: bytes,
      bytes_freed: disposal === 'delete' ? bytes : 0,
    }
  },
  async history() {
    return runs
  },
  async getSettings() {
    return { ...settings }
  },
  async saveSettings(next) {
    if (next.quarantine_days < 1 || next.quarantine_days > 365) throw new Error('quarantine period must be 1 to 365 days')
    if (!next.default_modules.length) throw new Error('pick at least one thing to scan')
    next.exclusions.forEach(resolveExclusion)
    settings = { ...next }
    return { ...settings }
  },
  async resetSettings() {
    settings = { ...settings, onboarded: true, default_disposal: 'quarantine', quarantine_days: 30, auto_purge: true, confirm_before_clean: true, default_modules: ['caches', 'projects', 'orphans'], appearance: 'system', motion: 'system' }
    return { ...settings }
  },
  async addExclusion(path) {
    const p = resolveExclusion(path)
    if (!settings.exclusions.some((e) => expand(e) === p)) settings = { ...settings, exclusions: [...settings.exclusions, p] }
    return { ...settings }
  },
  async removeExclusion(path) {
    const p = expand(path)
    settings = { ...settings, exclusions: settings.exclusions.filter((e) => expand(e) !== p) }
    return { ...settings }
  },
  async ignoreFinding(id) {
    const hit = live.find((x) => x.id === id)
    if (!hit) throw new Error('That item is no longer in the last scan.')
    return mock.addExclusion(hit.path)
  },
  async permissions() {
    return { full_disk_access: false, effect: 'Without Full Disk Access, macOS hides some app data from Whittle. It will miss leftovers in protected folders, but it never touches more than before.' }
  },
  async undo(run) {
    await wait(250)
    const target = run ?? runs.find((r) => r.undoable > 0)?.run
    if (!target || !quarantined[target]) throw new Error('nothing to undo')
    const q = quarantined[target]
    live = [...live, ...q.items]
    quarantine -= q.bytes
    delete quarantined[target]
    runs = runs.map((r) => (r.run === target ? { ...r, restored: r.items, undoable: 0 } : r))
    return { run: target, restored: q.items.length, skipped: [] }
  },
  async purge() {
    const freed = quarantine
    const count = Object.keys(quarantined).length
    quarantine = 0
    for (const k of Object.keys(quarantined)) delete quarantined[k]
    runs = runs.map((r) => ({ ...r, undoable: 0 }))
    return { runs_removed: count, bytes_freed: freed }
  },
  async quarantineSize() {
    return quarantine
  },
  async tidyPreview(dir) {
    await wait(300)
    const d = dir.replace(/^~/, DEMO_HOME).replace(/\/$/, '')
    const e = (name: string, to: string, mb: number, reason: string): TidyEntry => ({ from: `${d}/${name}`, to: `${d}/${to}/${name}`, bytes: mb * 1e6, reason })
    return [
      e('Rechnung 2026-09.pdf', 'Documents', 0.4, 'file type'),
      e('Vertrag Hetzner.pdf', 'Documents', 1.2, 'file type'),
      e('Bildschirmfoto 2026-10-02 um 09.14.31.png', 'Screenshots/2026-10', 2.1, 'screenshot'),
      e('Bildschirmfoto 2026-10-11 um 17.45.02.png', 'Screenshots/2026-10', 1.8, 'screenshot'),
      e('Bildschirmfoto 2026-09-28 um 12.00.10.png', 'Screenshots/2026-09', 1.9, 'screenshot'),
      e('IMG_4419.HEIC', 'Images/2026', 3.4, 'file type'),
      e('Docker.dmg', 'Installers', 640, 'file type'),
      e('export.zip', 'Archives', 88, 'file type'),
      e('Bildschirmaufnahme 2026-10-09 um 11.20.mov', 'Screen Recordings/2026-10', 210, 'screen recording'),
    ]
  },
  async tidyApply(dir, onProgress) {
    const entries = await mock.tidyPreview(dir)
    await simulate(entries.map((e) => ({ title: e.from.slice(e.from.lastIndexOf('/') + 1), bytes: e.bytes })), onProgress)
    const run = String(now()).padStart(10, '0') + '-tidy'
    runs = [{ run, ts: now(), items: entries.length, bytes: entries.reduce((s, x) => s + x.bytes, 0), restored: 0, undoable: entries.length }, ...runs]
    return { run, dry_run: false, applied: [], failed: [], bytes_handled: 0, bytes_freed: 0 }
  },
}

/** Seeds some history so the demo's History screen is not empty. */
export function seedDemoHistory() {
  if (runs.length) return
  runs = [
    { run: String(now() - 3 * DAY).padStart(10, '0') + '-a1b2', ts: now() - 3 * DAY, items: 14, bytes: 6_200_000_000, restored: 0, undoable: 14 },
    { run: String(now() - 19 * DAY).padStart(10, '0') + '-c3d4', ts: now() - 19 * DAY, items: 5, bytes: 1_100_000_000, restored: 5, undoable: 0 },
  ]
  quarantine = 6_200_000_000
  quarantined[runs[0].run] = { items: [], bytes: 6_200_000_000 }
}
