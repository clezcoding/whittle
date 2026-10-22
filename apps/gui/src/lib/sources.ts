// Who owns a finding? Groups findings by the app, tool or project they belong to, for the Apps page.
// Pure and deterministic: it only reads the path and title the scan already produced.

import type { Finding } from '../types'

export type SourceKind = 'app' | 'project' | 'tool' | 'folder'

export interface Source {
  key: string
  label: string
  kind: SourceKind
}

export interface SourceGroup {
  source: Source
  items: Finding[]
  bytes: number
  safeBytes: number
}

export const KIND_LABEL: Record<SourceKind, string> = { app: 'App', project: 'Project', tool: 'Dev tool', folder: 'Folder' }

const TLDS = new Set(['com', 'org', 'net', 'io', 'de', 'app', 'dev', 'co', 'me', 'ai', 'us', 'uk'])
const GENERIC = new Set(['client', 'desktop', 'helper', 'app', 'mac', 'macos', 'agent', 'mobile', 'shipit', 'updater', 'daemon', 'service'])

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** `com.spotify.client` -> `Spotify`, `com.getdropbox.dropbox` -> `Dropbox`, `Sublime Text 3` stays as it is. */
export function prettyName(raw: string): string {
  const name = raw.replace(/\.(plist|savedState)$/i, '')
  if (!/^[a-z0-9-]+(\.[A-Za-z0-9_-]+)+$/i.test(name) || name.includes(' ')) return name
  const parts = name.split('.')
  if (TLDS.has(parts[0].toLowerCase())) parts.shift()
  if (parts.length === 0) return name
  if (parts.length === 1) return cap(parts[0])
  const last = parts[parts.length - 1]
  return cap(GENERIC.has(last.toLowerCase()) ? parts[parts.length - 2] : last)
}

const TOOL_DIRS: [RegExp, string][] = [
  [/^\.npm(\/|$)/, 'npm'],
  [/^\.yarn(\/|$)/, 'Yarn'],
  [/^\.cargo(\/|$)/, 'Cargo'],
  [/^\.gradle(\/|$)/, 'Gradle'],
  [/^\.cache\/pip(\/|$)/, 'pip'],
  [/^\.cache\/go-build(\/|$)/, 'Go'],
]

function rel(path: string, home: string): string {
  return home && path.startsWith(home + '/') ? path.slice(home.length + 1) : path.replace(/^\/+/, '')
}

function projectName(f: Finding, r: string): string {
  const fromTitle = f.title.split(' · ')[1]
  if (fromTitle) return fromTitle
  const m = /^(?:Developer|Projects|Code|dev|src)\/([^/]+)/.exec(r)
  return m?.[1] ?? r.split('/')[0]
}

export function sourceOf(f: Finding, home: string): Source {
  const r = rel(f.path, home)
  if (f.module === 'projects') {
    const name = projectName(f, r)
    return { key: `project:${name.toLowerCase()}`, label: name, kind: 'project' }
  }
  if (r.startsWith('Library/Developer/')) return { key: 'tool:xcode', label: 'Xcode', kind: 'tool' }
  if (r.startsWith('Library/Application Support/MobileSync/')) return { key: 'tool:ios-backups', label: 'iPhone & iPad backups', kind: 'tool' }
  for (const [re, label] of TOOL_DIRS) if (re.test(r)) return { key: `tool:${label.toLowerCase()}`, label, kind: 'tool' }
  const lib = /^Library\/(?:Caches|Application Support|Logs|Containers|Group Containers|Preferences|LaunchAgents|Saved Application State)\/([^/]+)/.exec(r)
  if (lib) {
    const label = prettyName(lib[1])
    const toolLike = /^(Homebrew|Yarn|pip|CocoaPods|go-build|JetBrains)$/i.test(lib[1])
    return { key: `${toolLike ? 'tool' : 'app'}:${label.toLowerCase()}`, label, kind: toolLike ? 'tool' : 'app' }
  }
  if (r.startsWith('Downloads/') || r === 'Downloads') return { key: 'folder:downloads', label: 'Downloads', kind: 'folder' }
  const top = r.split('/')[0] || r
  return { key: `folder:${top.toLowerCase()}`, label: top, kind: 'folder' }
}

/** Groups by owner, biggest first. `safeBytes` is the part Whittle would pre-select. */
export function groupBySource(findings: Finding[], home: string): SourceGroup[] {
  const map = new Map<string, SourceGroup>()
  for (const f of findings) {
    const source = sourceOf(f, home)
    const g = map.get(source.key) ?? { source, items: [], bytes: 0, safeBytes: 0 }
    g.items.push(f)
    g.bytes += f.bytes
    if (f.risk === 'safe') g.safeBytes += f.bytes
    map.set(source.key, g)
  }
  for (const g of map.values()) g.items.sort((a, b) => b.bytes - a.bytes)
  return [...map.values()].sort((a, b) => b.bytes - a.bytes || a.source.label.localeCompare(b.source.label))
}
