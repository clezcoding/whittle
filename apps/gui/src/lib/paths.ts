/** Turns `~/x` into `/Users/me/x` and drops trailing slashes. Mirrors `Context::expand` in the core. */
export function expandPath(raw: string, home: string): string {
  const p = raw.trim().replace(/\/+$/, '')
  if (p === '~') return home
  return p.startsWith('~/') ? home + p.slice(1) : p
}

/** True if `path` is inside an excluded path, or contains one (removing it would take that along). */
export function isExcluded(path: string, exclusions: string[], home: string): boolean {
  return exclusions.some((raw) => {
    const e = expandPath(raw, home)
    return e !== '' && (path === e || path.startsWith(e + '/') || e.startsWith(path + '/'))
  })
}

/** Errors from the Rust side arrive as plain strings, from the demo as Error objects. */
export function errorText(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e)
  return text.replace(/^Error:\s*/, '')
}
