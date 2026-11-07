'use client'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { ease } from '../../motion-tokens'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './frame-rule.module.css'

const DRAW_S = 0.6
const DOT_DELAY_S = 0.48
const DOT_S = 0.16
const OUT = ease.out

export type FrameRuleProps = {
  children: ReactNode
  /** Band at 4% and rules inked inside the column. */
  selected?: boolean
  /** `false` keeps the rules drawn from the start. */
  animated?: boolean
  className?: string
}

/** The hairlines of a framed section: sides, rules past the edges, a dot at each crossing. For marketing and docs, never forms. */
export function FrameRule({ children, selected = false, animated = true, className }: FrameRuleProps) {
  const still = useStill(animated)
  const draw = { initial: still ? false : { scaleX: 0 }, whileInView: { scaleX: 1 }, viewport: { once: true }, transition: still ? { duration: 0 } : { duration: DRAW_S, ease: OUT }, style: { transformOrigin: 'center' } }
  const dot = { initial: still ? false : { scale: 0 }, whileInView: { scale: 1 }, viewport: { once: true }, transition: still ? { duration: 0 } : { duration: DOT_S, delay: DOT_DELAY_S, ease: OUT } }
  return (
    <section className={cx(styles.frame, className)} data-selected={selected ? '' : undefined}>
      <motion.span aria-hidden="true" className={styles.rule} data-edge="top" {...draw} />
      <motion.span aria-hidden="true" className={styles.rule} data-edge="bottom" {...draw} />
      <span aria-hidden="true" className={styles.side} data-side="left" />
      <span aria-hidden="true" className={styles.side} data-side="right" />
      {['tl', 'tr', 'bl', 'br'].map((corner) => <motion.span key={corner} aria-hidden="true" className={styles.dot} data-corner={corner} {...dot} />)}
      <div className={styles.column}>{children}</div>
    </section>
  )
}
