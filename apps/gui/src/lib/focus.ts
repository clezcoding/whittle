import { useEffect } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * Dialog behaviour shared by modals, the inspector and the command palette: focus moves inside,
 * Tab stays inside, Escape closes, and focus returns to where it came from.
 * `initial` is a selector for the control that gets focus first.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, onClose: () => void, initial?: string) {
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const box = ref.current
    if (initial) box?.querySelector<HTMLElement>(initial)?.focus()
    if (!box?.contains(document.activeElement)) box?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      } else if (e.key === 'Tab' && box) {
        const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)]
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      before?.focus?.()
    }
    // onClose is intentionally not a dependency: callers pass fresh closures every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
