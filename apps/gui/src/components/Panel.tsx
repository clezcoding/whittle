import type { ReactNode } from 'react'

/** A titled block on the analysis pages. Same hairline language as the lists. */
export function Panel({ title, note, children, className = '', i = 0 }: { title: string; note?: string; children: ReactNode; className?: string; i?: number }) {
  return (
    <section className={`panel ${className}`} style={{ ['--i' as string]: i }}>
      <header className="panel__head">
        <h2>{title}</h2>
        {note && <small>{note}</small>}
      </header>
      {children}
    </section>
  )
}
