'use client'
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowUpRightIcon } from '@fetaui/react/rounded/arrow-up-right'
import { CursorIcon } from '@fetaui/react/rounded/cursor'
import { HandIcon } from '@fetaui/react/rounded/hand'
import { ImageIcon } from '@fetaui/react/rounded/image'
import { MinusIcon } from '@fetaui/react/rounded/minus'
import { PencilIcon } from '@fetaui/react/rounded/pencil'
import { CircleIcon } from '@fetaui/react/rounded/circle'
import { MessageIcon } from '@fetaui/react/rounded/message'
import { ShapesIcon } from '@fetaui/react/rounded/shapes'
import { SquareStopIcon } from '@fetaui/react/rounded/square-stop'
import { TextFontIcon } from '@fetaui/react/rounded/text-font'
import { scalePress, spring } from '../../motion-tokens'
import { Kbd } from '../kbd/kbd'
import { useDismiss } from '../form-kit/use-dismiss'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Tooltip } from '../tooltip/tooltip'
import styles from './toolbar.module.css'

const REDOCK = { type: 'spring', stiffness: 380, damping: 32 } as const
const FLYOUT_S = 0.16
const ZONE_S = 0.16
const LONG_PRESS_MS = 400

export type ToolOption = { id: string; label: string; icon: ReactNode; shortcut?: string }
export type Tool = { id: string; label: string; icon: ReactNode; shortcut?: string; /** A flyout: the last chosen becomes the slot's icon. */ options?: ToolOption[] }
export type ToolbarEntry = Tool | { divider: true }
export type DockEdge = 'bottom' | 'left' | 'right' | 'top'

export type ToolbarProps = {
  tools: ToolbarEntry[]
  value?: string
  defaultValue?: string
  onValueChange?: (id: string) => void
  dock?: DockEdge
  defaultDock?: DockEdge
  onDockChange?: (edge: DockEdge) => void
  label?: string
  animated?: boolean
  className?: string
}

/** The set from the Figma file, ready for a drawing canvas. */
export const CANVAS_TOOLS: ToolbarEntry[] = [
  { id: 'select', label: 'Select', icon: <CursorIcon />, shortcut: 'V' },
  { id: 'hand', label: 'Hand', icon: <HandIcon />, shortcut: 'H' },
  { divider: true },
  { id: 'shapes', label: 'Shapes', icon: <ShapesIcon />, options: [
    { id: 'rect', label: 'Rectangle', icon: <SquareStopIcon />, shortcut: 'R' },
    { id: 'ellipse', label: 'Ellipse', icon: <CircleIcon />, shortcut: 'O' },
    { id: 'line', label: 'Line', icon: <MinusIcon />, shortcut: 'L' },
    { id: 'arrow', label: 'Arrow', icon: <ArrowUpRightIcon />, shortcut: 'A' },
  ] },
  { id: 'pencil', label: 'Pencil', icon: <PencilIcon />, shortcut: 'P' },
  { id: 'text', label: 'Text', icon: <TextFontIcon />, shortcut: 'T' },
  { divider: true },
  { id: 'comment', label: 'Comment', icon: <MessageIcon />, shortcut: 'C' },
  { id: 'image', label: 'Image', icon: <ImageIcon />, shortcut: 'I' },
]

const isTool = (entry: ToolbarEntry): entry is Tool => 'id' in entry
const EDGES: DockEdge[] = ['bottom', 'left', 'right', 'top']

/** A floating tool dock for canvas apps. Place it in a relatively positioned canvas: it holds the current tool on an ink plate and redocks to any edge. */
export function Toolbar({ tools, value, defaultValue, onValueChange, dock, defaultDock = 'bottom', onDockChange, label = 'Tools', animated = true, className }: ToolbarProps) {
  const still = useStill(animated)
  const uid = useId()
  const root = useRef<HTMLDivElement>(null)
  const longPress = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const controls = useDragControls()
  const list = tools.filter(isTool)
  const [held, setHeld] = useState(defaultValue ?? list[0]?.id)
  const [heldDock, setHeldDock] = useState(defaultDock)
  const [slots, setSlots] = useState<Record<string, string>>({})
  const [flyout, setFlyout] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const current = value ?? held
  const edge = dock ?? heldDock
  const stop = focus ?? current

  useDismiss(root, flyout !== null, () => setFlyout(null))
  useEffect(() => () => clearTimeout(longPress.current), [])
  useEffect(() => { if (flyout) root.current?.querySelector<HTMLElement>('[role="menu"] button')?.focus({ preventScroll: true }) }, [flyout])

  function closeFlyout(): void {
    if (flyout) root.current?.querySelector<HTMLElement>(`[data-tool="${CSS.escape(flyout)}"]`)?.focus()
    setFlyout(null)
  }

  function onFlyoutKey(e: KeyboardEvent<HTMLDivElement>): void {
    const options = [...e.currentTarget.querySelectorAll<HTMLElement>('button')]
    const at = options.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? options[(at + 1) % options.length] : e.key === 'ArrowUp' ? options[(at - 1 + options.length) % options.length] : e.key === 'Home' ? options[0] : e.key === 'End' ? options.at(-1) : undefined
    if (next) { e.preventDefault(); next.focus() }
    else if (e.key === 'Escape') { e.preventDefault(); closeFlyout() }
    else if (e.key === 'Tab') setFlyout(null)
  }

  function choose(id: string): void {
    setHeld(id)
    onValueChange?.(id)
  }

  // Single key shortcuts answer while the pointer or focus is on the canvas, and never in a text field.
  // The handler reads the latest render through a ref, so the window listener is added once.
  const shortcut = useRef<(e: globalThis.KeyboardEvent) => void>(() => undefined)
  const onShortcut = (e: globalThis.KeyboardEvent): void => {
    const target = e.target as HTMLElement
    if (e.metaKey || e.ctrlKey || e.altKey || target.closest('input, textarea, [contenteditable="true"]')) return
    const canvas = root.current?.parentElement
    if (!canvas || !(canvas.matches(':hover') || canvas.contains(document.activeElement))) return
    const key = e.key.toUpperCase()
    for (const tool of list) {
      const option = tool.options?.find((item) => item.shortcut === key)
      if (option) { setSlots((held2) => ({ ...held2, [tool.id]: option.id })); choose(tool.id); return }
      if (tool.shortcut === key) { choose(tool.id); return }
    }
  }
  useEffect(() => { shortcut.current = onShortcut })
  useEffect(() => {
    const down = (e: globalThis.KeyboardEvent): void => shortcut.current(e)
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, tool: Tool): void {
    const at = list.indexOf(tool)
    const vertical = edge === 'left' || edge === 'right'
    const [back, forward] = vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight']
    const next = e.key === forward ? list[(at + 1) % list.length] : e.key === back ? list[(at - 1 + list.length) % list.length] : e.key === 'Home' ? list[0] : e.key === 'End' ? list.at(-1) : undefined
    if (next) {
      e.preventDefault()
      setFocus(next.id)
      root.current?.querySelector<HTMLElement>(`[data-tool="${CSS.escape(next.id)}"]`)?.focus()
    } else if (e.key === 'Escape') setFlyout(null)
    else if (e.key === 'Enter' && tool.options) { e.preventDefault(); setFlyout(flyout === tool.id ? null : tool.id) }
  }

  function onDragEnd(_: unknown, info: PanInfo): void {
    setDragging(false)
    const canvas = root.current?.parentElement?.getBoundingClientRect()
    if (!canvas) return
    const distances: Record<DockEdge, number> = {
      bottom: canvas.bottom - info.point.y,
      top: info.point.y - canvas.top,
      left: info.point.x - canvas.left,
      right: canvas.right - info.point.x,
    }
    const nearest = EDGES.reduce((best, item) => (distances[item] < distances[best] ? item : best), edge)
    setHeldDock(nearest)
    onDockChange?.(nearest)
  }

  const slotIcon = (tool: Tool): ReactNode => tool.options?.find((item) => item.id === slots[tool.id])?.icon ?? tool.icon

  return (
    <>
      <AnimatePresence>
        {dragging ? EDGES.filter((item) => item !== edge).map((item) => <motion.span key={item} className={styles.zone} data-edge={item} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: still ? 0 : ZONE_S }} />) : null}
      </AnimatePresence>
      <motion.div
        ref={root}
        role="toolbar"
        aria-label={label}
        aria-orientation={edge === 'left' || edge === 'right' ? 'vertical' : 'horizontal'}
        className={cx(styles.dock, className)}
        data-edge={edge}
        data-dragging={dragging ? '' : undefined}
        {...(still ? {} : { layout: true })}
        transition={still ? { duration: 0 } : REDOCK}
        drag
        dragControls={controls}
        dragListener={false}
        dragMomentum={false}
        dragSnapToOrigin
        onDragStart={() => setDragging(true)}
        onDragEnd={onDragEnd}
      >
        <span className={styles.grip} aria-hidden="true" onPointerDown={(e) => controls.start(e)} />
        {tools.map((entry, i) => {
          if (!isTool(entry)) return <span key={i} role="separator" className={styles.divider} />
          const on = entry.id === current
          return (
            <span key={entry.id} className={styles.slot}>
              <Tooltip content={entry.label} side={edge === 'top' ? 'bottom' : edge === 'left' ? 'right' : edge === 'right' ? 'left' : 'top'} {...(entry.shortcut ? { shortcut: [entry.shortcut] } : {})} animated={animated} disabled={dragging || flyout !== null}>
                <motion.button
                  type="button"
                  className={styles.tool}
                  data-tool={entry.id}
                  data-on={on ? '' : undefined}
                  aria-label={entry.label}
                  aria-pressed={on}
                  aria-haspopup={entry.options ? 'menu' : undefined}
                  aria-expanded={entry.options ? flyout === entry.id : undefined}
                  aria-keyshortcuts={entry.shortcut}
                  tabIndex={stop === entry.id ? 0 : -1}
                  {...(still ? {} : { whileTap: { scale: scalePress } })}
                  transition={spring.press}
                  onFocus={() => setFocus(entry.id)}
                  onClick={() => choose(entry.id)}
                  onContextMenu={(e) => { if (entry.options) { e.preventDefault(); setFlyout(entry.id) } }}
                  onPointerDown={() => { if (entry.options) longPress.current = setTimeout(() => setFlyout(entry.id), LONG_PRESS_MS) }}
                  onPointerUp={() => clearTimeout(longPress.current)}
                  onPointerLeave={() => clearTimeout(longPress.current)}
                  onKeyDown={(e) => onKeyDown(e, entry)}
                >
                  {on ? <motion.span {...(still ? {} : { layoutId: `${uid}-plate` })} className={styles.plate} style={{ borderRadius: 9999 }} transition={spring.jump} /> : null}
                  <span className={styles.icon}>{slotIcon(entry)}</span>
                  {entry.options ? <span className={styles.caret} aria-hidden="true" /> : null}
                </motion.button>
              </Tooltip>
              <AnimatePresence>
                {flyout === entry.id && entry.options ? (
                  <motion.div
                    role="menu"
                    aria-label={entry.label}
                    className={styles.flyout}
                    data-edge={edge}
                    onKeyDown={onFlyoutKey}
                    initial={still ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, transition: { duration: still ? 0 : FLYOUT_S / 2 } }}
                    transition={{ duration: still ? 0 : FLYOUT_S }}
                  >
                    {entry.options.map((option) => (
                      <button key={option.id} type="button" role="menuitem" tabIndex={-1} className={styles.option} onClick={() => { setSlots({ ...slots, [entry.id]: option.id }); choose(entry.id); closeFlyout() }}>
                        <span className={styles.icon}>{option.icon}</span>
                        <span className={styles.optionLabel}>{option.label}</span>
                        {option.shortcut ? <span className={styles.optionKey}><Kbd size="sm">{option.shortcut}</Kbd></span> : null}
                      </button>
                    ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </span>
          )
        })}
      </motion.div>
    </>
  )
}
