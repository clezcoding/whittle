import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { formatBytes, splitBytes } from '../lib/format'
import { useCountUp } from '../lib/hooks'
import { squarify } from '../lib/treemap'
import type { Finding, Risk } from '../types'

/** Six steps from birch to graphite. Colour is never the only carrier: every chart has labels. */
export const tone = (i: number) => `var(--t${Math.min(i, 5) + 1})`

/* ───────────────────────────── donut ───────────────────────────── */

export interface DonutSlice {
  key: string
  label: string
  value: number
}

export function Donut({ slices, active, onActive, children }: { slices: DonutSlice[]; active: string | null; onActive: (key: string | null) => void; children?: ReactNode }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  let at = 0
  return (
    <div className="donut" data-active={active ?? undefined}>
      <svg viewBox="0 0 100 100" role="img" aria-label="Share of space by category">
        <circle className="donut__track" cx="50" cy="50" r="38" pathLength={100} />
        {slices.map((s, i) => {
          const pct = (s.value / total) * 100
          const gap = slices.length > 1 ? Math.min(0.8, pct / 3) : 0
          const start = at
          at += pct
          return (
            <circle
              key={s.key}
              className={`donut__seg ${active === s.key ? 'is-active' : ''}`}
              cx="50"
              cy="50"
              r="38"
              pathLength={100}
              stroke={tone(i)}
              strokeDasharray={`${Math.max(0, pct - gap)} ${100 - Math.max(0, pct - gap)}`}
              strokeDashoffset={-start}
              style={{ ['--i' as string]: i }}
              onMouseEnter={() => onActive(s.key)}
              onMouseLeave={() => onActive(null)}
            />
          )
        })}
      </svg>
      <div className="donut__center">{children}</div>
    </div>
  )
}

/* ───────────────────────────── risk bar ───────────────────────────── */

const RISK_NAME: Record<Risk, string> = { safe: 'Safe', caution: 'Review', manual: 'Manual' }

export function RiskBar({ risk }: { risk: Record<Risk, { bytes: number; count: number }> }) {
  const total = risk.safe.bytes + risk.caution.bytes + risk.manual.bytes || 1
  const order: Risk[] = ['safe', 'caution', 'manual']
  return (
    <div className="riskbar">
      <div className="riskbar__track" role="img" aria-label={order.map((r) => `${RISK_NAME[r]} ${formatBytes(risk[r].bytes)}`).join(', ')}>
        {order.map((r, i) => (
          <span key={r} className={`riskbar__seg riskbar__seg--${r}`} style={{ width: `${(risk[r].bytes / total) * 100}%`, ['--i' as string]: i }} />
        ))}
      </div>
      <ul className="riskbar__legend">
        {order.map((r) => (
          <li key={r}>
            <i className={`riskbar__key riskbar__key--${r}`} aria-hidden="true" />
            <b>{RISK_NAME[r]}</b>
            <span className="num">{formatBytes(risk[r].bytes)}</span>
            <small>{risk[r].count} item{risk[r].count === 1 ? '' : 's'}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ───────────────────────────── columns ───────────────────────────── */

export function Columns({ data, label }: { data: { key: string; label: string; value: number; hint?: string }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ol className="cols" aria-label={label}>
      {data.map((d, i) => (
        <li key={d.key} title={d.hint} style={{ ['--i' as string]: i }}>
          <span className="num cols__v">{d.value > 0 ? formatBytes(d.value) : '–'}</span>
          <span className="cols__track">
            <span className="cols__bar" style={{ height: `${Math.max(d.value > 0 ? 3 : 0, (d.value / max) * 100)}%` }} />
          </span>
          <span className="cols__l">{d.label}</span>
        </li>
      ))}
    </ol>
  )
}

/* ───────────────────────────── horizontal bars ───────────────────────────── */

export function HBar({ label, sub, value, max, right, onClick, i = 0 }: { label: string; sub?: string; value: number; max: number; right?: ReactNode; onClick?: () => void; i?: number }) {
  const body = (
    <>
      <span className="hbar__label"><b>{label}</b>{sub && <small>{sub}</small>}</span>
      <span className="hbar__track"><span style={{ ['--w' as string]: `${Math.max(1.5, (value / Math.max(1, max)) * 100)}%` }} /></span>
      <span className="num hbar__v">{right ?? formatBytes(value)}</span>
    </>
  )
  return onClick ? (
    <button className="hbar" style={{ ['--i' as string]: i }} onClick={onClick}>{body}</button>
  ) : (
    <div className="hbar" style={{ ['--i' as string]: i }}>{body}</div>
  )
}

/* ───────────────────────────── treemap ───────────────────────────── */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export function Treemap({ findings, onPick, height = 320 }: { findings: Finding[]; onPick: (f: Finding) => void; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const tiles = useMemo(() => squarify(findings.map((f) => ({ value: f.bytes, data: f })), width, height), [findings, width, height])
  const max = Math.max(1, ...findings.map((f) => f.bytes))
  return (
    <div ref={ref} className="treemap" style={{ height }} role="group" aria-label="Every finding as a tile, sized by space">
      {tiles.map((t, i) => {
        const f = t.item.data
        const big = t.w > 110 && t.h > 54
        const mid = t.w > 56 && t.h > 30
        return (
          <button
            key={f.id}
            className={`tile tile--${f.risk}`}
            style={{
              left: t.x,
              top: t.y,
              width: Math.max(0, t.w - 3),
              height: Math.max(0, t.h - 3),
              ['--k' as string]: `${Math.round(10 + 62 * Math.sqrt(f.bytes / max))}%`,
              ['--i' as string]: Math.min(i, 24),
            }}
            title={`${f.title}\n${formatBytes(f.bytes)} · ${RISK_NAME[f.risk]}`}
            aria-label={`${f.title}, ${formatBytes(f.bytes)}, ${RISK_NAME[f.risk]}`}
            onClick={() => onPick(f)}
          >
            {mid && <b>{f.title}</b>}
            {big && <span className="num">{formatBytes(f.bytes)}</span>}
            {big && f.risk !== 'safe' && <em>{RISK_NAME[f.risk]}</em>}
          </button>
        )
      })}
    </div>
  )
}

/* ───────────────────────────── ring ───────────────────────────── */

export function Ring({ fraction, children, size = 64 }: { fraction: number; children?: ReactNode; size?: number }) {
  const f = Math.min(1, Math.max(0, fraction))
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="ring__track" cx="18" cy="18" r="15" />
        <circle className="ring__arc" cx="18" cy="18" r="15" pathLength={100} strokeDasharray={`${f * 100} 100`} />
      </svg>
      <span className="ring__c">{children}</span>
    </span>
  )
}

/* ───────────────────────────── confidence ───────────────────────────── */

export function confidenceWord(c: number): string {
  return c >= 0.9 ? 'High' : c >= 0.6 ? 'Medium' : 'Low'
}

export function ConfidenceMeter({ value }: { value: number }) {
  const v = Math.min(1, Math.max(0, value))
  const on = Math.round(v * 10)
  return (
    <span className="conf" title={`Whittle is ${Math.round(v * 100)}% sure about this match`} role="img" aria-label={`Confidence ${confidenceWord(v)}, ${Math.round(v * 100)} percent`}>
      <span className="conf__ticks" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < on ? 'is-on' : ''} style={{ ['--i' as string]: i }} />)}
      </span>
      <span className="conf__w">{confidenceWord(v)} <small className="num">{Math.round(v * 100)}%</small></span>
    </span>
  )
}

/* ───────────────────────────── stat ───────────────────────────── */

export function Stat({ label, bytes, count, suffix, note, accent = false }: { label: string; bytes?: number; count?: number; suffix?: string; note?: string; accent?: boolean }) {
  const shown = useCountUp(bytes ?? count ?? 0, 800)
  const b = splitBytes(shown)
  return (
    <div className={`stat ${accent ? 'stat--accent' : ''}`}>
      <span className="stat__l">{label}</span>
      <b className="stat__v num">{bytes !== undefined ? <>{b.value}<small>{b.unit}</small></> : <>{Math.round(shown)}{suffix && <small>{suffix}</small>}</>}</b>
      {note && <small className="stat__n">{note}</small>}
    </div>
  )
}
