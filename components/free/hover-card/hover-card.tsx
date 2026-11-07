'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'
import { PinIcon } from '@fetaui/react/rounded/pin'
import { XIcon } from '@fetaui/react/rounded/x'
import { duration } from '../../motion-tokens'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Floating, Nub, towardTrigger, type Side } from '../popover/floating'
import { Skeleton } from '../skeleton/skeleton'
import styles from './hover-card.module.css'

const OPEN_DELAY = 500
const CLOSE_DELAY = 300
const OFFSET = 12
const LONG_PRESS = 500
const ENTER = { type: 'spring', duration: 0.18, bounce: 0.3 } as const
const EXIT = { duration: duration.close, ease: [0.4, 0, 1, 1] } as const
const NUB_IN = { duration: duration.close, delay: 0.04, ease: [0.23, 1, 0.32, 1] } as const
const SWAP = { duration: 0.2, ease: [0.23, 1, 0.32, 1] } as const
const PIN = { type: 'spring', duration: 0.22, bounce: 0.3 } as const

export type HoverCardProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'title' | 'media'> & {
  /** The link text. The link leads to the same content as the card. */
  label: ReactNode
  /** Card content, on the inset surface. */
  children: ReactNode
  /** Inset at the top of the card, 120 to 140 high. */
  media?: ReactNode
  /** Stats and actions on the tray. */
  tray?: ReactNode
  /** The action at the top of the card. When pinned, it swaps to close. */
  action?: ReactNode
  /** Skeleton of the same shape, then a cross fade with no layout shift. */
  loading?: boolean
  /** Flips when there is no room. Default `top`. */
  side?: Side
  /** A click on the card keeps it open. Default `true`. */
  pinnable?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  defaultPinned?: boolean
  animated?: boolean
}

/** A preview of what sits behind a link: opens after 500 ms, and a click pins it open. */
export function HoverCard({ label, children, media, tray, action, loading = false, side = 'top', pinnable = true, open: controlled, defaultOpen = false, onOpenChange, defaultPinned = false, animated = true, className, ...link }: HoverCardProps) {
  const still = useStill(animated)
  const id = useId()
  const [inner, setInner] = useState(defaultOpen || defaultPinned)
  const [pinned, setPinned] = useState(defaultPinned)
  const open = controlled ?? inner
  const anchor = useRef<HTMLAnchorElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const panel = useRef<HTMLDivElement | null>(null)
  const pressed = useRef(false)
  const swap = still ? { duration: 0 } : SWAP

  function set(next: boolean): void {
    setInner(next)
    onOpenChange?.(next)
    if (!next) setPinned(false)
  }
  const latest = useRef(set)
  useEffect(() => { latest.current = set })

  const clear = (): void => clearTimeout(timer.current)
  const queueOpen = (): void => { clear(); timer.current = setTimeout(() => latest.current(true), OPEN_DELAY) }
  const queueClose = (): void => { clear(); if (!pinned) timer.current = setTimeout(() => latest.current(false), CLOSE_DELAY) }

  useEffect(() => clear, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      latest.current(false)
      if (panel.current?.contains(document.activeElement)) anchor.current?.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function pin(): void {
    if (!pinnable || pinned) return
    setPinned(true)
    const node = panel.current
    if (still || !node) return
    node.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.98)' }, { transform: 'scale(1)' }], { duration: 220 })
  }

  return (
    <>
      <a
        {...link}
        ref={anchor}
        aria-describedby={open ? id : undefined}
        data-open={open ? '' : undefined}
        className={cx(styles.trigger, className)}
        onPointerEnter={(e) => { link.onPointerEnter?.(e); if (e.pointerType === 'mouse') queueOpen() }}
        onPointerLeave={(e) => { link.onPointerLeave?.(e); if (e.pointerType === 'mouse') queueClose() }}
        onPointerDown={(e) => {
          link.onPointerDown?.(e)
          if (e.pointerType === 'mouse') return
          pressed.current = false
          clear()
          timer.current = setTimeout(() => { pressed.current = true; latest.current(true); setPinned(true) }, LONG_PRESS)
        }}
        onPointerUp={(e) => { link.onPointerUp?.(e); if (e.pointerType !== 'mouse') clear() }}
        onPointerCancel={(e) => { link.onPointerCancel?.(e); clear() }}
        onClick={(e) => { link.onClick?.(e); if (pressed.current) { e.preventDefault(); pressed.current = false } }}
        onContextMenu={(e) => { if (pressed.current) e.preventDefault() }}
        onFocus={(e) => { link.onFocus?.(e); if (e.target.matches(':focus-visible')) queueOpen() }}
        onBlur={(e) => {
          link.onBlur?.(e)
          if (e.relatedTarget instanceof Node && panel.current?.contains(e.relatedTarget)) return
          queueClose()
        }}
      >
        {label}
      </a>
      <Floating anchor={anchor} open={open} side={side} offset={OFFSET} nubInset={26} className={styles.host}>
        {(placed) => (
          <motion.div
            key="card"
            ref={panel}
            id={id}
            role="group"
            aria-label="Preview"
            data-still={still ? '' : undefined}
            className={styles.card}
            onPointerEnter={clear}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') queueClose() }}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) queueClose() }}
            onClick={pin}
            initial={still ? false : { opacity: 0, scale: 0.96, ...towardTrigger(placed, 4) }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.98, transition: EXIT }}
            transition={ENTER}
          >
            <div className={styles.body}>
              <AnimatePresence initial={false}>
                {loading ? (
                  <motion.div key="skeleton" className={styles.skeleton} role="status" aria-label="Loading" exit={{ opacity: 0 }} transition={swap}>
                    <span className={styles.row}><Skeleton shape="circle" width={40} height={40} animated={animated} /><span className={styles.stack}><Skeleton width="40%" height={12} animated={animated} /><Skeleton width="60%" height={8} animated={animated} /></span></span>
                    <Skeleton width="100%" height={8} animated={animated} />
                    <Skeleton width="72%" height={8} animated={animated} />
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <motion.div className={styles.content} animate={{ opacity: loading ? 0 : 1 }} initial={false} transition={swap} aria-hidden={loading || undefined}>
                {pinned ? <span className={styles.close}><IconButton variant="ghost" size="sm" label="Close" animated={animated} icon={<XIcon />} onClick={(e) => { e.stopPropagation(); set(false) }} /></span> : action ? <span className={styles.close}>{action}</span> : null}
                {media ? <div className={styles.media}>{media}</div> : null}
                {children}
                <AnimatePresence initial={false}>
                  {pinned ? <motion.div key="pinned" className={styles.pinned} initial={still ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={PIN}><PinIcon size={14} />Pinned open  ·  Esc to close</motion.div> : null}
                </AnimatePresence>
              </motion.div>
            </div>
            {tray ? <div className={styles.tray}>{tray}</div> : null}
            <motion.span className={styles.nubFade} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={NUB_IN}><Nub /></motion.span>
          </motion.div>
        )}
      </Floating>
    </>
  )
}
