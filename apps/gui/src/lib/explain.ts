// Plain-language explanations for everything the interface shows.
// The backend supplies a short `note` per finding; this file adds the rest, so that no item
// is ever just a path and a size. All text is deterministic: it never guesses beyond what the
// scan knows (module, rule, risk, regenerable, age).

import type { Finding, ModuleId, Risk } from '../types'

export const RISK_HELP: Record<Risk, string> = {
  safe: 'Regenerates by itself. Selected for you.',
  caution: 'Probably unneeded, but not recreated if removed. Never selected for you.',
  manual: 'Only you can tell. Never selected for you.',
}

export const MODULE_HELP: Record<ModuleId, string> = {
  caches: 'App caches, old logs, Xcode and package-manager caches, old installers, device backups.',
  projects: 'node_modules, target and virtual environments of projects you have not touched for a while.',
  orphans: 'Files that apps left behind after you uninstalled them.',
  dupes: 'Identical files in Downloads, Documents and Pictures. Slower, so off by default.',
}

export const CATEGORY_HELP: Record<string, string> = {
  caches: 'Temporary files apps rebuild when they need them.',
  dev: 'Build output and package caches. Your tools recreate them.',
  'app-leftovers': 'Data from apps that Whittle could not find on this Mac.',
  downloads: 'Disk images and installers in Downloads you have probably already used.',
  duplicates: 'Files with exactly the same content as another file.',
  backups: 'Full device backups made by Finder. Only you know if you still need them.',
}

export const NAV_HELP = {
  overview: 'Scan your Mac and see how much can go.',
  review: 'Look at every finding and choose what to clean.',
  tidy: 'Sort a messy folder into sub-folders by type and date.',
  migrate: 'Convert npm and yarn projects to pnpm. Each one is verified first, and every run can be undone.',
  history: 'Everything Whittle changed, with undo.',
  insights: 'Charts of the last scan: categories, risk, age, the biggest items.',
  apps: 'Findings grouped by app, dev tool and project.',
  rules: 'The rules Whittle scans with, and what each one matched.',
  quarantine: 'Items waiting to be removed for good. Put them back any time.',
  settings: 'Defaults, quarantine, never-touch list, appearance.',
} as const

export interface Explanation {
  what: string
  why: string
  impact: string
  undo: string
}

function whatIs(f: Finding): string {
  const p = f.path
  if (f.module === 'orphans') {
    if (p.endsWith('.plist') && p.includes('/LaunchAgents/')) return 'A background job that starts a program at login.'
    if (p.includes('/Group Containers/')) return 'Data an app shares with its own helpers and extensions.'
    if (p.includes('/Containers/')) return 'The private sandbox folder of an app.'
    if (p.includes('/Saved Application State/')) return 'The window layout an app restores on launch.'
    if (p.includes('/Preferences/')) return 'Settings of an app.'
    if (p.includes('/Caches/')) return 'Temporary files of an app.'
    if (p.includes('/Logs/')) return 'Log files of an app.'
    if (p.includes('/Application Support/')) return 'Data an app keeps for itself: settings, databases, downloaded content.'
    return 'Files an app stored in your Library.'
  }
  if (f.module === 'projects') return 'A folder generated from your project’s source files, such as installed packages or build output.'
  if (f.module === 'dupes') return 'A second copy of a file that exists elsewhere with identical content.'
  switch (f.category) {
    case 'downloads':
      return 'An installer (.dmg or .pkg) in Downloads.'
    case 'backups':
      return 'A complete backup of an iPhone or iPad.'
    case 'dev':
      return 'Build output or a package-manager cache.'
    default:
      return 'Temporary data that apps and the system create while they run.'
  }
}

function age(f: Finding, now = Date.now() / 1000): string | null {
  if (!f.modified) return null
  const days = Math.max(0, Math.round((now - f.modified) / 86400))
  if (days < 1) return 'Changed today.'
  if (days === 1) return 'Last changed yesterday.'
  if (days < 60) return `Last changed ${days} days ago.`
  if (days < 730) return `Last changed ${Math.round(days / 30)} months ago.`
  return `Last changed ${Math.round(days / 365)} years ago.`
}

function impact(f: Finding): string {
  if (f.risk === 'safe') {
    return 'Nothing you will notice. The app or tool creates it again when needed, so the next start can take a moment longer.'
  }
  if (f.risk === 'caution') {
    return f.regenerable
      ? 'It is recreated when needed.'
      : 'It is not recreated. If you still use the app or have the installer elsewhere you will not miss it; otherwise settings or sign-ins can be lost.'
  }
  return 'Whittle cannot tell whether this holds something you still need, such as saves, projects or backups. Look inside before you remove it.'
}

export function explain(f: Finding, now?: number): Explanation {
  const when = age(f, now)
  const why = [f.note, when].filter(Boolean).join(' ')
  const sure = f.module === 'orphans' && f.confidence > 0 ? ` Whittle is ${Math.round(f.confidence * 100)}% sure.` : ''
  return {
    what: whatIs(f),
    why: (why || 'Matched one of Whittle’s rules.') + sure,
    impact: impact(f),
    undo: 'Choose “Keep 30 days” and you can put it back from History at any time.',
  }
}

/** One line that is always visible under a finding. */
export function oneLine(f: Finding): string {
  return f.note ?? whatIs(f)
}

export const TIDY_REASON: Record<string, string> = {
  screenshot: 'name looks like a screenshot',
  'screen recording': 'name looks like a screen recording',
  'file type': 'by file type',
  'file content': 'by what is inside the file',
}

const TIDY_FOLDER_HELP: Record<string, string> = {
  Screenshots: 'Screenshots, one folder per month.',
  'Screen Recordings': 'Screen recordings, one folder per month.',
  Images: 'Photos and pictures, one folder per year.',
  Videos: 'Video files.',
  Audio: 'Music and audio files.',
  Documents: 'PDFs, Word and text documents, e-books.',
  Spreadsheets: 'Excel, Numbers and CSV files.',
  Presentations: 'PowerPoint and Keynote files.',
  Archives: 'Zip and other compressed files.',
  Installers: 'Disk images and installer packages.',
  Design: 'Photoshop, Sketch, Figma and other design files.',
  Fonts: 'Font files.',
  'Code & Data': 'Source code, JSON, YAML, SQL and similar.',
}

export function tidyFolderHelp(folder: string): string {
  return TIDY_FOLDER_HELP[folder.split('/')[0]] ?? 'Files of this type.'
}
