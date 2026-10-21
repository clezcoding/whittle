// One place that talks to the backend. Inside the Tauri app it calls the Rust commands;
// in a plain browser (`pnpm dev`) it falls back to demo data, so the interface can be
// designed and reviewed without a Mac.
//
// Security note: the interface never sends file paths to the backend for deletion. It sends the
// ids of findings from the backend's own last scan, so a compromised webview cannot ask the
// engine to touch an arbitrary path.

import type {
  ApplyProgress,
  ApplyReport,
  AppInfo,
  Disposal,
  External,
  Finding,
  ModuleId,
  Permissions,
  PurgeReport,
  RuleInfo,
  RunSummary,
  ScanProgress,
  Settings,
  TidyEntry,
  UndoReport,
} from '../types'
import { DEMO_HOME, mock, seedDemoHistory } from './mock'

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

async function withApplyEvents<T>(onProgress: ((p: ApplyProgress) => void) | undefined, run: () => Promise<T>): Promise<T> {
  const { listen } = await import('@tauri-apps/api/event')
  const unlisten = await listen<ApplyProgress>('apply-progress', (e) => onProgress?.(e.payload))
  try {
    return await run()
  } finally {
    unlisten()
  }
}

export const api = {
  async info(): Promise<AppInfo> {
    if (!isTauri) {
      seedDemoHistory()
      return {
        home: DEMO_HOME,
        version: '0.1.0',
        demo: true,
        os: 'macos',
        state_dir: DEMO_HOME + '/.whittle',
        config_dir: DEMO_HOME + '/.config/whittle',
        repo: 'https://github.com/clezcoding/whittle',
      }
    }
    return call<AppInfo>('app_info')
  },

  async scan(modules: ModuleId[], onProgress: (e: ScanProgress) => void): Promise<Finding[]> {
    if (!isTauri) {
      return mock.scan(modules, onProgress)
    }
    const { listen } = await import('@tauri-apps/api/event')
    const unlisten = await listen<ScanProgress>('scan-progress', (e) => onProgress(e.payload))
    try {
      return await call<Finding[]>('scan', { modules })
    } finally {
      unlisten()
    }
  },

  async apply(ids: string[], disposal: Disposal, onProgress?: (p: ApplyProgress) => void): Promise<ApplyReport> {
    if (!isTauri) return mock.apply(ids, disposal, onProgress)
    return withApplyEvents(onProgress, () => call<ApplyReport>('apply_findings', { ids, disposal }))
  },

  history(): Promise<RunSummary[]> {
    return isTauri ? call('history') : mock.history()
  },

  undo(run?: string): Promise<UndoReport> {
    return isTauri ? call('undo', { run: run ?? null }) : mock.undo(run)
  },

  purge(olderThanDays: number): Promise<PurgeReport> {
    return isTauri ? call('purge', { olderThan: olderThanDays }) : mock.purge(olderThanDays)
  },

  rules(): Promise<RuleInfo[]> {
    return isTauri ? call('list_rules') : mock.rules()
  },

  quarantineSize(): Promise<number> {
    return isTauri ? call('quarantine_size') : mock.quarantineSize()
  },

  tidyPreview(dir: string): Promise<TidyEntry[]> {
    return isTauri ? call('tidy_preview', { dir }) : mock.tidyPreview(dir)
  },

  async tidyApply(dir: string, onProgress?: (p: ApplyProgress) => void): Promise<ApplyReport> {
    if (!isTauri) return mock.tidyApply(dir, onProgress)
    return withApplyEvents(onProgress, () => call<ApplyReport>('tidy_apply', { dir }))
  },

  getSettings(): Promise<Settings> {
    return isTauri ? call('get_settings') : mock.getSettings()
  },
  saveSettings(settings: Settings): Promise<Settings> {
    return isTauri ? call('save_settings', { settings }) : mock.saveSettings(settings)
  },
  resetSettings(): Promise<Settings> {
    return isTauri ? call('reset_settings') : mock.resetSettings()
  },
  addExclusion(path: string): Promise<Settings> {
    return isTauri ? call('add_exclusion', { path }) : mock.addExclusion(path)
  },
  removeExclusion(path: string): Promise<Settings> {
    return isTauri ? call('remove_exclusion', { path }) : mock.removeExclusion(path)
  },
  /** "Never suggest this again". By finding id: the webview never names a path to act on. */
  ignoreFinding(id: string): Promise<Settings> {
    return isTauri ? call('ignore_finding', { id }) : mock.ignoreFinding(id)
  },
  permissions(): Promise<Permissions> {
    return isTauri ? call('permissions') : mock.permissions()
  },
  async openExternal(target: External): Promise<void> {
    if (isTauri) return call('open_external', { target })
  },
  async openDataFolder(config: boolean): Promise<void> {
    if (isTauri) return call('open_data_folder', { config })
  },
  async revealFinding(id: string): Promise<void> {
    if (isTauri) return call('reveal_finding', { id })
  },
}
