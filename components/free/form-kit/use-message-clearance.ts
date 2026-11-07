'use client'
import { useLayoutEffect, type RefObject } from 'react'

/** How far below the trigger a Field message may start and still push the list down. */
const MESSAGE_REACH = 16

/**
 * An invalid Field keeps its message in view: a list that opens below the trigger
 * moves down under the message instead of covering it. It is placed once on open, not animated.
 */
export function useMessageClearance({ open, enabled, invalid, describedBy, trigger, popup }: {
  open: boolean
  enabled: boolean
  invalid: boolean
  describedBy: string | undefined
  trigger: RefObject<HTMLElement | null>
  popup: RefObject<HTMLElement | null>
}): void {
  useLayoutEffect(() => {
    const pop = popup.current
    if (!open || !enabled || !pop) return
    pop.style.top = ''
    const anchor = trigger.current
    if (!invalid || !describedBy || !anchor) return
    const below = anchor.getBoundingClientRect().bottom
    let reach = 0
    for (const ref of describedBy.split(' ')) {
      const box = anchor.ownerDocument.getElementById(ref)?.getBoundingClientRect()
      if (box && box.height > 0 && box.top >= below - 1 && box.top - below <= MESSAGE_REACH) reach = Math.max(reach, box.bottom - below)
    }
    if (reach > 0) pop.style.top = `calc(100% + var(--feta-space-1-5) + ${Math.round(reach)}px)`
  }, [open, enabled, invalid, describedBy, trigger, popup])
}
