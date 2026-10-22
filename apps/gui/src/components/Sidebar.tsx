import { Curl } from './Curl'
import { formatBytes } from '../lib/format'
import { NAV_HELP } from '../lib/explain'

export type View = 'overview' | 'review' | 'tidy' | 'history' | 'insights' | 'apps' | 'rules' | 'quarantine' | 'settings'

const ICONS: Record<View, string> = {
  overview: 'M4 12a8 8 0 1 1 16 0M12 12l4-3',
  review: 'M5 7h14M5 12h14M5 17h9',
  tidy: 'M4 6h6l2 2h8v10H4zM9 13h6',
  history: 'M12 7v5l3 2M4 12a8 8 0 1 0 3-6.2M4 5v4h4',
  insights: 'M5 19v-6M12 19V5M19 19v-9',
  apps: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  rules: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  quarantine: 'M4 7h16v3H4zM6 10v9h12v-9M10 14h4',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6',
}

const LABEL: Record<View, string> = {
  overview: 'Overview',
  review: 'Review',
  tidy: 'Tidy a folder',
  history: 'History',
  insights: 'Insights',
  apps: 'Apps',
  rules: 'Rules',
  quarantine: 'Quarantine',
  settings: 'Settings',
}

/** The order of the sidebar, top to bottom. ⌘1 … ⌘8 follow it. */
export const VIEW_ORDER: View[] = ['overview', 'review', 'tidy', 'history', 'insights', 'apps', 'rules', 'quarantine']

const GROUPS: { label: string | null; items: View[] }[] = [
  { label: null, items: ['overview', 'review', 'tidy', 'history'] },
  { label: 'Explore', items: ['insights', 'apps', 'rules', 'quarantine'] },
]

export function Sidebar({ view, onView, onAbout, onPalette, reviewCount, quarantine, version, demo }: {
  view: View
  onView: (v: View) => void
  onAbout: () => void
  onPalette: () => void
  reviewCount: number
  quarantine: number
  version: string
  demo: boolean
}) {
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="sidebar__brand" data-tauri-drag-region>
        <Curl className="sidebar__mark" />
        <span className="sidebar__word">whittle</span>
      </div>
      <button className="sidebar__search" title="Search commands, findings and rules (⌘K)" onClick={onPalette}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
        <span>Search</span>
        <kbd>⌘K</kbd>
      </button>
      {GROUPS.map((g) => (
        <div key={g.label ?? 'main'} className="sidebar__group">
          {g.label && <span className="sidebar__label">{g.label}</span>}
          <ul className="sidebar__list">
            {g.items.map((v) => (
              <li key={v}>
                <button className={`nav ${view === v ? 'is-on' : ''}`} title={`${NAV_HELP[v]} (⌘${VIEW_ORDER.indexOf(v) + 1})`} aria-current={view === v ? 'page' : undefined} onClick={() => onView(v)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[v]} /></svg>
                  <span>{LABEL[v]}</span>
                  {v === 'review' && reviewCount > 0 && <b key={reviewCount} className="nav__count">{reviewCount}</b>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="sidebar__foot">
        <button className={`nav ${view === 'settings' ? 'is-on' : ''}`} title={`${NAV_HELP.settings} (⌘,)`} aria-current={view === 'settings' ? 'page' : undefined} onClick={() => onView('settings')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS.settings} /></svg>
          <span>Settings</span>
        </button>
        {quarantine > 0 && (
          <button className="sidebar__q" title="Items removed in the last 30 days. You can still undo them." onClick={() => onView('quarantine')}>
            <span>Quarantine</span>
            <b>{formatBytes(quarantine)}</b>
          </button>
        )}
        <button className="sidebar__ver" title="About Whittle" onClick={onAbout}>v{version}{demo ? ' · demo data' : ''}</button>
      </div>
    </nav>
  )
}
