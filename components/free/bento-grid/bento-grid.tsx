'use client'
import { animate, motion, useMotionValue } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { DropdownMenu, type MenuEntry } from '../dropdown-menu/dropdown-menu'
import { cx, useStill } from '../motion-kit/motion-kit'
import { BentoGripDots, BentoWidget, type BentoWidgetProps, type BentoWidgetSize } from '../bento-widget/bento-widget'
import styles from './bento-grid.module.css'

/** Pick up and drop springs, tilt and scale from the 16.5 Motion frame. */
const LIFT_SPRING = { type: 'spring', duration: 0.2, bounce: 0.3 } as const
const DROP_SPRING = { type: 'spring', duration: 0.4, bounce: 0.35 } as const
const LIFT_ROTATE = -3
const LIFT_SCALE = 1.02
/** A press past this many pixels is a drag. A held touch lifts after the delay. */
const DRAG_START = 4
const HOLD_DELAY = 300

/** Each widget with its own data shape, so a tile cannot pair one with the other's data. */
type TileWidget = BentoWidgetProps extends infer Props ? Props extends { widget: infer Kind } ? { widget: Kind } & Pick<Props, Extract<keyof Props, 'data'>> : never : never

export type BentoTile = TileWidget & {
  id: string
  /** Small takes one cell, Medium two. */
  size: Extract<BentoWidgetSize, 'small' | 'medium'>
  /** Its size on Mobile. Default `size`. */
  mobileSize?: Extract<BentoWidgetSize, 'small' | 'medium'>
}

export const BENTO_TILES: BentoTile[] = [
  { id: 'revenue', widget: 'revenue', size: 'small' },
  { id: 'active-users', widget: 'active-users', size: 'medium' },
  { id: 'activity', widget: 'activity', size: 'medium' },
  { id: 'notes', widget: 'notes', size: 'small' },
  { id: 'uptime', widget: 'uptime', size: 'medium', mobileSize: 'small' },
  { id: 'storage', widget: 'storage', size: 'small' },
]

const MOBILE_ORDER = ['revenue', 'storage', 'active-users', 'activity', 'notes', 'uptime']

export type BentoGridProps = {
  tiles?: BentoTile[]
  /** Tile ids, first to last. */
  order?: string[]
  defaultOrder?: string[]
  onOrderChange?: (order: string[]) => void
  /** Tile ids on Mobile until someone moves one. Default the Figma order. */
  mobileOrder?: string[]
  /** Shows a state without a pointer, for previews: Revenue hovered, or Notes lifted. */
  preview?: 'hover' | 'lifted'
  /** Accessible name of the grid. */
  label?: string
  animated?: boolean
  className?: string
}

const moved = (order: string[], id: string, to: number): string[] => {
  const rest = order.filter((item) => item !== id)
  return [...rest.slice(0, to), id, ...rest.slice(to)]
}

/** Bento Widgets on the Soft tray with 4 px gutters. Drag a grip to rearrange, or use its Move menu. */
export function BentoGrid({ tiles = BENTO_TILES, order, defaultOrder, onOrderChange, mobileOrder = MOBILE_ORDER, preview, label = 'Dashboard', animated = true, className }: BentoGridProps) {
  const still = useStill(animated)
  const [held, setHeld] = useState(() => defaultOrder ?? tiles.map(({ id }) => id))
  const [rearranged, setRearranged] = useState(false)
  const [lifted, setLifted] = useState<string | null>(null)
  const [settling, setSettling] = useState(false)
  const [message, setMessage] = useState('')
  const current = order ?? held
  const nodes = useRef(new Map<string, HTMLDivElement>())
  const first = useRef<Map<string, DOMRect> | null>(null)
  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)
  const drag = useRef<{ id: string; x: number; y: number; moved: boolean; timer?: ReturnType<typeof setTimeout> | undefined; last: string | null } | null>(null)
  const suppressClick = useRef(false)
  const currentRef = useRef(current)
  currentRef.current = current

  const byId = useMemo(() => new Map(tiles.map((tile) => [tile.id, tile])), [tiles])
  const name = useCallback((id: string): string => byId.get(id)?.widget.replace('-', ' ') ?? id, [byId])

  const commit = useCallback((next: string[]) => {
    if (!still) first.current = new Map([...nodes.current].map(([id, node]) => [id, node.getBoundingClientRect()]))
    setHeld(next)
    setRearranged(true)
    onOrderChange?.(next)
  }, [still, onOrderChange])

  // Tiles reflow with transforms only: measure, swap, then play each one back from where it was.
  useLayoutEffect(() => {
    const before = first.current
    first.current = null
    if (!before) return
    for (const [id, node] of nodes.current) {
      const was = before.get(id)
      if (!was) continue
      const now = node.getBoundingClientRect()
      const dx = was.left - now.left
      const dy = was.top - now.top
      if (id === drag.current?.id) { dragX.set(dragX.get() + dx); dragY.set(dragY.get() + dy); drag.current.x -= dx; drag.current.y -= dy; continue }
      const inner = node.firstElementChild
      if (inner instanceof HTMLElement && (dx || dy)) animate(inner, { x: [dx, 0], y: [dy, 0] }, DROP_SPRING)
    }
  }, [current, dragX, dragY])

  const move = useCallback((id: string, to: number) => {
    const list = currentRef.current
    const clamped = Math.max(0, Math.min(list.length - 1, to))
    if (list.indexOf(id) === clamped) return
    commit(moved(list, id, clamped))
    setMessage(`${name(id)} moved to position ${clamped + 1} of ${list.length}.`)
  }, [commit, name])

  const pickUp = useCallback((id: string) => {
    dragX.set(0)
    dragY.set(0)
    setLifted(id)
    setMessage(`${name(id)} picked up.`)
  }, [dragX, dragY, name])

  // The window listeners live for one drag, so they read these instead of closing over them.
  const latest = useRef({ move, name, pickUp, still })
  latest.current = { move, name, pickUp, still }

  const onMove = useCallback((event: PointerEvent) => {
    const held = drag.current
    if (!held) return
    const { move, pickUp, still } = latest.current
    const x = event.clientX - held.x
    const y = event.clientY - held.y
    if (!held.moved) {
      if (Math.hypot(x, y) < DRAG_START) return
      held.moved = true
      clearTimeout(held.timer)
      pickUp(held.id)
    }
    if (!still) { dragX.set(x); dragY.set(y) }
    const over = document.elementsFromPoint(event.clientX, event.clientY).find((node): node is HTMLElement => node instanceof HTMLElement && node.dataset.tile !== undefined)?.dataset.tile
    if (!over || over === held.last) return
    held.last = over
    if (over !== held.id) move(held.id, currentRef.current.indexOf(over))
  }, [dragX, dragY])

  const onUp = useCallback(() => {
    const held = drag.current
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    if (!held) return
    clearTimeout(held.timer)
    drag.current = null
    if (!held.moved) return
    suppressClick.current = true
    setMessage(`${latest.current.name(held.id)} dropped.`)
    if (latest.current.still) { setLifted(null); return }
    setSettling(true)
    animate(dragX, 0, DROP_SPRING)
    animate(dragY, 0, { ...DROP_SPRING, onComplete: () => { setLifted(null); setSettling(false) } })
  }, [dragX, dragY, onMove])

  useEffect(() => () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }, [onMove, onUp])

  function start(id: string, event: ReactPointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0 || preview) return
    suppressClick.current = false
    const held = { id, x: event.clientX, y: event.clientY, moved: false, last: id, timer: undefined as ReturnType<typeof setTimeout> | undefined }
    if (event.pointerType === 'touch') held.timer = setTimeout(() => { held.moved = true; pickUp(id) }, HOLD_DELAY)
    drag.current = held
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function eatClick(event: ReactMouseEvent<HTMLButtonElement>): void {
    if (!suppressClick.current) return
    suppressClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  const menu = (id: string, index: number): MenuEntry[] => [
    { label: 'Move earlier', disabled: index === 0, onSelect: () => move(id, index - 1) },
    { label: 'Move later', disabled: index === current.length - 1, onSelect: () => move(id, index + 1) },
    { kind: 'separator' },
    { label: 'Move to start', disabled: index === 0, onSelect: () => move(id, 0) },
    { label: 'Move to end', disabled: index === current.length - 1, onSelect: () => move(id, current.length - 1) },
  ]

  const previewLift = preview === 'lifted' ? 'notes' : null
  const shownLift = lifted ?? previewLift

  return (
    <div className={cx(styles.tray, className)} role="group" aria-label={label} data-still={still ? '' : undefined}>
      <div className={styles.grid} data-lifting={shownLift ? '' : undefined}>
        {current.map((id, index) => {
          const tile = byId.get(id)
          if (!tile) return null
          const mobileSize = tile.mobileSize ?? tile.size
          const isLifted = shownLift === id
          const tilted = isLifted && !still && !settling
          const grip = (
            <DropdownMenu
              label={`Move ${name(id)}`}
              entries={menu(id, index)}
              align="end"
              animated={animated}
              trigger={(props) => (
                <button {...props} type="button" className={styles.grip} aria-label={`Move ${name(id)}`} onPointerDown={(event) => start(id, event)} onClickCapture={eatClick}>
                  <BentoGripDots />
                </button>
              )}
            />
          )
          const widget = (size: BentoTile['size']): BentoWidgetProps => ({ ...tile, size, grip, fill: true, hovered: preview === 'hover' && id === 'revenue', animated })
          return (
            <div
              key={id}
              ref={(node) => { if (node) nodes.current.set(id, node); else nodes.current.delete(id) }}
              className={styles.tile}
              data-tile={id}
              data-span={tile.size}
              data-mobile-span={mobileSize}
              data-lifted={isLifted ? '' : undefined}
              style={{ '--mobile-order': rearranged ? index : mobileOrder.indexOf(id) } as CSSProperties}
            >
              <motion.div
                className={styles.lift}
                data-preview={previewLift === id ? '' : undefined}
                {...(isLifted && !previewLift && !still ? { style: { x: dragX, y: dragY } } : {})}
                {...(previewLift ? {} : { animate: { rotate: tilted ? LIFT_ROTATE : 0, scale: tilted ? LIFT_SCALE : 1 }, transition: tilted ? LIFT_SPRING : DROP_SPRING })}
              >
                {mobileSize === tile.size ? <BentoWidget {...widget(tile.size)} /> : (
                  <>
                    <div className={styles.web}><BentoWidget {...widget(tile.size)} /></div>
                    <div className={styles.mobile}><BentoWidget {...widget(mobileSize)} /></div>
                  </>
                )}
              </motion.div>
            </div>
          )
        })}
      </div>
      <p className={styles.live} aria-live="polite">{message}</p>
    </div>
  )
}
