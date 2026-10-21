import { useId } from 'react'
import { CURL_BODY, CURL_CENTER, CURL_CUT, CURL_STROKE } from '../lib/curl-geometry'

interface Props {
  /** 0 = nothing unrolled yet, 1 = the whole shaving. */
  progress?: number
  /** Slow breathing while nothing happens (off under reduced motion). */
  idle?: boolean
  className?: string
}

/**
 * The Whittle shaving. It is the logo, and it is the progress indicator: while a scan runs the
 * ribbon unrolls along its own centerline (a mask driven by stroke-dashoffset).
 */
export function Curl({ progress = 1, idle = false, className = '' }: Props) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 512 512" className={`curl ${idle ? 'curl--idle' : ''} ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <mask id={`m${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <path
            d={CURL_CENTER}
            fill="none"
            stroke="#fff"
            strokeWidth={CURL_STROKE}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - Math.min(1, Math.max(0, progress))}
            className="curl__reveal"
          />
        </mask>
      </defs>
      <g mask={`url(#m${id})`}>
        <path d={CURL_BODY} fill="currentColor" />
      </g>
      <path d={CURL_CUT} fill="var(--cut)" />
    </svg>
  )
}
