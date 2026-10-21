import { useState, type ReactNode } from 'react'
import { GhostButton, Modal, CutButton, Segmented, Stepper, Toggle } from '../components/Primitives'
import { formatBytes, shortPath } from '../lib/format'
import { MODULES } from '../lib/modules'
import type { Appearance, AppInfo, Disposal, External, ModuleId, Motion, Permissions, Settings as SettingsT } from '../types'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  settings: SettingsT
  info: AppInfo
  permissions: Permissions | null
  quarantine: number
  save: SaveState
  onChange: (patch: Partial<SettingsT>) => void
  onAddExclusion: (path: string) => Promise<string | null>
  onRemoveExclusion: (path: string) => void
  onPurge: () => Promise<void>
  onReset: () => Promise<void>
  onRecheck: () => void
  onOpen: (target: External) => void
  onOpenFolder: (config: boolean) => void
  onTour: () => void
  onAbout: () => void
}

function Row({ title, help, children, id }: { title: string; help?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <div className="set__row">
      <div className="set__text">
        <b id={id}>{title}</b>
        {help && <p>{help}</p>}
      </div>
      <div className="set__ctl">{children}</div>
    </div>
  )
}

function Section({ title, lede, children, id }: { title: string; lede?: string; children: ReactNode; id: string }) {
  return (
    <section className="set" aria-labelledby={id}>
      <header>
        <h2 id={id}>{title}</h2>
        {lede && <p>{lede}</p>}
      </header>
      {children}
    </section>
  )
}

export function Settings(p: Props) {
  const s = p.settings
  const [path, setPath] = useState('')
  const [pathError, setPathError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [confirm, setConfirm] = useState<'purge' | 'reset' | null>(null)
  const [working, setWorking] = useState(false)

  const toggleModule = (m: ModuleId) => {
    const next = s.default_modules.includes(m) ? s.default_modules.filter((x) => x !== m) : [...s.default_modules, m]
    if (next.length) p.onChange({ default_modules: next })
  }

  const add = async () => {
    if (!path.trim()) return
    setAdding(true)
    setPathError(null)
    const error = await p.onAddExclusion(path)
    setAdding(false)
    if (error) setPathError(error)
    else setPath('')
  }

  const fda = p.permissions?.full_disk_access
  const days = s.quarantine_days

  return (
    <section className="view settings" aria-labelledby="h-settings">
      <header className="view__head">
        <h1 id="h-settings">Settings</h1>
        <span className={`saved is-${p.save}`} role="status" aria-live="polite">
          {p.save === 'saving' && 'Saving…'}
          {p.save === 'saved' && 'Saved'}
          {p.save === 'error' && 'Not saved'}
        </span>
      </header>
      <p className="lede">Changes apply immediately and are shared with the <code>whittle</code> command line. Nothing here can make Whittle less careful about system files.</p>

      <Section id="s-scan" title="Scanning" lede="What happens when you press Scan.">
        <Row title="Scan these by default" help="You can still switch single items on and off in the Overview.">
          <div className="chips chips--left" role="group" aria-label="Scan by default">
            {MODULES.map((m) => (
              <button key={m.id} className={`chip ${s.default_modules.includes(m.id) ? 'is-on' : ''}`} aria-pressed={s.default_modules.includes(m.id)} title={m.hint} onClick={() => toggleModule(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Section id="s-clean" title="Cleaning" lede="What happens to the things you select.">
        <Row title="Default action" help="Quarantine keeps everything for undo. Trash uses Finder’s Put Back. Free now deletes for good.">
          <Segmented<Disposal>
            label="Default action"
            value={s.default_disposal}
            onChange={(v) => p.onChange({ default_disposal: v })}
            options={[
              { value: 'quarantine', label: `Keep ${days} days`, hint: 'Reversible with Undo.' },
              { value: 'trash', label: 'Trash', hint: 'Reversible with Put Back in Finder.' },
              { value: 'delete', label: 'Free now', hint: 'Cannot be undone.' },
            ]}
          />
        </Row>
        <Row title="Ask before cleaning" help="Shows what will happen, and how much, before anything moves. Deleting for good and “Manual” items always ask.">
          <Toggle checked={s.confirm_before_clean} onChange={(v) => p.onChange({ confirm_before_clean: v })} label="Ask before cleaning" />
        </Row>
      </Section>

      <Section id="s-quarantine" title="Quarantine" lede="Where removed items wait, so that you can change your mind.">
        <Row title="Keep removed items for" help="After this period they can be deleted for good. One day at the least, a year at the most.">
          <Stepper value={days} min={1} max={365} unit={days === 1 ? 'day' : 'days'} label="quarantine period" onChange={(v) => p.onChange({ quarantine_days: v })} />
        </Row>
        <Row title="Delete expired items automatically" help="Checked each time Whittle opens. Nothing younger than the period above is touched.">
          <Toggle checked={s.auto_purge} onChange={(v) => p.onChange({ auto_purge: v })} label="Delete expired items automatically" />
        </Row>
        <Row title="Right now" help={p.quarantine > 0 ? `Quarantine holds ${formatBytes(p.quarantine)}.` : 'Quarantine is empty.'}>
          <GhostButton disabled={p.quarantine === 0} onClick={() => setConfirm('purge')}>Free {p.quarantine > 0 ? formatBytes(p.quarantine) : ''} now</GhostButton>
        </Row>
      </Section>

      <Section id="s-never" title="Never touch" lede="Folders and files Whittle never lists and never changes, even if a rule matches them.">
        <div className="set__add">
          <input
            aria-label="Path to exclude"
            aria-invalid={!!pathError}
            aria-describedby={pathError ? 'path-error' : undefined}
            placeholder="~/Developer/important-project"
            value={path}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            onChange={(e) => { setPath(e.target.value); setPathError(null) }}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
          />
          <GhostButton disabled={!path.trim() || adding} onClick={() => void add()}>Add</GhostButton>
        </div>
        {pathError && <p id="path-error" className="warn" role="alert">{pathError}</p>}
        {s.exclusions.length === 0 ? (
          <p className="set__empty">Nothing is excluded. You can also choose “Never suggest this again” on any item in Review.</p>
        ) : (
          <ul className="set__list" aria-label="Excluded paths">
            {s.exclusions.map((e) => (
              <li key={e}>
                <code title={e}>{shortPath(e, p.info.home)}</code>
                <button className="link" onClick={() => p.onRemoveExclusion(e)} aria-label={`Stop excluding ${e}`}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="s-look" title="Appearance">
        <Row title="Theme">
          <Segmented<Appearance>
            label="Theme"
            value={s.appearance}
            onChange={(v) => p.onChange({ appearance: v })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
          />
        </Row>
        <Row title="Motion" help="System follows macOS “Reduce motion”. Reduced keeps animations to a minimum.">
          <Segmented<Motion>
            label="Motion"
            value={s.motion}
            onChange={(v) => p.onChange({ motion: v })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'full', label: 'Full' },
              { value: 'reduced', label: 'Reduced' },
            ]}
          />
        </Row>
      </Section>

      <Section id="s-access" title="Access" lede="macOS decides what an app may read. Whittle asks for nothing it does not need.">
        <Row
          title="Full Disk Access"
          help={
            fda === true
              ? 'Granted. Whittle can see app data in protected folders.'
              : fda === false
                ? p.permissions?.effect
                : 'Not applicable here, or macOS gave no answer.'
          }
        >
          <div className="set__ctl-row">
            <span className={`status status--${fda === true ? 'ok' : fda === false ? 'off' : 'na'}`}>
              <i aria-hidden="true" />
              {fda === true ? 'Granted' : fda === false ? 'Not granted' : 'Unknown'}
            </span>
            {fda !== true && <GhostButton onClick={() => p.onOpen('full-disk-access')}>Open System Settings</GhostButton>}
            <GhostButton onClick={p.onRecheck}>Check again</GhostButton>
          </div>
        </Row>
      </Section>

      <Section id="s-data" title="Your data" lede="Whittle keeps its own files in two small folders. Nothing is sent anywhere.">
        <Row title="Journal and quarantine" help={<code>{shortPath(p.info.state_dir, p.info.home)}</code>}>
          <GhostButton onClick={() => p.onOpenFolder(false)}>Show in Finder</GhostButton>
        </Row>
        <Row title="Settings and your own rules" help={<code>{shortPath(p.info.config_dir, p.info.home)}</code>}>
          <GhostButton onClick={() => p.onOpenFolder(true)}>Show in Finder</GhostButton>
        </Row>
        <Row title="Welcome tour" help="The short introduction and the permission check.">
          <GhostButton onClick={p.onTour}>Show again</GhostButton>
        </Row>
        <Row title="Reset settings" help="Back to the defaults. Your never-touch list and your history stay.">
          <GhostButton onClick={() => setConfirm('reset')}>Reset…</GhostButton>
        </Row>
      </Section>

      <Section id="s-about" title="About">
        <Row title={`Whittle ${p.info.version}`} help="Open source, MIT or Apache-2.0. Built by clezcoding by Puzzless Foundation.">
          <div className="set__ctl-row">
            <GhostButton onClick={p.onAbout}>About</GhostButton>
            <GhostButton onClick={() => p.onOpen('releases')}>Release notes</GhostButton>
            <GhostButton onClick={() => p.onOpen('issues')}>Report a problem</GhostButton>
          </div>
        </Row>
      </Section>

      {confirm === 'purge' && (
        <Modal title="Free quarantine now?" onClose={() => setConfirm(null)}>
          <p>{formatBytes(p.quarantine)} will be deleted for good. After this, those runs can no longer be undone.</p>
          <div className="modal__actions">
            <GhostButton onClick={() => setConfirm(null)}>Cancel</GhostButton>
            <CutButton disabled={working} onClick={async () => { setWorking(true); try { await p.onPurge() } finally { setWorking(false); setConfirm(null) } }}>Delete permanently</CutButton>
          </div>
        </Modal>
      )}
      {confirm === 'reset' && (
        <Modal title="Reset all settings?" onClose={() => setConfirm(null)}>
          <p>Default action, quarantine period, appearance and the other options go back to how they were at the start. Your never-touch list and your history are kept.</p>
          <div className="modal__actions">
            <GhostButton onClick={() => setConfirm(null)}>Cancel</GhostButton>
            <CutButton disabled={working} onClick={async () => { setWorking(true); try { await p.onReset() } finally { setWorking(false); setConfirm(null) } }}>Reset</CutButton>
          </div>
        </Modal>
      )}
    </section>
  )
}
