'use client'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { XIcon } from '@fetaui/react/rounded/x'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Spinner } from '../spinner/spinner'
import styles from './code-output.module.css'

const MARK_SPRING = { type: 'spring', duration: 0.24, bounce: 0.3 } as const
const STREAM_S = 0.04
const STREAM_MAX_LINES = 8

export type CodeOutputProps = {
  state: 'running' | 'done' | 'failed'
  command: string
  /** Live or final duration, like `2.1s`. */
  duration?: string
  /** Output so far, one string per line. */
  lines?: string[]
  /** Extra line in the danger colour, like `Exit code 1`. */
  footer?: ReactNode
  animated?: boolean
  className?: string
}

/** A command and its output. Lines stream in while it runs, then a mark settles. */
export function CodeOutput({ state, command, duration, lines = [], footer, animated = true, className }: CodeOutputProps) {
  const still = useStill(animated)
  const verb = state === 'running' ? 'Running' : state === 'done' ? 'Ran' : 'Failed to run'
  return (
    <div className={cx(styles.tray, className)} data-state={state}>
      <div className={styles.header}>
        <span className={styles.status}>
          {state === 'running' ? <Spinner size={16} label={null} animated={animated} /> : (
            <motion.span key={state} className={styles.mark} initial={still ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={MARK_SPRING}>{state === 'done' ? <Tick02Icon /> : <XIcon />}</motion.span>
          )}
        </span>
        <span className={styles.command}>{verb} <code>{command}</code></span>
        {duration ? <span className={styles.duration}>{duration}</span> : null}
      </div>
      <div className={styles.card} role="log" aria-busy={state === 'running'}>
        <p className={styles.prompt}>$ {command}</p>
        <AnimatePresence initial={false}>
          {lines.map((line, i) => (
            <motion.p key={`${i}-${line}`} className={styles.line} initial={still ? { opacity: 1 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: still ? 0 : 0.2, delay: still ? 0 : Math.min(i, STREAM_MAX_LINES) * STREAM_S }}>{line}</motion.p>
          ))}
        </AnimatePresence>
        {state === 'running' && lines.length === 0 ? <p className={styles.line}>{'…'}</p> : null}
        {footer ? <p className={styles.footer}>{footer}</p> : null}
      </div>
    </div>
  )
}
