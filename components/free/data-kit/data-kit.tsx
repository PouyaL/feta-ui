'use client'
import { animate, AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type UIEvent } from 'react'
import { Avatar } from '../avatar/avatar'
import { Badge } from '../badge/badge'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Skeleton } from '../skeleton/skeleton'
import { ease } from '../../motion-tokens'
import styles from './data-kit.module.css'

// Shared by the Data, Billing and Developer sets: the Soft shell and the small parts they repeat.
export const kit = styles
export { cx }

/** The Motion frames: panel 400 ms, rows and values 240 ms with a 40 ms stagger, menus 160 ms. Not yet in motion-tokens. */
export const PANEL_MS = 400
export const VALUE_MS = 240
export const ROW_STAGGER_MS = 40
export const MENU_MS = 160
/** `motion/ease-standard` in the Motion frames. */
export const EASE_STANDARD = [0.25, 0.1, 0.25, 1] as const

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

/** Badge · Soft · Small, the size every data set uses. `mono` is for status codes and event names. */
export function Tag({ tone = 'neutral', mark = false, mono = false, outline = false, children, className }: { tone?: Tone; mark?: boolean; mono?: boolean; outline?: boolean; children: ReactNode; className?: string | undefined }) {
  return <Badge size="sm" tone={tone} mark={mark} variant={outline ? 'outline' : 'soft'} className={cx(mono && styles.mono, className)}>{children}</Badge>
}

/** Avatar from a name: 20 px by default, 28 with `size="sm"`. */
export function Initials({ name, size = 'xs', className }: { name: string; size?: 'xs' | 'sm'; className?: string | undefined }) {
  const letters = name.split(' ').map((word) => word[0]).slice(0, 2).join('')
  return <Avatar initials={letters} size={size} {...(className ? { className } : {})} />
}

export type PanelProps = {
  title?: ReactNode
  subtitle?: ReactNode
  /** A tile before the title. */
  leading?: ReactNode
  /** Puts the subtitle at the right of the title row. */
  asideSubtitle?: boolean
  /** Right side of the header. */
  actions?: ReactNode
  /** Under the sections, on a hairline. */
  footer?: ReactNode
  /** Largest width on Web. The panel fills narrower parents. Default 760. */
  width?: number
  /** `card` is a surface in a 4 px tray. `bare` has no frame, for separate cards. `tray` is a full 4% ground. Default `card`. */
  shell?: 'card' | 'bare' | 'tray'
  animated?: boolean
  /** Names the region for screen readers when `title` is not text. */
  label?: string
  className?: string | undefined
  children: ReactNode
}

/** The Soft shell: one surface in a 4 px 4% tray, split by hairlines. Rises 8 px once. Collapses by its own width, so it works anywhere. */
export function Panel({ title, subtitle, leading, asideSubtitle = false, actions, footer, width = 760, shell = 'card', animated = true, label, className, children }: PanelProps) {
  const still = useStill(animated)
  return (
    <section className={cx(styles.panel, className)} style={{ maxWidth: width }} data-shell={shell} data-still={still ? '' : undefined} aria-label={label}>
      <div className={styles.sheet}>
        {title || actions ? (
          <header className={styles.panelHead}>
            {leading}
            <div className={styles.panelTitles} data-aside={asideSubtitle ? '' : undefined}>
              {title ? <h3 className={styles.panelTitle}>{title}</h3> : null}
              {subtitle ? <p className={styles.panelSub}>{subtitle}</p> : null}
            </div>
            {actions ? <div className={styles.panelActions}>{actions}</div> : null}
          </header>
        ) : null}
        {children}
        {footer ? <footer className={styles.panelFoot}>{footer}</footer> : null}
      </div>
    </section>
  )
}

/** One hairline section of a Panel. In a `bare` Panel it is a card of its own. */
export function Body({ title, meta, children, className, flush }: { title?: ReactNode; meta?: ReactNode; children: ReactNode; className?: string | undefined; flush?: boolean }) {
  return (
    <div className={cx(styles.body, className)} data-flush={flush ? '' : undefined}>
      {title || meta ? <div className={styles.bodyHead}><span className={styles.bodyTitle}>{title}</span>{meta ? <span className={styles.bodyMeta}>{meta}</span> : null}</div> : null}
      {children}
    </div>
  )
}

/** A number that tweens to its new value by writing text directly, so React never renders per frame. */
export function Tween({ value, format = String, animated = true, className }: { value: number; format?: (value: number) => string; animated?: boolean; className?: string | undefined }) {
  const still = useStill(animated)
  const node = useRef<HTMLSpanElement>(null)
  const shown = useRef(value)
  const formatRef = useRef(format)
  formatRef.current = format
  useEffect(() => {
    const el = node.current
    if (!el) return undefined
    if (still) {
      shown.current = value
      el.textContent = formatRef.current(value)
      return undefined
    }
    const controls = animate(shown.current, value, {
      duration: VALUE_MS / 1000,
      ease: EASE_STANDARD,
      onUpdate: (latest) => {
        shown.current = latest
        el.textContent = formatRef.current(latest)
      },
    })
    return () => controls.stop()
  }, [value, still])
  return <span ref={node} className={cx(styles.tween, className)}>{format(value)}</span>
}

/** A track filled by transform. `markers` are extra ticks, 0 to 1. */
export function Meter({ value, tone = 'neutral', label, height = 8, secondary, markers, ms = VALUE_MS, className }: { value: number; tone?: Tone; label?: string; height?: number; secondary?: number; markers?: number[]; ms?: number; className?: string | undefined }) {
  const clamp = (n: number): number => Math.min(1, Math.max(0, n))
  const style = { height, '--meter-ms': `${ms}ms` } as CSSProperties
  return (
    <span className={cx(styles.track, className)} style={style} role={label ? 'meter' : undefined} aria-label={label} aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? 100 : undefined} aria-valuenow={label ? Math.round(value * 100) : undefined}>
      {secondary === undefined ? null : <span className={styles.fillBack} style={{ transform: `translateX(${(clamp(secondary) - 1) * 100}%)` }} />}
      <span className={styles.fill} data-tone={tone} style={{ transform: `translateX(${(clamp(value) - 1) * 100}%)` }} />
      {markers?.map((at) => <span key={at} className={styles.marker} style={{ left: `${clamp(at) * 100}%` }} />)}
    </span>
  )
}

/** Skeleton · Soft sized for a table cell. */
export function Shimmer({ width = '100%', height = 12 }: { width?: number | string; height?: number }) {
  const still = useStill()
  return <Skeleton width={width} height={height} animated={!still} />
}

export type MenuEntry = { id: string; label: string; icon?: ReactNode; checked?: boolean; danger?: boolean; disabled?: boolean; onSelect?: () => void }

/** For menus inside a scrolling frame, like a grid header: fixed to the viewport, so the frame never clips it. Elsewhere use Dropdown Menu. */
export function Menu({ label, items, trigger, animated = true, align = 'start' }: {
  label: string
  items: MenuEntry[]
  trigger: (props: { onClick: () => void; 'aria-haspopup': 'menu'; 'aria-expanded': boolean; ref: (node: HTMLElement | null) => void; 'data-pressed'?: '' }) => ReactNode
  animated?: boolean
  align?: 'start' | 'end'
}) {
  const still = useStill(animated)
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState<{ top: number; left?: number; right?: number }>({ top: 0 })
  const anchor = useRef<HTMLElement | null>(null)
  const list = useRef<HTMLDivElement>(null)

  const close = useCallback((refocus: boolean) => {
    setOpen(false)
    if (refocus) anchor.current?.focus()
  }, [])

  function toggle(): void {
    const box = anchor.current?.getBoundingClientRect()
    if (box) setPlace({ top: box.bottom + 4, ...(align === 'end' ? { right: Math.max(8, window.innerWidth - box.right) } : { left: box.left }) })
    setOpen((was) => !was)
  }

  useEffect(() => {
    if (!open) return undefined
    list.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])')?.focus()
    const away = (e: PointerEvent): void => {
      const target = e.target as Node
      if (!list.current?.contains(target) && !anchor.current?.contains(target)) close(false)
    }
    const scrolled = (): void => close(false)
    document.addEventListener('pointerdown', away)
    window.addEventListener('scroll', scrolled, { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointerdown', away)
      window.removeEventListener('scroll', scrolled, { capture: true })
    }
  }, [open, close])

  function onKey(e: KeyboardEvent<HTMLDivElement>): void {
    const entries = Array.from(list.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? [])
    const at = entries.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true) }
    else if (e.key === 'Tab') close(false)
    else if (e.key === 'ArrowDown') { e.preventDefault(); entries[(at + 1) % entries.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); entries[(at - 1 + entries.length) % entries.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); entries[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); entries[entries.length - 1]?.focus() }
  }

  return (
    <>
      {trigger({ onClick: toggle, 'aria-haspopup': 'menu', 'aria-expanded': open, ref: (node) => { anchor.current = node }, ...(open ? { 'data-pressed': '' as const } : {}) })}
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={list}
            role="menu"
            aria-label={label}
            className={styles.menu}
            style={{ ...place, transformOrigin: align === 'end' ? 'top right' : 'top left' }}
            initial={still ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: still ? 0 : MENU_MS / 1000, ease: ease.out }}
            onKeyDown={onKey}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                aria-checked={item.checked}
                disabled={item.disabled}
                tabIndex={-1}
                className={styles.menuItem}
                data-danger={item.danger ? '' : undefined}
                onClick={() => { item.onSelect?.(); close(true) }}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.checked ? <span className={styles.menuCheck} aria-hidden="true">✓</span> : null}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

/**
 * Windowing for long lists of one row height: only rows near the viewport render. State changes once per
 * `CHUNK` rows, never per frame.
 */
const CHUNK = 8
export function useWindow(count: number, rowHeight: number, viewport: number): { first: number; last: number; total: number; onScroll: (e: UIEvent<HTMLElement>) => void; reset: () => void } {
  const [chunk, setChunk] = useState(0)
  const frame = useRef(0)
  const onScroll = useCallback((e: UIEvent<HTMLElement>) => {
    const top = e.currentTarget.scrollTop
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => setChunk(Math.floor(top / rowHeight / CHUNK)))
  }, [rowHeight])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  const first = Math.max(0, (chunk - 1) * CHUNK)
  const last = Math.min(count, first + Math.ceil(viewport / rowHeight) + CHUNK * 3)
  return { first, last, total: count * rowHeight, onScroll, reset: () => setChunk(0) }
}

/** Runs once after hydration; server markup stays stable. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useLayoutEffect(() => setMounted(true), [])
  return mounted
}

/** `true` for 2 s after `fire`, for Copied and Saved confirmations. */
export function useFlash(ms = 2000): [boolean, () => void] {
  const [on, setOn] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return [on, () => {
    setOn(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOn(false), ms)
  }]
}

/** Number Stepper: not in the file's Free list, so it stays here until it has a page of its own. */
export function Stepper({ value, onChange, min = 0, max = 999, label, minusIcon, plusIcon }: { value: number; onChange: (next: number) => void; min?: number; max?: number; label: string; minusIcon: ReactNode; plusIcon: ReactNode }) {
  return (
    <span className={styles.stepper} role="group" aria-label={label}>
      <button type="button" className={styles.stepperButton} aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>{minusIcon}</button>
      <output className={styles.stepperValue} aria-live="polite">{value}</output>
      <button type="button" className={styles.stepperButton} aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>{plusIcon}</button>
    </span>
  )
}
