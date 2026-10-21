import { useMemo, useState } from 'react'
import { ApplyBar } from '../components/Progress'
import { CutButton, GhostButton } from '../components/Primitives'
import { formatBytes, shortPath } from '../lib/format'
import { TIDY_REASON, tidyFolderHelp } from '../lib/explain'
import type { ApplyProgress, ApplyRun, TidyEntry } from '../types'

interface Props {
  home: string
  preview: (dir: string) => Promise<TidyEntry[]>
  apply: (dir: string, onProgress: (p: ApplyProgress) => void) => Promise<void>
}

export function Tidy({ home, preview, apply }: Props) {
  const [dir, setDir] = useState('~/Downloads')
  const [entries, setEntries] = useState<TidyEntry[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)
  const [moving, setMoving] = useState<ApplyRun | null>(null)

  const run = async () => {
    setBusy(true); setError(null); setDone(null)
    try { setEntries(await preview(dir)) } catch (e) { setError(String(e)); setEntries(null) } finally { setBusy(false) }
  }
  const go = async () => {
    setBusy(true); setError(null)
    const startedAt = Date.now()
    setMoving({ done: 0, total: entries?.length ?? 0, bytes_done: 0, bytes_total: 0, fraction: 0, title: '', startedAt })
    try { await apply(dir, (p) => setMoving({ ...p, startedAt })); setDone(entries?.length ?? 0); setEntries(null) } catch (e) { setError(String(e)) } finally { setBusy(false); setMoving(null) }
  }

  const groups = useMemo(() => {
    const root = dir.replace(/^~/, home).replace(/\/$/, '')
    const m = new Map<string, TidyEntry[]>()
    for (const e of entries ?? []) {
      const folder = e.to.slice(0, e.to.lastIndexOf('/')).replace(root + '/', '')
      m.set(folder, [...(m.get(folder) ?? []), e])
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [entries, dir, home])

  return (
    <section className="view tidy" aria-labelledby="h-tidy">
      <header className="view__head"><h1 id="h-tidy">Tidy a folder</h1></header>
      <p className="lede">Sorts loose files into sub-folders by type and date. Screenshots go by month. Sub-folders, hidden files, app bundles and fresh downloads are never touched. You see every move first, and you can undo it.</p>

      <form className="pick" onSubmit={(e) => { e.preventDefault(); void run() }}>
        <label htmlFor="dir" className="sr">Folder</label>
        <input id="dir" value={dir} onChange={(e) => setDir(e.target.value)} spellCheck={false} autoComplete="off" />
        <GhostButton type="submit" disabled={busy || !dir.trim()}>{busy && !entries ? 'Looking…' : 'Preview'}</GhostButton>
      </form>

      {error && <p className="warn" role="alert">{error}</p>}
      {done !== null && <div className="notice" role="status"><span>Moved {done} file(s). You can undo this in History.</span></div>}
      {entries && entries.length === 0 && <div className="empty"><p>{shortPath(dir.replace(/^~/, home), home)} is already tidy.</p></div>}

      {entries && entries.length > 0 && (
        <>
          <div className="tree" aria-label="Planned moves">
            {groups.map(([folder, items], gi) => (
              <div className="tree__group" key={folder} style={{ ['--i' as string]: gi }}>
                <h2><span className="tree__folder">{folder}/</span><em>{items.length} file{items.length > 1 ? 's' : ''}</em></h2>
                <p className="tree__help">{tidyFolderHelp(folder)}</p>
                <ul>
                  {items.slice(0, 6).map((e) => (
                    <li key={e.to}><span>{e.from.slice(e.from.lastIndexOf('/') + 1)}</span><small title={TIDY_REASON[e.reason] ?? e.reason}>{TIDY_REASON[e.reason] ?? e.reason} · {formatBytes(e.bytes)}</small></li>
                  ))}
                  {items.length > 6 && <li className="more">+ {items.length - 6} more</li>}
                </ul>
              </div>
            ))}
          </div>
          <footer className={`bar ${moving ? 'bar--running' : ''}`}>
            {moving ? (
              <ApplyBar run={moving} label="Moving files" />
            ) : (
              <>
            <div className="bar__sum"><span className="bar__n">{entries.length} files into {groups.length} folders</span></div>
            <CutButton disabled={busy} onClick={() => void go()}>{busy ? 'Moving…' : 'Move files'}</CutButton>
              </>
            )}
          </footer>
        </>
      )}
    </section>
  )
}
