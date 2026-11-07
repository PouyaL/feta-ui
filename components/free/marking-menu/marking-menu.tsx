'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { ease } from '../../motion-tokens'
import { cx, useStill } from '../motion-kit/motion-kit'
import { isCompact } from '../dropdown-menu/dropdown-menu'
import styles from './marking-menu.module.css'

const HOLD_MS = 250
const FLICK_SPEED = 0.6
const FLICK_MIN_PX = 24
const HUB_RADIUS = 32
const DISC = { web: 224, mobile: 232 }
const RING = { web: 82, mobile: 86 }
const OPEN_RING = 60
const OPEN_S = 0.18
const TARGET_S = 0.22
const TARGET_STAGGER_S = 0.015
const WEDGE_S = 0.09
const LIFT = { type: 'spring', stiffness: 500, damping: 28 } as const
const PICK_S = 0.16
const TRAIL_S = 0.4
const CHIP_S = 0.2
const CHIP_HOLD_MS = 1200

export type MarkingItem = { id: string; label: string; icon: ReactNode }

export type MarkingMenuProps = {
  /** Up to eight, clockwise from the top. Keep their positions stable: people learn directions. */
  items: MarkingItem[]
  onPick?: (id: string) => void
  /** The surface it opens on. */
  children?: ReactNode
  /** Name of the surface. */
  label?: string
  /** Opens the disc at the center on mount. */
  defaultOpen?: boolean
  animated?: boolean
  className?: string
}

type Point = { x: number; y: number }
const sectorOf = (dx: number, dy: number, count: number): number => {
  const angle = (Math.atan2(dx, -dy) * 180) / Math.PI
  return Math.round(((angle + 360) % 360) / (360 / count)) % count
}

/** A radial menu for people who learn it. Hold for eight targets, or flick the same way to pick without looking. */
export function MarkingMenu({ items, onPick, children, label = 'Canvas', defaultOpen = false, animated = true, className }: MarkingMenuProps) {
  const still = useStill(animated)
  const uid = useId()
  const area = useRef<HTMLDivElement>(null)
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const press = useRef<(Point & { at: number }) | null>(null)
  const chipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [origin, setOrigin] = useState<Point | null>(defaultOpen ? { x: -1, y: -1 } : null)
  const [sector, setSector] = useState<number | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [chip, setChip] = useState<string | null>(null)
  const [trail, setTrail] = useState<{ from: Point; to: Point; key: number } | null>(null)
  const count = items.length
  const step = 360 / count

  useEffect(() => () => { clearTimeout(hold.current); clearTimeout(chipTimer.current) }, [])

  useEffect(() => {
    if (origin?.x !== -1 || !area.current) return
    setOrigin({ x: area.current.clientWidth / 2, y: area.current.clientHeight / 2 })
  }, [origin])

  const local = (e: { clientX: number; clientY: number }): Point => {
    const box = area.current?.getBoundingClientRect()
    return { x: e.clientX - (box?.left ?? 0), y: e.clientY - (box?.top ?? 0) }
  }

  const clamp = (point: Point): Point => {
    const node = area.current
    const size = isCompact(node) ? DISC.mobile : DISC.web
    if (!node) return point
    const half = size / 2
    return { x: Math.max(half, Math.min(node.clientWidth - half, point.x)), y: Math.max(half, Math.min(node.clientHeight - half, point.y)) }
  }

  function finish(index: number | null): void {
    const item = index === null ? undefined : items[index]
    setSector(null)
    if (!item) { setOrigin(null); area.current?.focus({ preventScroll: true }); return }
    setPicked(item.id)
    const closeAfter = still ? 0 : PICK_S * 1000
    setTimeout(() => { setOrigin(null); setPicked(null); area.current?.focus({ preventScroll: true }) }, closeAfter)
    announce(item)
  }

  function announce(item: MarkingItem): void {
    setChip(item.label)
    clearTimeout(chipTimer.current)
    chipTimer.current = setTimeout(() => setChip(null), CHIP_HOLD_MS)
    onPick?.(item.id)
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>): void {
    if (e.button !== 0) return
    const point = local(e)
    press.current = { ...point, at: e.timeStamp }
    e.currentTarget.setPointerCapture(e.pointerId)
    hold.current = setTimeout(() => { setOrigin(clamp(point)) }, HOLD_MS)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>): void {
    if (!origin) return
    const point = local(e)
    const dx = point.x - origin.x
    const dy = point.y - origin.y
    const next = Math.hypot(dx, dy) < HUB_RADIUS ? null : sectorOf(dx, dy, count)
    if (next !== sector) setSector(next)
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>): void {
    clearTimeout(hold.current)
    const start = press.current
    press.current = null
    if (origin) { if (start) finish(sector); return }
    if (!start) return
    const point = local(e)
    const dx = point.x - start.x
    const dy = point.y - start.y
    const distance = Math.hypot(dx, dy)
    const speed = distance / Math.max(1, e.timeStamp - start.at)
    if (distance < FLICK_MIN_PX || speed < FLICK_SPEED) return
    const item = items[sectorOf(dx, dy, count)]
    if (!item) return
    if (!still) setTrail({ from: start, to: point, key: e.timeStamp })
    announce(item)
  }

  function onContextMenu(e: MouseEvent<HTMLDivElement>): void {
    e.preventDefault()
    clearTimeout(hold.current)
    press.current = null
    setOrigin(clamp(local(e)))
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (!origin) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ContextMenu') { e.preventDefault(); setOrigin({ x: -1, y: -1 }); setSector(0) }
      return
    }
    const moves: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    const move = moves[e.key]
    if (move) { e.preventDefault(); setSector(((sector ?? (move > 0 ? -1 : 0)) + move + count) % count) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(sector) }
    else if (e.key === 'Escape') { e.preventDefault(); finish(null) }
  }

  const compact = isCompact(area.current)
  const ring = compact ? RING.mobile : RING.web
  const open = origin && origin.x >= 0
  const pointAt = (index: number, radius: number): Point => {
    const angle = (index * step * Math.PI) / 180
    return { x: Math.sin(angle) * radius, y: -Math.cos(angle) * radius }
  }

  return (
    <div
      ref={area}
      role="application"
      aria-label={`${label}. Press Enter for the menu.`}
      aria-activedescendant={open && sector !== null ? `${uid}-${sector}` : undefined}
      tabIndex={0}
      className={cx(styles.area, className)}
      data-still={still ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { clearTimeout(hold.current); press.current = null; setOrigin(null) }}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
    >
      {children}
      <AnimatePresence onExitComplete={() => setSector(null)}>
        {open ? (
          <motion.div
            key="disc"
            role="menu"
            aria-label="Marking menu"
            className={styles.disc}
            style={{ left: origin.x, top: origin.y }}
            initial={still ? { opacity: 1 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: picked ? 1.04 : 0.96, transition: { duration: PICK_S, ease: ease.out } }}
            transition={{ duration: still ? 0 : OPEN_S, ease: ease.out }}
          >
            {sector !== null ? (
              <motion.svg className={styles.wedge} viewBox="-112 -112 224 224" aria-hidden="true" initial={false} animate={{ rotate: sector * step }} transition={{ duration: still ? 0 : WEDGE_S, ease: ease.out }}>
                <path d={wedgePath(step)} />
              </motion.svg>
            ) : null}
            {items.map((item, i) => {
              const at = pointAt(i, ring)
              const from = pointAt(i, OPEN_RING)
              const on = sector === i
              const lift = on ? pointAt(i, 7) : { x: 0, y: 0 }
              return (
                <motion.div
                  key={item.id}
                  id={`${uid}-${i}`}
                  role="menuitem"
                  aria-label={item.label}
                  className={styles.target}
                  data-on={on ? '' : undefined}
                  data-picked={picked === item.id ? '' : undefined}
                  initial={still ? { x: at.x, y: at.y } : { x: from.x, y: from.y, opacity: 0 }}
                  animate={{ x: at.x + lift.x, y: at.y + lift.y, opacity: 1, scale: on ? 1.1 : 1 }}
                  transition={still ? { duration: 0 } : sector === null ? { duration: TARGET_S, delay: i * TARGET_STAGGER_S, ease: ease.out } : LIFT}
                >
                  {item.icon}
                </motion.div>
              )
            })}
            <div className={styles.hub} aria-hidden="true">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={sector ?? 'none'} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: still ? 0 : WEDGE_S }}>{sector === null ? '' : items[sector]?.label}</motion.span>
              </AnimatePresence>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {trail ? (
        <svg key={trail.key} className={styles.trail} aria-hidden="true">
          <motion.line x1={trail.from.x} y1={trail.from.y} x2={trail.to.x} y2={trail.to.y} initial={{ pathLength: 0, opacity: 0.7 }} animate={{ pathLength: 1, opacity: 0 }} transition={{ duration: TRAIL_S, ease: ease.out }} onAnimationComplete={() => setTrail(null)} />
        </svg>
      ) : null}
      <AnimatePresence>
        {chip ? <motion.span key="chip" role="status" className={styles.chip} initial={still ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: still ? 0 : CHIP_S } }} transition={{ duration: still ? 0 : CHIP_S, ease: ease.out }}>Opened {chip}</motion.span> : null}
      </AnimatePresence>
    </div>
  )
}

/** One sector pointing up, inset 4 from the rim. */
function wedgePath(degrees: number): string {
  const radius = 108
  const half = (degrees / 2) * (Math.PI / 180)
  const x = Math.sin(half) * radius
  const y = -Math.cos(half) * radius
  return `M0 0 L${-x} ${y} A${radius} ${radius} 0 0 1 ${x} ${y} Z`
}
