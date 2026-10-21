import { useEffect, useRef, useState } from 'react'

/** The Motion setting wins over the system switch when it is not "system". */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  const chosen = document.documentElement.dataset.motion
  if (chosen === 'reduced') return true
  if (chosen === 'full') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Animates a number toward `target`. Instant under reduced motion. */
export function useCountUp(target: number, ms = 900): number {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (prefersReducedMotion() || from.current === target) {
      from.current = target
      setValue(target)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms)
      const eased = 1 - Math.pow(1 - p, 4)
      setValue(a + (target - a) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      from.current = target
    }
  }, [target, ms])
  return value
}

/** Current time, refreshed 10x a second while `active`. Drives the live seconds counter. */
export function useNow(active: boolean, every = 100): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const t = window.setInterval(() => setNow(Date.now()), every)
    return () => window.clearInterval(t)
  }, [active, every])
  return now
}
