'use client'
import { useMemo, useRef, type RefObject } from 'react'
import type { IconHandle } from './types'

type Handlers = { onPointerEnter?: () => void; onFocus?: () => void; onPointerDown?: () => void; onPointerLeave: () => void; onBlur: () => void }

/** Lets an interactive parent drive an icon (ANIMATION.md §5.2): spread `handlers`, pass `iconRef` with `trigger="none"`. */
export function useIconHover({ on = 'hover' }: { on?: 'hover' | 'click' } = {}): { iconRef: RefObject<IconHandle | null>; handlers: Handlers } {
  const iconRef = useRef<IconHandle>(null)
  const handlers = useMemo(() => {
    const start = (): void => iconRef.current?.startAnimation()
    const stop = (): void => iconRef.current?.stopAnimation()
    return { ...(on === 'click' ? { onPointerDown: start } : { onPointerEnter: start, onFocus: start }), onPointerLeave: stop, onBlur: stop }
  }, [on])
  return { iconRef, handlers }
}
