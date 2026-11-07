'use client'
import { motion } from 'motion/react'
import { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type HTMLAttributes, type MouseEvent, type PointerEvent, type ReactElement, type ReactNode, type Ref } from 'react'
import { LockIcon } from '@fetaui/react/rounded/lock'
import { Kbd } from '../kbd/kbd'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Floating, Nub, isMobileAt, towardTrigger, type Side } from '../popover/floating'
import { Skeleton } from '../skeleton/skeleton'
import styles from './tooltip.module.css'

const HOVER_DELAY = 600
const RICH_DELAY = 400
const SKIP_WINDOW = 300
const HIDE_DELAY = 100
const LONG_PRESS = 500
const RELEASE_HOLD = 1500
const WEB_GAP = 6
const MOBILE_GAP = 8
const NUB_HEIGHT = 7
const RICH_PIN = 30

const SHOW = { duration: 0.14, ease: [0.23, 1, 0.32, 1] } as const
const HIDE = { duration: 0.09, ease: [0.4, 0, 1, 1] } as const
const GLIDE = { type: 'spring', stiffness: 500, damping: 36 } as const
const TAB = { duration: 0.2, ease: [0.23, 1, 0.32, 1] } as const
const TRAY = { ...TAB, delay: 0.04 } as const

// One tooltip is open at a time across the page, which is what lets a neighbour take over.
let active: { owner: string; close: () => void; center: number } | null = null
let lastClosedAt = -Infinity

type TriggerProps = HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }

const assign = (ref: Ref<HTMLElement> | undefined, node: HTMLElement | null): void => {
  if (typeof ref === 'function') ref(node)
  else if (ref) ref.current = node
}

type Shared = {
  /** The one element that shows it. Wrap a disabled button in a focusable span. */
  children: ReactElement<TriggerProps>
  /** Flips near an edge. Default `top`. */
  side?: Side
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Milliseconds of hover before it shows. */
  delay?: number
  /** Set when the tooltip is the trigger's name, as on an icon only button. */
  labels?: boolean
  disabled?: boolean
  /** `false` turns off show, hide and glide. Status motion stays. */
  animated?: boolean
}

function useTip({ children, open: controlled, defaultOpen = false, onOpenChange, delay, labels, disabled, animated }: Shared & { delay: number }, stayForFocus: boolean) {
  const still = useStill(animated)
  const id = useId()
  const [inner, setInner] = useState(defaultOpen)
  const [instant, setInstant] = useState(false)
  const [glideFrom, setGlideFrom] = useState(0)
  const open = !disabled && (controlled ?? inner)
  const anchor = useRef<HTMLElement | null>(null)
  const panel = useRef<HTMLDivElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const press = useRef<Animation | null>(null)
  const touching = useRef(false)
  const shown = useRef(open)
  useEffect(() => { shown.current = open })

  const set = useCallback((next: boolean): void => {
    setInner(next)
    onOpenChange?.(next)
  }, [onOpenChange])

  const clear = (): void => clearTimeout(timer.current)

  /** Handing over to a neighbour: gone at once, with no fade. */
  const close = useCallback((): void => {
    clearTimeout(timer.current)
    setInstant(true)
    set(false)
  }, [set])

  const show = useCallback((): void => {
    clearTimeout(timer.current)
    if (disabled) return
    const box = anchor.current?.getBoundingClientRect()
    const center = box ? box.left + box.width / 2 : 0
    // A neighbour inside the window takes the spot, and the panel glides over from the old one.
    if (active && active.owner !== id) {
      setGlideFrom(active.center - center)
      active.close()
    } else setGlideFrom(0)
    active = { owner: id, close, center }
    setInstant(false)
    set(true)
  }, [close, disabled, id, set])

  const hide = useCallback((): void => {
    clearTimeout(timer.current)
    setInstant(false)
    // Only a tooltip that really showed opens the skip window, and one already closed has nothing to report.
    if (active?.owner === id) {
      active = null
      lastClosedAt = performance.now()
    } else if (!shown.current) return
    set(false)
  }, [id, set])

  const queueShow = (): void => {
    clear()
    const inWindow = active !== null || performance.now() - lastClosedAt < SKIP_WINDOW
    if (inWindow) show()
    else timer.current = setTimeout(show, delay)
  }
  const queueHide = (wait: number): void => {
    clear()
    timer.current = setTimeout(hide, wait)
  }

  useEffect(() => () => {
    clearTimeout(timer.current)
    press.current?.cancel()
    if (active?.owner === id) active = null
  }, [id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (panel.current?.contains(document.activeElement)) anchor.current?.focus({ preventScroll: true })
      hide()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, hide])

  const child = children.props
  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => { anchor.current = node; assign(child.ref, node) },
    'aria-describedby': !labels && open ? cx(child['aria-describedby'], id) : child['aria-describedby'],
    'aria-labelledby': labels && open ? id : child['aria-labelledby'],
    onPointerEnter: (e: PointerEvent<HTMLElement>) => { child.onPointerEnter?.(e); if (e.pointerType === 'mouse') queueShow() },
    onPointerLeave: (e: PointerEvent<HTMLElement>) => { child.onPointerLeave?.(e); if (e.pointerType === 'mouse') queueHide(HIDE_DELAY) },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      child.onPointerDown?.(e)
      if (e.pointerType === 'mouse') { clear(); hide(); return }
      touching.current = true
      if (!still) press.current = e.currentTarget.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }], { duration: LONG_PRESS, easing: 'linear', fill: 'forwards' })
      timer.current = setTimeout(show, LONG_PRESS)
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      child.onPointerUp?.(e)
      if (!touching.current) return
      touching.current = false
      press.current?.cancel()
      if (open) queueHide(RELEASE_HOLD)
      else clear()
    },
    onPointerCancel: (e: PointerEvent<HTMLElement>) => {
      child.onPointerCancel?.(e)
      touching.current = false
      press.current?.cancel()
      clear()
    },
    onContextMenu: (e: MouseEvent<HTMLElement>) => { child.onContextMenu?.(e); if (touching.current) e.preventDefault() },
    onFocus: (e: FocusEvent<HTMLElement>) => { child.onFocus?.(e); if (e.target.matches(':focus-visible')) show() },
    onBlur: (e: FocusEvent<HTMLElement>) => {
      child.onBlur?.(e)
      if (stayForFocus && e.relatedTarget instanceof Node && panel.current?.contains(e.relatedTarget)) return
      queueHide(0)
    },
  } as TriggerProps)

  const hoverProps = {
    onPointerEnter: clear,
    onPointerLeave: (e: PointerEvent<HTMLDivElement>) => { if (e.pointerType === 'mouse') queueHide(HIDE_DELAY) },
    onBlur: (e: FocusEvent<HTMLDivElement>) => { if (stayForFocus && !e.currentTarget.contains(e.relatedTarget)) queueHide(0) },
  }

  return { still, id, open, instant, glideFrom, anchor, panel, trigger, hoverProps, hide, gap: () => isMobileAt(anchor.current) ? MOBILE_GAP : WEB_GAP }
}

export type TooltipProps = Shared & {
  /** The label. Keep it short: there is no interactive content in a plain tooltip. */
  content: ReactNode
  /** Default `ink` for dense tool UI. `soft` sits with trays. */
  tone?: 'ink' | 'soft'
  /** Keys shown after the label, like `['⌘', 'S']`. */
  shortcut?: string[]
  /** Lead icon, 14 px. Pass `true` for the lock. */
  icon?: ReactNode | true
}

/** A short label on hover, focus or long press. Shows after 600 ms, then at once for neighbours. */
export function Tooltip({ content, tone = 'ink', shortcut, icon, side = 'top', delay = HOVER_DELAY, ...shared }: TooltipProps) {
  const tip = useTip({ ...shared, delay }, false)
  const lead = icon === true ? <LockIcon /> : icon
  const body = (
    <>
      {lead ? <span className={styles.lead}>{lead}</span> : null}
      <span className={styles.label}>{content}</span>
      {shortcut ? <span className={styles.keys}>{shortcut.map((key) => <Kbd key={key} size="sm" variant={tone === 'ink' ? 'inverse' : 'outline'} animated={shared.animated ?? true}>{key}</Kbd>)}</span> : null}
    </>
  )
  return (
    <>
      {tip.trigger}
      <Floating anchor={tip.anchor} open={tip.open} instant={tip.instant} side={side} offset={tip.gap() + NUB_HEIGHT} nubInset={18} onScrollAway={tip.hide}>
        {(placed) => (
          <motion.div
            key="tip"
            ref={tip.panel}
            id={tip.id}
            role="tooltip"
            data-tone={tone}
            data-still={tip.still ? '' : undefined}
            className={styles.tip}
            {...tip.hoverProps}
            initial={tip.still ? false : { opacity: 0, scale: 0.96, ...(tip.glideFrom ? { x: tip.glideFrom, opacity: 1, scale: 1 } : towardTrigger(placed, 4)) }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={tip.still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: HIDE }}
            transition={tip.glideFrom ? GLIDE : SHOW}
          >
            {tone === 'soft' ? <span className={styles.card}>{body}</span> : body}
            <Nub />
          </motion.div>
        )}
      </Floating>
    </>
  )
}

export type TooltipRichProps = Shared & {
  title: ReactNode
  /** The tab's lead: an icon, or a mark from Badge. */
  icon?: ReactNode
  description?: ReactNode
  /** Footer keys on the tray, with `Esc to close` at the other end. */
  shortcut?: string[]
  /** Footer actions on the tray. At most one main action. */
  actions?: ReactNode
  /** Skeleton lines in the card. The swap to content fades. */
  loading?: boolean
}

/** A tooltip in the toast tab shape: a title tab, one line of help and an optional action. */
export function TooltipRich({ title, icon, description, shortcut, actions, loading = false, side = 'top', delay = RICH_DELAY, ...shared }: TooltipRichProps) {
  const tip = useTip({ ...shared, delay }, true)
  // Top and bottom pin the nub under the tab. Left and right center the panel on the trigger.
  const vertical = side === 'top' || side === 'bottom'
  return (
    <>
      {tip.trigger}
      <Floating anchor={tip.anchor} open={tip.open} instant={tip.instant} side={side} offset={tip.gap() + NUB_HEIGHT} {...(vertical ? { pin: RICH_PIN } : {})} nubInset={vertical ? RICH_PIN : 18} onScrollAway={tip.hide} className={styles.richHost}>
        {(placed) => (
          <motion.div
            key="rich"
            ref={tip.panel}
            id={tip.id}
            role="tooltip"
            data-still={tip.still ? '' : undefined}
            className={styles.rich}
            {...tip.hoverProps}
            initial={tip.still ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: tip.still ? { duration: 0 } : HIDE }}
            transition={SHOW}
          >
            <motion.div className={styles.tab} initial={tip.still ? false : { y: placed === 'top' ? 4 : -4 }} animate={{ y: 0 }} transition={TAB}>
              {/* tabIndex -1 gives the icon a parent to follow, or Chromium makes the bare svg a tab stop. */}
              <span className={styles.tabIcon} tabIndex={-1}>{icon}</span>
              <span className={styles.tabTitle}>{title}</span>
              <span className={styles.fillet} aria-hidden="true" />
            </motion.div>
            <motion.div className={styles.tray} initial={tip.still ? false : { opacity: 0, y: -6, scaleY: 0.92 }} animate={{ opacity: 1, y: 0, scaleY: 1 }} transition={TRAY}>
              <div className={styles.richCard}>
                {loading
                  ? <span className={styles.lines} aria-label="Loading" role="status"><Skeleton width="100%" height={8} animated={shared.animated ?? true} /><Skeleton width="56%" height={8} animated={shared.animated ?? true} /></span>
                  : <motion.span className={styles.richText} initial={tip.still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}>{description}</motion.span>}
              </div>
              {shortcut ? (
                <div className={styles.keyRow}>
                  <span className={styles.keyGroup}>Press {shortcut.map((key) => <Kbd key={key} size="sm" variant="outline" animated={shared.animated ?? true}>{key}</Kbd>)}</span>
                  <span>Esc to close</span>
                </div>
              ) : null}
              {actions ? <div className={styles.actions}>{actions}</div> : null}
            </motion.div>
            <Nub />
          </motion.div>
        )}
      </Floating>
    </>
  )
}

/** Wraps a disabled control so it can still take hover and focus. Disabled buttons fire no pointer events. */
export function TooltipDisabledTrigger({ className, ...rest }: HTMLAttributes<HTMLSpanElement> & { ref?: Ref<HTMLSpanElement> }) {
  return <span tabIndex={0} className={cx(styles.disabledTrigger, className)} {...rest} />
}

export type TooltipTruncatedProps = Omit<TooltipProps, 'content' | 'children'> & { children: string; className?: string }

/** Text that cuts off, with a tooltip that holds the full value, only when it is actually cut. */
export function TooltipTruncated({ children, className, ...rest }: TooltipTruncatedProps) {
  const text = useRef<HTMLSpanElement>(null)
  const [cut, setCut] = useState(false)
  useLayoutEffect(() => {
    const node = text.current
    if (!node) return
    const check = (): void => setCut(node.scrollWidth > node.clientWidth)
    check()
    const sized = new ResizeObserver(check)
    sized.observe(node)
    return () => sized.disconnect()
  }, [children])
  return (
    <Tooltip {...rest} content={children} disabled={!cut}>
      <span ref={text} tabIndex={cut ? 0 : undefined} className={cx(styles.truncated, className)}>{children}</span>
    </Tooltip>
  )
}
