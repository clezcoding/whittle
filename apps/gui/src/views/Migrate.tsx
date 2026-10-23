import { useState } from 'react'
import { CutButton, GhostButton, Check } from '../components/Primitives'
import { ChooseFolder } from '../components/ChooseFolder'
import { formatBytes, shortPath } from '../lib/format'
import type { MigrateOutcome, MigratePreview, MigrateProgress } from '../types'
import { migrateResult, pnpmInstalledResult, type ResultView } from '../lib/results'

interface Props {
  home: string
  /** The folders to search, as saved in settings. Empty means the usual developer folders. */
  roots: string[]
  onRoots: (roots: string[]) => Promise<void>
  preview: () => Promise<MigratePreview>
  installPnpm: () => Promise<string>
  apply: (ids: string[], onProgress: (p: MigrateProgress) => void) => Promise<MigrateOutcome[]>
  onChanged: () => void
  /** Shows the summary dialog when a conversion or the pnpm install finishes. */
  onResult: (r: ResultView) => void
}

export function Migrate({ home, roots, onRoots, preview, installPnpm, apply, onChanged, onResult }: Props) {
  const [found, setFound] = useState<MigratePreview | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<'find' | 'install' | 'convert' | null>(null)
  const [confirmInstall, setConfirmInstall] = useState(false)
  const [progress, setProgress] = useState<MigrateProgress | null>(null)
  const [outcomes, setOutcomes] = useState<MigrateOutcome[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newRoot, setNewRoot] = useState('')
  const [rootError, setRootError] = useState<string | null>(null)

  // Saves the folder list. The old result belongs to the old folders, so it is cleared.
  const changeRoots = async (next: string[]) => {
    setRootError(null)
    try {
      await onRoots(next)
      setFound(null); setOutcomes(null); setPicked(new Set())
      return true
    } catch (e) {
      setRootError(String(e))
      return false
    }
  }

  // A folder picked in Finder is added straight away; there is no second click.
  const addPicked = async (path: string) => {
    if (roots.includes(path)) { setRootError('That folder is already in the list.'); return }
    await changeRoots([...roots, path])
  }

  const addRoot = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = newRoot.trim()
    if (!value || roots.includes(value)) return
    if (await changeRoots([...roots, value])) setNewRoot('')
  }

  const find = async () => {
    setBusy('find'); setError(null); setOutcomes(null); setConfirmInstall(false)
    try {
      const p = await preview()
      setFound(p)
      setPicked(new Set(p.candidates.map((c) => c.id)))
    } catch (e) {
      setError(String(e)); setFound(null)
    } finally {
      setBusy(null)
    }
  }

  // Runs only after the user confirmed the install in the notice below.
  const install = async () => {
    setBusy('install'); setError(null)
    try {
      const version = await installPnpm()
      setFound((f) => (f ? { ...f, pnpm: version } : f))
      setConfirmInstall(false)
      onResult(pnpmInstalledResult(version))
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(null)
    }
  }

  const convert = async () => {
    const ids = (found?.candidates ?? []).filter((c) => picked.has(c.id)).map((c) => c.id)
    if (ids.length === 0) return
    setBusy('convert'); setError(null); setProgress({ done: 0, total: ids.length, project: '' })
    try {
      const results = await apply(ids, setProgress)
      setOutcomes(results)
      setFound(null)
      onChanged()
      onResult(migrateResult(results))
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(null); setProgress(null)
    }
  }

  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (on) next.add(id); else next.delete(id)
      return next
    })

  const selected = found ? found.candidates.filter((c) => picked.has(c.id)) : []
  const canConvert = !!found?.pnpm && selected.length > 0 && busy === null

  return (
    <section className="view migrate" aria-labelledby="h-migrate">
      <header className="view__head"><h1 id="h-migrate">Move projects to pnpm</h1></header>
      <p className="lede">Finds npm and yarn projects and converts their lockfile to pnpm. Each one is checked with <code>pnpm install</code> in a scratch copy first; if the check fails, that project is not touched. The old lockfile goes to quarantine, and every run can be undone in History. The check downloads the project's packages from the npm registry. Nothing else leaves your Mac.</p>

      <section className="migrate__folders" aria-labelledby="h-folders">
        <h2 id="h-folders">Folders to search</h2>
        {roots.length === 0 ? (
          <p className="tree__help">The usual developer folders that exist on this Mac, such as Developer, Projects and Code.</p>
        ) : (
          <ul className="migrate__chips">
            {roots.map((r) => (
              <li key={r}>
                <span>{r}</span>
                <button type="button" className="migrate__remove" aria-label={`Remove ${r}`} disabled={busy !== null} onClick={() => void changeRoots(roots.filter((x) => x !== r))}>×</button>
              </li>
            ))}
          </ul>
        )}
        <form className="pick" onSubmit={(e) => void addRoot(e)}>
          <label htmlFor="new-root" className="sr">Folder to search</label>
          <input id="new-root" value={newRoot} onChange={(e) => setNewRoot(e.target.value)} placeholder="~/Developer" spellCheck={false} autoComplete="off" />
          <ChooseFolder onPick={(p) => void addPicked(p)} disabled={busy !== null} onError={setRootError} />
          <GhostButton type="submit" disabled={!newRoot.trim() || busy !== null}>Add folder</GhostButton>
          {roots.length > 0 && <GhostButton type="button" disabled={busy !== null} onClick={() => void changeRoots([])}>Use the usual folders</GhostButton>}
        </form>
        {rootError && <p className="warn" role="alert">{rootError}</p>}
      </section>

      <form className="pick" onSubmit={(e) => { e.preventDefault(); void find() }}>
        <GhostButton type="submit" disabled={busy !== null}>{busy === 'find' ? 'Looking…' : 'Find projects'}</GhostButton>
      </form>
      <p className="help">Whittle searches the folders above for <code>package-lock.json</code> (npm) and <code>yarn.lock</code> (yarn classic). Projects that already have a <code>pnpm-lock.yaml</code> are left alone. Yarn Berry projects are listed as skipped, because their lockfile format is different.</p>

      <details className="explain">
        <summary>How a conversion works</summary>
        <ol>
          <li><b>Import.</b> pnpm reads the existing lockfile and writes a pnpm lockfile in a scratch folder. Your project is not touched yet.</li>
          <li><b>Verify.</b> <code>pnpm install --frozen-lockfile --ignore-scripts</code> runs on a copy of the project. This downloads the packages from the npm registry, which is the only network use. If the install fails, the conversion stops here and nothing changes.</li>
          <li><b>Swap.</b> The old lockfile moves to quarantine, and the verified <code>pnpm-lock.yaml</code> is written into the project.</li>
          <li><b>Record.</b> Both steps go into the journal. Undo the run in History to restore the old lockfile and remove the new one.</li>
        </ol>
        <p>Your source code, <code>node_modules</code> and <code>package.json</code> are never changed. Run <code>pnpm install</code> in the project afterwards to make pnpm your package manager.</p>
      </details>

      {error && <p className="warn" role="alert">{error}</p>}

      {outcomes && (
        <>
          <div className="notice" role="status"><span>{outcomes.filter((o) => o.ok).length} of {outcomes.length} converted. Undo any run in History.</span></div>
          <div className="tree" aria-label="Results">
            <div className="tree__group">
              <ul>
                {outcomes.map((o) => (
                  <li key={o.project}>
                    <span>{shortPath(o.project, home)}</span>
                    <small>{o.ok ? 'Converted' : 'Skipped'} · {o.message}</small>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      {found && found.candidates.length === 0 && (
        <div className="empty"><p>No npm or yarn projects without a pnpm lockfile were found.</p></div>
      )}

      {found && !found.pnpm && found.candidates.length > 0 && (
        <div className="warn" role="note">
          <p>pnpm is not installed. Whittle needs it to verify each conversion.</p>
          {!confirmInstall ? (
            <GhostButton onClick={() => setConfirmInstall(true)} disabled={busy !== null}>Install pnpm…</GhostButton>
          ) : (
            <p>
              Install pnpm globally with <code>npm install -g pnpm</code>?{' '}
              <GhostButton onClick={() => void install()} disabled={busy !== null}>{busy === 'install' ? 'Installing…' : 'Yes, install'}</GhostButton>{' '}
              <GhostButton onClick={() => setConfirmInstall(false)} disabled={busy !== null}>Cancel</GhostButton>
            </p>
          )}
        </div>
      )}

      {found && found.candidates.length > 0 && (
        <div className="tree" aria-label="Projects to convert">
          <div className="tree__group">
            <h2><span className="tree__folder">Projects</span><em>{found.candidates.length} found</em></h2>
            <ul>
              {found.candidates.map((c) => (
                <li key={c.id}>
                  <span className="migrate__row">
                    <Check checked={picked.has(c.id)} onChange={(on) => toggle(c.id, on)} label={`Convert ${shortPath(c.project, home)}`} />
                    {shortPath(c.project, home)}
                  </span>
                  <small>from {c.lockfile} · {formatBytes(c.bytes)}</small>
                </li>
              ))}
            </ul>
          </div>
          {found.skipped.length > 0 && (
            <div className="tree__group">
              <h2><span className="tree__folder">Skipped</span><em>{found.skipped.length}</em></h2>
              <ul>
                {found.skipped.map((s) => (
                  <li key={s.project}><span>{shortPath(s.project, home)}</span><small>{s.reason}</small></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {found && found.candidates.length > 0 && (
        <footer className={`bar ${busy === 'convert' ? 'bar--running' : ''}`}>
          {busy === 'convert' && progress ? (
            <div className="bar__sum"><span className="bar__n">Converting {progress.done} of {progress.total}{progress.project ? `: ${shortPath(progress.project, home)}` : '…'}</span></div>
          ) : (
            <>
              <div className="bar__sum"><span className="bar__n">{selected.length} of {found.candidates.length} selected</span></div>
              <CutButton disabled={!canConvert} onClick={() => void convert()}>Convert selected</CutButton>
            </>
          )}
        </footer>
      )}
    </section>
  )
}
