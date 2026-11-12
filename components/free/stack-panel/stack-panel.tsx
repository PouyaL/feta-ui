'use client'
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useTransform, type PanInfo, type Variants } from 'motion/react'
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { ChevronLeftIcon } from '@fetaui/react/rounded/chevron-left'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { ease } from '../../motion-tokens'
import { Button } from '../button/button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Switch } from '../switch/switch'
import styles from './stack-panel.module.css'

const PUSH_S = 0.34
const POP_S = 0.3
const CHECK_S = 0.16
const IOS_EASE = [0.32, 0.72, 0, 1] as const
/** The parent waits this far left, in percent of the panel. */
const PARENT_SHIFT = -18
/** A swipe back past this share of the width commits on release. */
const POP_AT = 0.4
/** A flick faster than this, in px/s, decides on its own: rightward commits, leftward cancels. */
const FLICK_SPEED = 500
/** A committed swipe finishes the rest of the way in proportion, but never quicker than this. */
const MIN_FINISH_S = 0.1
/** Swipe back starts within this far of the left edge. */
const EDGE_PX = 24

export type StackRow =
  | { kind?: 'link'; id: string; label: string; icon?: ReactNode; detail?: string; to: string }
  | { kind: 'choice'; id: string; label: string; group: string; defaultOn?: boolean }
  | { kind: 'switch'; id: string; label: string; detail?: string; defaultOn?: boolean; onChange?: (on: boolean) => void }
  | { kind: 'value'; id: string; label: string; detail: string }
  | { kind: 'danger'; id: string; label: string; onSelect?: () => void }

export type StackSection = { title?: string; note?: string; rows: StackRow[] }
export type StackPage = { title: string; sections: StackSection[] }

/** Which way the stack moved, and for a swipe back, the share of the width the finger already covered. */
type Travel = { to: 1 | -1; swiped: number }

export type StackPanelProps = {
  /** Every page, by id. */
  pages: Record<string, StackPage>
  root: string
  /** Starts deeper in. Ids from the root's child down. */
  defaultPath?: string[]
  onPathChange?: (path: string[]) => void
  /** Fires when a `choice` row is picked, with its group and row id. */
  onChoiceChange?: (group: string, id: string) => void
  animated?: boolean
  className?: string
}

/** A settings panel that drills into pages and back. Swipe back reveals the parent underneath. */
export function StackPanel({ pages, root, defaultPath = [], onPathChange, onChoiceChange, animated = true, className }: StackPanelProps) {
  const still = useStill(animated)
  const heading = useRef<HTMLHeadingElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const lastRow = useRef<string[]>([])
  const moved = useRef(false)
  const controls = useDragControls()
  const [path, setPath] = useState(defaultPath)
  const [travel, setTravel] = useState<Travel>({ to: 1, swiped: 0 })
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [switches, setSwitches] = useState<Record<string, boolean>>({})
  const dragX = useMotionValue(0)
  const under = useTransform(dragX, (x) => {
    const width = viewport.current?.clientWidth ?? 1
    return `${PARENT_SHIFT * (1 - Math.min(1, x / width))}%`
  })
  const pageId = path.at(-1) ?? root
  const parentId = path.length ? path.at(-2) ?? root : null
  const page = pages[pageId]
  const parent = parentId ? pages[parentId] : undefined

  useEffect(() => {
    if (!moved.current) return
    if (travel.to > 0) heading.current?.focus({ preventScroll: true })
    else {
      const row = lastRow.current.pop()
      if (row) viewport.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(row)}"]`)?.focus({ preventScroll: true })
    }
  }, [path, travel])

  function push(row: string, to: string): void {
    moved.current = true
    lastRow.current.push(row)
    setTravel({ to: 1, swiped: 0 })
    const next = [...path, to]
    setPath(next)
    onPathChange?.(next)
  }

  /** `swiped` is the share of the width a released swipe covered, so the pages carry on from there instead of jumping back. */
  function pop(swiped = 0): void {
    if (!path.length) return
    moved.current = true
    setTravel({ to: -1, swiped })
    const next = path.slice(0, -1)
    setPath(next)
    dragX.set(0)
    onPathChange?.(next)
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>): void {
    const left = viewport.current?.getBoundingClientRect().left ?? 0
    if (path.length && e.pointerType !== 'mouse' && e.clientX - left < EDGE_PX) controls.start(e)
  }

  // Commit on a rightward flick, or past POP_AT unless flicked back left. Otherwise the page eases home.
  function onDragEnd(_: unknown, info: PanInfo): void {
    const width = viewport.current?.clientWidth ?? 1
    const commit = info.velocity.x > FLICK_SPEED || (info.offset.x > width * POP_AT && info.velocity.x > -FLICK_SPEED)
    if (commit) pop(Math.min(1, Math.max(0, dragX.get() / width)))
    else animate(dragX, 0, { duration: still ? 0 : POP_S, ease: ease.out })
  }

  const rowView = (row: StackRow): ReactNode => {
    if (row.kind === 'switch') {
      const on = switches[row.id] ?? row.defaultOn ?? false
      return (
        <div key={row.id} className={styles.row}>
          <span className={styles.rowLabel}>{row.label}{row.detail ? <small>{row.detail}</small> : null}</span>
          <Switch aria-label={row.label} checked={on} animated={animated} onCheckedChange={(next) => { setSwitches({ ...switches, [row.id]: next }); row.onChange?.(next) }} />
        </div>
      )
    }
    if (row.kind === 'value') return <div key={row.id} className={styles.row}><span className={styles.rowLabel}>{row.label}</span><span className={styles.detail}>{row.detail}</span></div>
    if (row.kind === 'danger') return <button key={row.id} type="button" className={styles.row} data-danger="" onClick={row.onSelect}><span className={styles.rowLabel}>{row.label}</span></button>
    if (row.kind === 'choice') {
      const on = (choices[row.group] ?? (row.defaultOn ? row.id : undefined)) === row.id
      return (
        <button key={row.id} type="button" role="radio" aria-checked={on} className={styles.row} onClick={() => { if (!on) { setChoices({ ...choices, [row.group]: row.id }); onChoiceChange?.(row.group, row.id) } }}>
          <span className={styles.rowLabel}>{row.label}</span>
          {on ? <motion.span className={styles.check} initial={still ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: still ? 0 : CHECK_S, ease: ease.out }}><Tick02Icon /></motion.span> : null}
        </button>
      )
    }
    return (
      <button key={row.id} type="button" className={styles.row} data-row={row.id} onClick={() => push(row.id, row.to)}>
        {row.icon ? <span className={styles.icon}>{row.icon}</span> : null}
        <span className={styles.rowLabel}>{row.label}</span>
        {row.detail ? <span className={styles.detail}>{row.detail}</span> : null}
        <span className={styles.chevron}><ChevronRightIcon /></span>
      </button>
    )
  }

  const sections = (target: StackPage): ReactNode => target.sections.map((section, i) => (
    <section key={section.title ?? i} className={styles.section}>
      {section.title ? <h3 className={styles.sectionTitle}>{section.title}</h3> : null}
      <div className={styles.card} role={section.rows.some((row) => row.kind === 'choice') ? 'radiogroup' : undefined} aria-label={section.title}>{section.rows.map(rowView)}</div>
      {section.note ? <p className={styles.note}>{section.note}</p> : null}
    </section>
  ))

  // A leaving page keeps the props of its last render, so the travel reaches it through `custom`.
  // After a swipe, both pages start where the finger left them and finish the remaining distance in proportion.
  const settle = (t: Travel): number => (t.to > 0 ? PUSH_S : Math.max(MIN_FINISH_S, POP_S * (1 - t.swiped)))
  const pageMotion: Variants = {
    enter: (t: Travel) => (still ? { opacity: 1, x: 0 } : { opacity: 1, x: t.to > 0 ? '100%' : `${PARENT_SHIFT * (1 - t.swiped)}%` }),
    rest: (t: Travel) => ({ opacity: 1, x: 0, transition: { duration: still ? 0 : settle(t), ease: IOS_EASE } }),
    leave: (t: Travel) => (still ? { opacity: 0, transition: { duration: 0 } } : {
      x: t.to > 0 ? `${PARENT_SHIFT}%` : t.swiped ? [`${t.swiped * 100}%`, '100%'] : '100%',
      zIndex: t.to > 0 ? 0 : 2,
      transition: { duration: settle(t), ease: IOS_EASE },
    }),
  }

  return (
    <div className={cx(styles.panel, className)}>
      <div ref={viewport} className={styles.viewport} onPointerDown={onPointerDown} onKeyDown={(e) => { if (e.key === 'Escape' && path.length) { e.preventDefault(); pop() } }}>
        {parent ? <motion.div className={styles.under} style={{ x: still ? 0 : under }} aria-hidden="true" inert><div className={styles.nav} />{sections(parent)}</motion.div> : null}
        <AnimatePresence initial={false} mode="popLayout" custom={travel}>
          <motion.div
            key={pageId}
            role="region"
            aria-labelledby={`${pageId}-title`}
            className={styles.page}
            custom={travel}
            variants={pageMotion}
            initial="enter"
            animate="rest"
            exit="leave"
          >
            {/* The page enters on the outer layer and the finger moves this one, so they never fight. */}
            <motion.div
              style={{ x: dragX }}
              drag={path.length ? 'x' : false}
              dragControls={controls}
              dragListener={false}
              dragMomentum={false}
              dragElastic={0}
              dragConstraints={{ left: 0, right: viewport.current?.clientWidth ?? 0 }}
              onDragEnd={onDragEnd}
            >
              <div className={styles.sheet}>
                <div className={styles.nav}>
                  {parent ? <Button variant="ghost" size="sm" shape="pill" animated={animated} leadingIcon={<ChevronLeftIcon />} onClick={() => pop()}>{parent.title}</Button> : null}
                  <h2 ref={heading} id={`${pageId}-title`} tabIndex={-1} className={styles.title}>{page?.title}</h2>
                </div>
                {page ? sections(page) : null}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
