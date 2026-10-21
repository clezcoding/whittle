import type { ModuleId } from '../types'

export const MODULES: { id: ModuleId; label: string; hint: string }[] = [
  { id: 'caches', label: 'Caches & logs', hint: 'App caches, logs, Xcode, package managers' },
  { id: 'projects', label: 'Dev projects', hint: 'node_modules, target, venv of projects you have not touched' },
  { id: 'orphans', label: 'App leftovers', hint: 'Files of apps that are no longer installed' },
  { id: 'dupes', label: 'Duplicates', hint: 'Identical files in Downloads, Documents, Pictures … (slower)' },
]

export const moduleLabel = (id: ModuleId) => MODULES.find((m) => m.id === id)?.label ?? id
