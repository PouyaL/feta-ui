'use client'
import { animate, motion, useDragControls, useMotionValue, type PanInfo } from 'motion/react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { spring } from '../../motion-tokens'
import { useLabelMotion } from '../button/label-motion'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './tabs.module.css'

const RUBBER_BAND = 0.35
const FLICK_SPEED = 400
const SNAP_AT = 0.5

export type TabItem = {
  value: string
  label: string
  icon?: ReactNode
  count?: number | string
  disabled?: boolean
  /** Says why a disabled tab is off. */
  reason?: string
  content?: ReactNode
}

export type TabsProps = {
  items: TabItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** `pill` floats the active tab on surface; `line` draws an ink line on a hairline. Default `pill`. */
  appearance?: 'pill' | 'line'
  orientation?: 'horizontal' | 'vertical'
  /** Stretches the tab list to its container. */
  fill?: boolean
  /** The tab list's accessible name. */
  label: string
  animated?: boolean
  className?: string
}

function Tab({ item, on, stop, still, uid, onChoose, onKeyDown }: { item: TabItem; on: boolean; stop: boolean; still: boolean; uid: string; onChoose: () => void; onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void }) {
  const text = useLabelMotion(item.label, !still && !item.disabled)
  return (
    <button
      type="button"
      role="tab"
      id={`${uid}-tab-${item.value}`}
      className={styles.tab}
      data-value={item.value}
      aria-selected={on}
      aria-controls={item.content === undefined ? undefined : `${uid}-panel-${item.value}`}
      tabIndex={stop ? 0 : -1}
      disabled={item.disabled}
      title={item.disabled ? item.reason : undefined}
      onClick={onChoose}
      onPointerEnter={text.handlers.onPointerEnter}
      onPointerLeave={text.handlers.onPointerLeave}
      onPointerDown={text.handlers.onPointerDown}
      onKeyDown={(e) => { onKeyDown(e); text.handlers.onKeyDown(e) }}
    >
      {item.icon ? <span className={styles.icon}>{item.icon}</span> : null}
      {/* The hidden copy reserves the Medium width, so choosing a tab never moves its neighbours. */}
      <span className={styles.text} data-text={item.label}>{text.label}</span>
      {item.count === undefined ? null : <span className={styles.count}>{item.count}</span>}
    </button>
  )
}

/** Switch between views of one thing. The indicator and the panel move together on one spring, and touch drives both directly. */
export function Tabs({ items, value, defaultValue, onValueChange, appearance = 'pill', orientation = 'horizontal', fill = false, label, animated = true, className }: TabsProps) {
  const still = useStill(animated)
  const uid = useId()
  const list = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const firstRun = useRef(true)
  const controls = useDragControls()
  const [held, setHeld] = useState(defaultValue ?? items.find((item) => !item.disabled)?.value)
  const current = value ?? held
  const index = Math.max(0, items.findIndex((item) => item.value === current))
  const vertical = orientation === 'vertical'
  const panels = items.some((item) => item.content !== undefined)
  const swipes = panels && !vertical

  // Where the indicator sits, as motion values: a finger moves it every frame without a render.
  const at = useMotionValue(0)
  const size = useMotionValue(0)
  const trackX = useMotionValue(0)
  const [width, setWidth] = useState(0)

  const rect = useCallback((i: number): { at: number; size: number } | null => {
    const tab = list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[i]
    if (!tab) return null
    return vertical ? { at: tab.offsetTop, size: tab.offsetHeight } : { at: tab.offsetLeft, size: tab.offsetWidth }
  }, [vertical])

  const place = useCallback((soft: boolean) => {
    const target = rect(index)
    if (!target) return
    const pageWidth = viewport.current?.clientWidth ?? 0
    if (!soft) {
      at.set(target.at); size.set(target.size); trackX.set(-index * pageWidth)
      return
    }
    animate(at, target.at, spring.toggle)
    animate(size, target.size, spring.toggle)
    animate(trackX, -index * pageWidth, spring.toggle)
  }, [at, size, trackX, rect, index])

  useLayoutEffect(() => {
    place(!still && !firstRun.current)
    firstRun.current = false
  }, [place, still])

  useEffect(() => {
    const node = list.current
    if (!node) return
    const observer = new ResizeObserver(() => { place(false); setWidth(viewport.current?.clientWidth ?? 0) })
    observer.observe(node)
    if (viewport.current) observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [place])

  function choose(item: TabItem): void {
    setHeld(item.value)
    onValueChange?.(item.value)
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>): void {
    const enabled = items.filter((item) => !item.disabled)
    const position = enabled.findIndex((item) => item.value === e.currentTarget.dataset.value)
    const [back, forward] = vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight']
    const targets: Record<string, TabItem | undefined> = {
      [back as string]: enabled[(position - 1 + enabled.length) % enabled.length],
      [forward as string]: enabled[(position + 1) % enabled.length],
      Home: enabled[0],
      End: enabled.at(-1),
    }
    const next = targets[e.key]
    if (!next) return
    e.preventDefault()
    choose(next)
    list.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus()
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>): void {
    if (swipes && e.pointerType !== 'mouse') controls.start(e)
  }

  function onDrag(): void {
    if (!width) return
    const position = Math.max(0, Math.min(items.length - 1, -trackX.get() / width))
    const from = rect(Math.floor(position))
    const to = rect(Math.ceil(position))
    if (!from || !to) return
    const part = position - Math.floor(position)
    at.set(from.at + (to.at - from.at) * part)
    size.set(from.size + (to.size - from.size) * part)
  }

  function onDragEnd(_: unknown, info: PanInfo): void {
    if (!width) return
    const moved = info.offset.x / width
    const flick = Math.abs(info.velocity.x) > FLICK_SPEED
    const step = flick ? -Math.sign(info.velocity.x) : Math.abs(moved) > SNAP_AT ? -Math.sign(moved) : 0
    let target = Math.max(0, Math.min(items.length - 1, index + step))
    if (items[target]?.disabled) target = index
    const item = items[target]
    if (item && target !== index) choose(item)
    else place(!still)
  }

  return (
    <div className={cx(styles.tabs, className)} data-appearance={appearance} data-orientation={orientation} data-still={still ? '' : undefined}>
      <div ref={list} role="tablist" aria-label={label} aria-orientation={orientation} className={styles.list} data-fill={fill ? '' : undefined}>
        <motion.span className={styles.indicator} aria-hidden="true" style={vertical ? { y: at, height: size } : { x: at, width: size }} />
        {items.map((item, i) => (
          <Tab key={item.value} item={item} on={i === index} stop={i === index} still={still} uid={uid} onChoose={() => choose(item)} onKeyDown={onKeyDown} />
        ))}
      </div>
      {panels ? (
        <div ref={viewport} className={styles.viewport} onPointerDown={onPointerDown}>
          <motion.div
            className={styles.track}
            style={vertical ? {} : { x: trackX }}
            {...(swipes ? {
              drag: 'x' as const,
              dragControls: controls,
              dragListener: false,
              dragMomentum: false,
              dragElastic: still ? 0 : RUBBER_BAND,
              dragConstraints: { left: -(items.length - 1) * width, right: 0 },
              onDrag,
              onDragEnd,
            } : {})}
          >
            {items.map((item, i) => (
              <div
                key={item.value}
                role="tabpanel"
                id={`${uid}-panel-${item.value}`}
                aria-labelledby={`${uid}-tab-${item.value}`}
                aria-hidden={i === index ? undefined : true}
                inert={i !== index}
                hidden={vertical && i !== index}
                tabIndex={i === index ? 0 : -1}
                className={styles.panel}
              >
                {item.content}
              </div>
            ))}
          </motion.div>
        </div>
      ) : null}
    </div>
  )
}
