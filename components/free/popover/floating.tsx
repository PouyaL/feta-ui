'use client'
import { AnimatePresence } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactElement, type RefObject } from 'react'
import { cx } from '../motion-kit/motion-kit'
import styles from './floating.module.css'

export type Side = 'top' | 'bottom' | 'left' | 'right'
export type Align = 'start' | 'center' | 'end'

const EDGE = 8
const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
const MOBILE_QUERY = '(max-width: 640px)'

/** Same rule as the tokens: `data-platform` first, then the viewport, unless the page says Web. */
export function isMobileAt(node: Element | null): boolean {
  if (typeof document === 'undefined') return false
  const platform = node?.closest('[data-platform]')?.getAttribute('data-platform')
  if (platform === 'mobile') return true
  if (document.documentElement.getAttribute('data-platform') === 'web') return false
  return window.matchMedia(MOBILE_QUERY).matches
}

/** Start values for a panel that moves `px` toward its trigger as it opens. */
export const towardTrigger = (side: Side, px: number): { x: number; y: number } => ({
  x: side === 'left' ? px : side === 'right' ? -px : 0,
  y: side === 'top' ? px : side === 'bottom' ? -px : 0,
})

type Spot = { left: number; top: number; side: Side; nub: number }

function measure(anchor: DOMRect, width: number, height: number, side: Side, align: Align, offset: number, pin: number | undefined, inset: number): Spot {
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  const fits = (s: Side): boolean =>
    s === 'top' ? anchor.top - offset - height >= EDGE
    : s === 'bottom' ? anchor.bottom + offset + height <= vh - EDGE
    : s === 'left' ? anchor.left - offset - width >= EDGE
    : anchor.right + offset + width <= vw - EDGE
  const placed = fits(side) || !fits(OPPOSITE[side]) ? side : OPPOSITE[side]
  const vertical = placed === 'top' || placed === 'bottom'
  const start = vertical ? anchor.left : anchor.top
  const length = vertical ? anchor.width : anchor.height
  const size = vertical ? width : height
  const limit = vertical ? vw : vh
  const center = start + length / 2
  const wanted = pin !== undefined ? center - pin : align === 'start' ? start : align === 'end' ? start + length - size : center - size / 2
  const along = Math.max(EDGE, Math.min(wanted, limit - EDGE - size))
  const across = placed === 'top' ? anchor.top - offset - height : placed === 'bottom' ? anchor.bottom + offset : placed === 'left' ? anchor.left - offset - width : anchor.right + offset
  const nub = Math.max(inset, Math.min(center - along, size - inset))
  return vertical ? { left: along, top: across, side: placed, nub } : { left: across, top: along, side: placed, nub }
}

export type FloatingProps = {
  anchor: RefObject<HTMLElement | null>
  open: boolean
  side?: Side
  align?: Align
  /** Gap to the trigger. */
  offset?: number
  /** Keeps the nub this far from the panel's start edge, instead of using `align`. */
  pin?: number
  /** Closest the nub centre gets to a corner. */
  nubInset?: number
  /** Unmounts at once, with no exit. */
  instant?: boolean
  /** Fires when the page scrolls under an open panel. */
  onScrollAway?: () => void
  className?: string | undefined
  /** Receives the side after flipping, so the panel can start from the right direction. */
  children: (side: Side) => ReactElement
}

/**
 * An anchored layer in the browser's top layer, so nothing clips it and it sits above modals. It stays
 * in the DOM next to the trigger and inherits theme, platform and `ComponentAnimation` from there.
 * The first pass is hidden and only measures; the panel then mounts knowing its final side.
 */
export function Floating({ anchor, open, side = 'bottom', align = 'center', offset = 8, pin, nubInset = 24, instant, onScrollAway, className, children }: FloatingProps) {
  const [present, setPresent] = useState(false)
  const [placed, setPlaced] = useState<Side | null>(null)
  const host = useRef<HTMLDivElement>(null)
  if (open && !present) setPresent(true)
  if (!open && present && (instant || placed === null)) { setPresent(false); setPlaced(null) }
  const scrollAway = useRef(onScrollAway)
  useEffect(() => { scrollAway.current = onScrollAway })

  useLayoutEffect(() => {
    const node = host.current
    if (!present || !node) return
    if (!node.matches(':popover-open')) node.showPopover()
    const place = (): void => {
      const trigger = anchor.current
      if (!trigger) return
      const spot = measure(trigger.getBoundingClientRect(), node.offsetWidth, node.offsetHeight, side, align, offset, pin, nubInset)
      const vertical = spot.side === 'top' || spot.side === 'bottom'
      node.style.left = `${Math.round(spot.left)}px`
      node.style.top = `${Math.round(spot.top)}px`
      node.style.setProperty('--nub-at', `${Math.round(spot.nub)}px`)
      node.style.setProperty('--origin-x', vertical ? `${Math.round(spot.nub)}px` : spot.side === 'left' ? '100%' : '0%')
      node.style.setProperty('--origin-y', vertical ? (spot.side === 'top' ? '100%' : '0%') : `${Math.round(spot.nub)}px`)
      node.setAttribute('data-side', spot.side)
      setPlaced(spot.side)
    }
    place()
    let frame = 0
    const queue = (): void => { cancelAnimationFrame(frame); frame = requestAnimationFrame(place) }
    const scrolled = (e: Event): void => {
      if (e.target instanceof Node && node.contains(e.target)) return
      if (scrollAway.current) scrollAway.current()
      else queue()
    }
    const sized = new ResizeObserver(queue)
    sized.observe(node)
    window.addEventListener('resize', queue)
    window.addEventListener('scroll', scrolled, { capture: true, passive: true })
    return () => {
      cancelAnimationFrame(frame)
      sized.disconnect()
      window.removeEventListener('resize', queue)
      window.removeEventListener('scroll', scrolled, { capture: true })
    }
  }, [present, anchor, side, align, offset, pin, nubInset])

  if (!present) return null

  return (
    <div ref={host} popover="manual" data-mobile={isMobileAt(anchor.current) ? '' : undefined} className={cx(styles.floating, className)}>
      {placed === null
        ? <div className={styles.measure} aria-hidden="true">{children(side)}</div>
        : <AnimatePresence onExitComplete={() => { setPresent(false); setPlaced(null) }}>{open ? children(placed) : null}</AnimatePresence>}
    </div>
  )
}

const NUB_PATH = 'M16 0C13 0 11.2 1.6 9.6 4.6 9 5.8 8.6 6.6 8 6.6S7 5.8 6.4 4.6C4.8 1.6 3 0 0 0Z'

/** The small point on an anchored panel, in the panel's fill. It stays over the trigger's centre. */
export function Nub({ className }: { className?: string }) {
  return (
    <svg className={cx(styles.nub, className)} width="16" height="8" viewBox="0 0 16 8" aria-hidden="true">
      <path d={NUB_PATH} />
      <path d={NUB_PATH} className={styles.wash} />
    </svg>
  )
}
