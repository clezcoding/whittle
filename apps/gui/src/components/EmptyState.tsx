import type { ReactNode } from 'react'
import { Curl } from './Curl'

/** The same curl as the logo, half unrolled, with a sentence and one way forward. */
export function EmptyState({ title, text, children, progress = 0.55 }: { title: string; text: string; children?: ReactNode; progress?: number }) {
  return (
    <div className="blank">
      <Curl className="blank__curl" progress={progress} idle />
      <h2>{title}</h2>
      <p>{text}</p>
      {children && <div className="blank__actions">{children}</div>}
    </div>
  )
}
