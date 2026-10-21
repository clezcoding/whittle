import { Curl } from './Curl'
import { formatBytes } from '../lib/format'
import { NAV_HELP } from '../lib/explain'

export type View = 'overview' | 'review' | 'tidy' | 'history' | 'settings'

const ICONS: Record<View, string> = {
  overview: 'M4 12a8 8 0 1 1 16 0M12 12l4-3',
  review: 'M5 7h14M5 12h14M5 17h9',
  tidy: 'M4 6h6l2 2h8v10H4zM9 13h6',
  history: 'M12 7v5l3 2M4 12a8 8 0 1 0 3-6.2M4 5v4h4',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6',
}

const ITEMS: { view: View; label: string }[] = [
  { view: 'overview', label: 'Overview' },
  { view: 'review', label: 'Review' },
  { view: 'tidy', label: 'Tidy a folder' },
  { view: 'history', label: 'History' },
]

export function Sidebar({ view, onView, onAbout, reviewCount, quarantine, version, demo }: {
  view: View
  onView: (v: View) => void
  onAbout: () => void
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
      <ul className="sidebar__list">
        {ITEMS.map((it, i) => (
          <li key={it.view}>
            <button className={`nav ${view === it.view ? 'is-on' : ''}`} title={`${NAV_HELP[it.view]} (⌘${i + 1})`} aria-current={view === it.view ? 'page' : undefined} onClick={() => onView(it.view)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[it.view]} /></svg>
              <span>{it.label}</span>
              {it.view === 'review' && reviewCount > 0 && <b key={reviewCount} className="nav__count">{reviewCount}</b>}
            </button>
          </li>
        ))}
      </ul>
      <div className="sidebar__foot">
        <button className={`nav ${view === 'settings' ? 'is-on' : ''}`} title={`${NAV_HELP.settings} (⌘,)`} aria-current={view === 'settings' ? 'page' : undefined} onClick={() => onView('settings')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS.settings} /></svg>
          <span>Settings</span>
        </button>
        {quarantine > 0 && (
          <button className="sidebar__q" title="Items removed in the last 30 days. You can still undo them." onClick={() => onView('history')}>
            <span>Quarantine</span>
            <b>{formatBytes(quarantine)}</b>
          </button>
        )}
        <button className="sidebar__ver" title="About Whittle" onClick={onAbout}>v{version}{demo ? ' · demo data' : ''}</button>
      </div>
    </nav>
  )
}
