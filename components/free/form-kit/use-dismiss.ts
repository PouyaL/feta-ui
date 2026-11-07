'use client'
import { useEffect, type RefObject } from 'react'

/** Closes a popover on an outside press. Escape stays with each component's own keyboard handling. */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void): void {
  useEffect(() => {
    if (!open) return
    const onPress = (e: PointerEvent): void => {
      if (e.target instanceof Node && !ref.current?.contains(e.target)) close()
    }
    document.addEventListener('pointerdown', onPress)
    return () => document.removeEventListener('pointerdown', onPress)
  }, [ref, open, close])
}
