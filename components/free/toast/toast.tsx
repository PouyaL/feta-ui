'use client'
import { RefreshCwIcon } from '@fetaui/react/rounded/refresh-cw'
import { UndoIcon } from '@fetaui/react/rounded/undo'
import { XIcon } from '@fetaui/react/rounded/x'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ease } from '../../motion-tokens'
import { useCountdown } from '../alert/use-countdown'
import { useSwipe } from '../alert/use-swipe'
import { BadgeState, type BadgeStateKind } from '../badge/badge'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { cx, kit, useStill } from '../motion-kit/motion-kit'
import { Progress } from '../progress/progress'
import styles from './toast.module.css'

export type ToastKind = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'action' | 'undo' | 'promise'

const BADGE: Record<ToastKind, BadgeStateKind> = {
  success: 'success', error: 'error', warning: 'warning', info: 'info', loading: 'loading', action: 'action', undo: 'info', promise: 'loading',
}

const ENTER_S = 0.24
const MELT = { type: 'spring', duration: 0.6, bounce: 0.25 } as const
const STACK_SPRING = { type: 'spring', stiffness: 420, damping: 36 } as const
const EXPAND_DELAY_MS = 150
const TIMEOUT_MS = 6000
const COLLAPSE_BEFORE_MS = 2000
const UNDO_MS = 5000
const UNDO_TICK_MS = 250
const MAX_SHOWN = 3
const SWIPE_SHARE = 0.4
const PEEK = [0, 38, 74] as const
const SCALE = [1, 0.96, 0.92] as const
const GAP = 8

export type ToastData = {
  kind: ToastKind
  title: string
  description?: string
  /** The main button. */
  action?: { label: string; onClick: () => void }
  /** The quiet button beside it, like Later. */
  cancel?: { label: string; onClick?: () => void }
  /** 0 to 100, for Loading and Promise. */
  progress?: number | undefined
  /** Mono text beside the bar, like 2 OF 3. */
  meta?: string
  /** Milliseconds, or `Infinity` to stay. Loading and Promise stay by default. */
  duration?: number
}

export type ToastProps = ToastData & {
  /** Collapsed is the pill, Expanded has actions, Message has only text. */
  shape?: 'collapsed' | 'expanded' | 'message'
  onDismiss?: () => void
  /** Holds the undo countdown. */
  paused?: boolean
  /** Undo time left in ms, from whatever keeps the clock. Without it, the ring counts down from mount. */
  left?: number
  animated?: boolean
  className?: string
}

/** The pill that melts into a card. Use `toast()` to show one; render this alone for previews. */
export function Toast({ kind, title, description, action, cancel, progress, meta, duration, shape = 'expanded', onDismiss, paused = false, left, animated = true, className }: ToastProps) {
  const still = useStill(animated)
  const collapsed = shape === 'collapsed'
  const undo = kind === 'undo'
  const hasBar = progress !== undefined
  const label = kind === 'error' ? 'alert' : 'status'
  return (
    <div role={label} data-shape={shape} data-kind={kind} data-still={animated ? undefined : ''} className={cx(styles.toast, className)}>
      <div className={styles.head}>
        <div className={styles.tab}>
          <BadgeState state={BADGE[kind]} label={null} animated={animated} />
          <span className={styles.title}>{title}</span>
          {collapsed && hasBar ? <span className={styles.mono}>{Math.round(progress)}%</span> : null}
          {collapsed && undo && action ? <button type="button" className={styles.inlineAction} onClick={action.onClick}>{action.label}</button> : null}
        </div>
        {!collapsed && onDismiss ? <IconButton className={styles.close} variant="ghost" size="sm" icon={<XIcon />} label="Dismiss" onClick={onDismiss} animated={animated} /> : null}
      </div>
      {collapsed ? null : (
        <motion.div className={styles.tray} {...(still ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: animated ? 0.12 : 0 } } : { initial: { scaleY: 0.5, opacity: 0 }, animate: { scaleY: 1, opacity: 1 }, transition: MELT })}>
          <div className={styles.card}>
            {description ? (
              <motion.p className={styles.description} initial={still ? false : { opacity: 0, filter: 'blur(2px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={still ? { duration: 0 } : { duration: 0.2, delay: 0.12, ease: ease.out }}>{description}</motion.p>
            ) : null}
            {hasBar ? (
              <div className={styles.barRow}>
                <Progress size="sm" value={progress} label={title} animated={animated} />
                <span className={styles.mono}>{meta ?? `${Math.round(progress)}%`}</span>
              </div>
            ) : null}
            {shape === 'expanded' && (action || cancel || undo) ? (
              <div className={styles.actions} data-undo={undo ? '' : undefined}>
                {undo && Number.isFinite(duration ?? UNDO_MS) ? <UndoRing total={duration ?? UNDO_MS} left={left} paused={paused} animated={animated} still={still} /> : null}
                {cancel ? <Button variant="ghost" size="sm" animated={animated} {...(cancel.onClick ? { onClick: cancel.onClick } : {})}>{cancel.label}</Button> : null}
                {action ? (
                  <Button
                    variant={kind === 'action' || kind === 'info' ? 'primary' : 'secondary'}
                    size="sm"
                    animated={animated}
                    onClick={action.onClick}
                    {...(undo ? { leadingIcon: <UndoIcon /> } : kind === 'error' ? { leadingIcon: <RefreshCwIcon /> } : {})}
                  >
                    {action.label}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </motion.div>
      )}
    </div>
  )
}

/** Unpaused time left of `ms`, kept across re-renders. `Infinity` never ticks. */
function useTimeLeft(ms: number, paused: boolean): number {
  const [, setLeft] = useState(ms)
  const kept = useRef(ms)
  useEffect(() => {
    if (paused || !Number.isFinite(ms)) return undefined
    const started = performance.now()
    const from = kept.current
    const read = (): number => (kept.current = Math.max(from - (performance.now() - started), 0))
    // Only the whole second is shown, so what sits under this hook renders once a second.
    const tick = (): void => { const now = read(); setLeft((was) => (Math.ceil(was / 1000) === Math.ceil(now / 1000) ? was : now)) }
    const timer = setInterval(tick, UNDO_TICK_MS)
    return () => { clearInterval(timer); setLeft(read()) }
  }, [ms, paused])
  // From the ref: a ring remounting on reopen renders before the pause cleanup, and must not read a value up to a second old.
  return kept.current
}

function UndoRing({ total, left, paused, animated, still }: { total: number; left: number | undefined; paused: boolean; animated: boolean; still: boolean }) {
  const own = useTimeLeft(left === undefined ? total : Infinity, paused)
  const now = left ?? own
  // The ring remounts when the card reopens, so it joins the sweep where the clock is.
  const [spent] = useState(total - now)
  return (
    <span className={styles.undo} data-paused={paused ? '' : undefined}>
      {still ? null : (
        <svg data-keep-motion="" data-still={animated ? undefined : ''} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle data-keep-motion="" className={styles.ring} cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" pathLength={100} strokeDasharray="100 100" style={{ animationDuration: `${total}ms`, animationDelay: `${-spent}ms` }} />
        </svg>
      )}
      <span className={styles.mono}>{Math.ceil(now / 1000)}S</span>
    </span>
  )
}

type Entry = ToastData & { id: number }

let entries: Entry[] = []
let nextId = 1
const listeners = new Set<() => void>()
const publish = (next: Entry[]): void => { entries = next; for (const listen of listeners) listen() }
const subscribe = (listen: () => void): (() => void) => { listeners.add(listen); return () => listeners.delete(listen) }
const EMPTY: Entry[] = []

/** Shows a toast and returns its id. Needs one `<Toaster />` on the page. */
export function toast(data: ToastData): number {
  const id = nextId++
  publish([{ ...data, id }, ...entries])
  return id
}

/** Changes a toast in place, like moving a Promise on to success. */
toast.update = (id: number, patch: Partial<ToastData>): void => publish(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
toast.dismiss = (id: number): void => publish(entries.filter((entry) => entry.id !== id))
/** Runs a promise through Promise, then Success or Error. */
toast.promise = async <T,>(work: Promise<T>, copy: { title: string; description?: string; success: string; error: string }): Promise<T> => {
  const id = toast({ kind: 'promise', title: copy.title, progress: 0, ...(copy.description ? { description: copy.description } : {}) })
  try {
    const result = await work
    toast.update(id, { kind: 'success', title: copy.success, progress: undefined, duration: TIMEOUT_MS })
    return result
  } catch (error) {
    toast.update(id, { kind: 'error', title: copy.error, progress: undefined, duration: TIMEOUT_MS })
    throw error
  }
}

export type ToasterPosition = 'top-right' | 'bottom-right' | 'bottom-center' | 'top' | 'bottom'

export type ToasterProps = {
  /** Default `bottom-right`. `top` and `bottom` are the Mobile placements. */
  position?: ToasterPosition
  animated?: boolean
}

function Item({ entry, index, heights, spread, top, animated, onHeight, onPause }: { entry: Entry; index: number; heights: number[]; spread: boolean; top: boolean; animated: boolean; onHeight: (id: number, height: number) => void; onPause: (on: boolean) => void }) {
  const still = useStill(animated)
  const stays = entry.kind === 'loading' || entry.kind === 'promise'
  const total = entry.duration ?? (entry.kind === 'undo' ? UNDO_MS : stays ? Infinity : TIMEOUT_MS)
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const paused = hover || focus || spread
  const undoLeft = useTimeLeft(entry.kind === 'undo' ? total : Infinity, paused)
  const node = useRef<HTMLDivElement>(null)
  const dismiss = (): void => toast.dismiss(entry.id)
  useCountdown(Number.isFinite(total) ? total : null, paused, dismiss)
  useCountdown(Number.isFinite(total) ? total - COLLAPSE_BEFORE_MS : null, paused, () => setOpen(false))
  useEffect(() => {
    const timer = setTimeout(() => setOpen(true), still ? 0 : EXPAND_DELAY_MS)
    return () => clearTimeout(timer)
  }, [still])
  useEffect(() => {
    const el = node.current
    if (!el) return undefined
    const observer = new ResizeObserver(() => onHeight(entry.id, el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [entry.id])
  // The focused button can leave with the toast, and then no blur fires.
  useEffect(() => () => onPause(false), [onPause])
  const swipe = useSwipe(true, SWIPE_SHARE, still, dismiss)
  const expanded = open || hover || focus
  const direction = top ? 1 : -1
  const offset = spread
    ? heights.slice(0, index).reduce((sum, height) => sum + height + GAP, 0)
    // Stacked toasts line up by their tabs, so a shorter one rises by the difference.
    : (PEEK[index] ?? PEEK[2]) + Math.max((heights[0] ?? 0) - (heights[index] ?? 0), 0)
  const scale = spread ? 1 : (SCALE[index] ?? SCALE[2])
  const hasActions = Boolean(entry.action || entry.cancel) || entry.kind === 'undo' || entry.progress !== undefined
  const shape = !expanded ? 'collapsed' : hasActions ? 'expanded' : 'message'
  return (
    <motion.li
      className={styles.item}
      data-behind={index > 0 && !spread ? '' : undefined}
      style={{ zIndex: 10 - index, originY: top ? 0 : 1 }}
      initial={still ? { opacity: 0 } : { opacity: 0, y: direction * -6, scale: 0.95 }}
      animate={{ opacity: index >= MAX_SHOWN ? 0 : 1, y: direction * offset, scale }}
      exit={{ opacity: 0, transition: { duration: animated ? 0.12 : 0 } }}
      transition={!animated || still ? { duration: 0 } : index === 0 ? { duration: ENTER_S, ease: ease.out } : STACK_SPRING}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocusCapture={() => { setFocus(true); onPause(true) }}
      onBlurCapture={() => { setFocus(false); onPause(false) }}
    >
      <motion.div ref={node} {...swipe.props}>
        <Toast {...entry} shape={shape} paused={paused} left={undoLeft} animated={animated} onDismiss={dismiss} />
      </motion.div>
    </motion.li>
  )
}

/** Where toasts land. At most three show, older ones stack behind as tabs. F6 moves to it. */
export function Toaster({ position = 'bottom-right', animated = true }: ToasterProps) {
  const list = useSyncExternalStore(subscribe, () => entries, () => EMPTY)
  const root = useRef<HTMLOListElement>(null)
  const [hover, setHover] = useState(false)
  const [focused, setFocused] = useState(false)
  const [heights, setHeights] = useState<Record<number, number>>({})
  const top = position.startsWith('top')
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key !== 'F6') return
      const first = root.current?.querySelector<HTMLElement>('button, a[href]')
      if (first) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const measured = list.map(({ id }) => heights[id] ?? 40)
  return (
    <section aria-label="Notifications" aria-live="polite" className={styles.region} data-position={position}>
      <span className={kit.srOnly}>Press F6 to reach notifications</span>
      <ol ref={root} className={styles.list} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
        <AnimatePresence initial>
          {list.map((entry, index) => (
            <Item
              key={entry.id}
              entry={entry}
              index={index}
              heights={measured}
              spread={hover || focused}
              top={top}
              animated={animated}
              onHeight={(id, height) => setHeights((prev) => (prev[id] === height ? prev : { ...prev, [id]: height }))}
              onPause={setFocused}
            />
          ))}
        </AnimatePresence>
      </ol>
    </section>
  )
}
