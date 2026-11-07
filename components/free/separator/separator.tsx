'use client'
import { motion } from 'motion/react'
import { type HTMLAttributes, type ReactNode, type Ref } from 'react'
import { ease } from '../../motion-tokens'
import { cx, useStill } from '../motion-kit/motion-kit'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import styles from './separator.module.css'

const DRAW_S = 0.24
const LABEL_S = 0.2
const KNOT_S = 0.2
/** Out back, for the knot. */
const KNOT_EASE = [0.34, 1.56, 0.64, 1] as const
const OUT = ease.out

export type SeparatorProps = Omit<HTMLAttributes<HTMLDivElement>, 'ref'> & {
  /** Default `horizontal`. */
  orientation?: 'horizontal' | 'vertical'
  /** Default `line`. */
  kind?: 'line' | 'fade' | 'dotted' | 'label' | 'icon'
  /** The word for `label`, like OR or TODAY. */
  label?: string
  /** Swaps the plus in the `icon` knot. */
  icon?: ReactNode
  /** Set `true` only when the division means something, like groups in a menu. */
  semantic?: boolean
  /** Draws in on mount, when it arrives with new content. Default `false`: separators stay still. */
  appear?: boolean
  animated?: boolean
  ref?: Ref<HTMLDivElement>
}

/** A quiet divider. Never takes focus or reacts to hover. */
export function Separator({ orientation = 'horizontal', kind = 'line', label, icon, semantic = false, appear = false, animated = true, className, ...rest }: SeparatorProps) {
  const still = useStill(animated)
  const axis = orientation === 'horizontal' ? 'scaleX' : 'scaleY'
  // Keep `animate` when still, so a first render that started moving always lands.
  const enter = (from: Record<string, number>, to: Record<string, number>, duration: number, curve: readonly [number, number, number, number]) => (appear
    ? { initial: still ? false : from, animate: to, transition: still ? { duration: 0 } : { duration, ease: curve } }
    : {})
  const rule = enter({ [axis]: 0 }, { [axis]: 1 }, DRAW_S, OUT)
  const a11y = semantic ? { role: 'separator', 'aria-orientation': orientation } : { role: 'none', 'aria-hidden': kind === 'label' ? undefined : true }
  const parts = kind === 'label' || kind === 'icon'

  return (
    <div {...a11y} data-orientation={orientation} data-kind={kind} className={cx(styles.separator, className)} {...rest}>
      {parts ? (
        <>
          <motion.span className={styles.rule} {...rule} />
          {kind === 'label' ? (
            <motion.span className={styles.label} {...enter({ opacity: 0, y: 4 }, { opacity: 1, y: 0 }, LABEL_S, OUT)}>{label}</motion.span>
          ) : (
            <motion.span className={styles.knot} {...enter({ scale: 0.6 }, { scale: 1 }, KNOT_S, KNOT_EASE)}>{icon ?? <PlusIcon size={12} />}</motion.span>
          )}
          <motion.span className={styles.rule} {...rule} />
        </>
      ) : <motion.span className={styles.rule} {...rule} />}
    </div>
  )
}
