'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { XIcon } from '@fetaui/react/rounded/x'
import { RotateCcwIcon } from '@fetaui/react/rounded/rotate-ccw'
import { duration, ease, spring } from '../../motion-tokens'
import { Button } from '../button/button'
import { cx, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import styles from './status-island.module.css'

const MORPH = { type: 'spring', stiffness: 400, damping: 30 } as const
const ENTER_Y = 12
const SHAKE_S = 0.26
const SHAKE_X = [0, -3, 3, -3, 3, 0]
const EXPAND_S = 0.26
const RING_S = 0.2
const ROW_STAGGER_S = 0.03
const SETTLED_MS = 5000
const RING_RADIUS = 11.5

export type StatusTask = {
  id: string
  state: 'running' | 'indeterminate' | 'done' | 'undo' | 'error'
  title: string
  detail?: string
  /** 0 to 100, for `running`. */
  progress?: number
  /** Open, Undo or Retry. */
  actionLabel?: string
  onAction?: () => void
}

export type StatusIslandProps = {
  /** The first is shown and the others wait behind it. */
  tasks: StatusTask[]
  /** A task finished showing: done and undo after 5 seconds, longer while hovered. */
  onExpire?: (id: string) => void
  onClearDone?: () => void
  /** Opens the tray from the start. */
  defaultExpanded?: boolean
  animated?: boolean
  className?: string
}

function Ring({ value, animated }: { value: number | null; animated: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const still = useStill(animated)
  useEffect(() => (ref.current ? watchOffscreen(ref.current) : undefined), [])
  if (value === null) {
    return (
      <span ref={ref} data-loop="" className={styles.ring} data-spin={animated ? '' : undefined} data-pulse={animated && still ? '' : undefined} role="progressbar" aria-label="Working">
        <svg viewBox="0 0 28 28"><circle cx="14" cy="14" r={RING_RADIUS} className={styles.track} /><circle cx="14" cy="14" r={RING_RADIUS} className={styles.arc} pathLength={1} strokeDasharray="0.28 1" /></svg>
      </span>
    )
  }
  return (
    <span ref={ref} className={styles.ring} role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <svg viewBox="0 0 28 28">
        <circle cx="14" cy="14" r={RING_RADIUS} className={styles.track} />
        <motion.circle cx="14" cy="14" r={RING_RADIUS} className={styles.arc} initial={false} animate={{ pathLength: value / 100 }} transition={{ duration: still ? 0 : RING_S, ease: ease.out }} />
      </svg>
    </span>
  )
}

const leading = (task: StatusTask, still: boolean, animated: boolean): ReactNode => {
  if (task.state === 'running') return <Ring value={task.progress ?? 0} animated={animated} />
  if (task.state === 'indeterminate') return <Ring value={null} animated={animated} />
  const glyph = task.state === 'done' ? <Tick02Icon trigger="inView" speed={2} /> : task.state === 'undo' ? <RotateCcwIcon /> : <XIcon />
  return <motion.span className={styles.badge} data-state={task.state} initial={still ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={still ? { duration: 0 } : spring.stamp}>{glyph}</motion.span>
}

/** A floating pill that reports background work. It morphs between states and opens into a tray of every task. */
export function StatusIsland({ tasks, onExpire, onClearDone, defaultExpanded = false, animated = true, className }: StatusIslandProps) {
  const still = useStill(animated)
  const expire = useRef(onExpire)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const task = tasks[0]
  const waiting = Math.min(tasks.length - 1, 2)

  const id = task?.id
  const state = task?.state

  useEffect(() => { expire.current = onExpire })

  // On the task's id and state alone, so a parent's re-render cannot keep pushing the timer back.
  useEffect(() => {
    if (id === undefined || expanded || (state !== 'done' && state !== 'undo')) return
    const timer = setTimeout(() => expire.current?.(id), SETTLED_MS)
    return () => clearTimeout(timer)
  }, [id, state, expanded])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Escape' && expanded) { e.preventDefault(); setExpanded(false) }
  }

  if (!task) return null
  const failed = task.state === 'error'
  const action = (item: StatusTask): ReactNode => (item.actionLabel ? <Button variant="ghost" size="sm" shape="pill" animated={animated} onClick={item.onAction}>{item.actionLabel}</Button> : null)
  const percent = (item: StatusTask): ReactNode => (item.state === 'running' ? <span className={styles.percent}>{item.progress ?? 0}%</span> : null)
  const offsetTask = tasks.filter((item) => item.state === 'done').length

  return (
    <div className={cx(styles.root, className)} data-still={still ? '' : undefined} onPointerEnter={(e) => { if (e.pointerType === 'mouse') setExpanded(true) }} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setExpanded(false) }} onKeyDown={onKeyDown}>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            className={styles.tray}
            initial={still ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 8, transition: { duration: duration.close } }}
            transition={{ duration: still ? 0 : EXPAND_S, ease: ease.out }}
          >
            <div className={styles.trayHead}>
              <span>{tasks.length} {tasks.length === 1 ? 'TASK' : 'TASKS'}</span>
              {offsetTask ? <Button variant="ghost" size="sm" animated={animated} onClick={onClearDone}>Clear done</Button> : null}
            </div>
            <ul className={styles.rows}>
              {tasks.map((item, i) => (
                <motion.li key={item.id} className={styles.row} initial={still ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: still ? 0 : EXPAND_S, delay: still ? 0 : i * ROW_STAGGER_S, ease: ease.out }}>
                  {leading(item, still, animated)}
                  <span className={styles.rowText}><strong>{item.title}</strong>{item.detail ? <span>{item.detail}</span> : null}</span>
                  {percent(item)}{action(item)}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className={styles.stack}>
        {Array.from({ length: waiting }, (_, i) => <motion.span key={i} className={styles.layer} data-depth={i + 1} initial={still ? false : { opacity: 0, y: 7 }} animate={{ opacity: i === 0 ? 0.7 : 0.4, y: -7 * (i + 1), scale: i === 0 ? 0.94 : 0.88 }} transition={{ duration: still ? 0 : EXPAND_S, ease: ease.out }} />)}
        <motion.div
          className={styles.pill}
          data-state={task.state}
          {...(still ? {} : { layout: true })}
          initial={still ? false : { opacity: 0, y: ENTER_Y, scale: 0.96 }}
          animate={still || !failed ? { opacity: 1, y: 0, scale: 1, x: 0 } : { opacity: 1, y: 0, scale: 1, x: SHAKE_X }}
          transition={failed && !still ? { x: { duration: SHAKE_S, ease: ease.out }, default: MORPH } : (still ? { duration: 0 } : MORPH)}
        >
          <button type="button" className={styles.pillMain} aria-expanded={expanded} aria-label={`${tasks.length} background ${tasks.length === 1 ? 'task' : 'tasks'}`} onClick={() => setExpanded(!expanded)}>
            {leading(task, still, animated)}
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span key={`${task.id}-${task.state}`} className={styles.pillText} initial={still ? false : { opacity: 0, filter: 'blur(2px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, filter: 'blur(2px)' }} transition={{ duration: still ? 0 : duration.base, ease: ease.out }}>
                <strong>{task.title}</strong>{task.detail ? <span> · {task.detail}</span> : null}
              </motion.span>
            </AnimatePresence>
            {percent(task)}
            {tasks.length > 1 ? <span className={styles.percent}>{tasks.length - 1}</span> : null}
          </button>
          {action(task)}
        </motion.div>
        {/* A live region of its own, so the expanded tray is not read on every tick. */}
        <span className={styles.srOnly} role={failed ? 'alert' : 'status'} aria-live={failed ? 'assertive' : 'polite'}>{task.title}{task.detail ? `, ${task.detail}` : ''}</span>
      </div>
    </div>
  )
}
