'use client'
import { motion, type HTMLMotionProps } from 'motion/react'
import type { Ref } from 'react'
import { cx, kit, pressProps, useStill } from '../motion-kit/motion-kit'
import styles from './slide-text-button.module.css'

export type SlideTextButtonProps = Omit<HTMLMotionProps<'button'>, 'children' | 'ref'> & {
  label?: string
  /** The label that rises in on hover or focus. */
  hoverLabel?: string
  variant?: 'primary' | 'secondary'
  /** `false` keeps the label in place and turns off the press scale. */
  animated?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** The label slides up one row on hover or focus while a second label rises in. */
export function SlideTextButton({ label = 'Get started', hoverLabel = 'Let’s go', variant = 'primary', animated = true, className, disabled, type = 'button', ref, ...rest }: SlideTextButtonProps) {
  const still = useStill(animated)
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-label={label}
      data-still={still ? '' : undefined}
      className={cx(kit.control, variant === 'primary' ? kit.inverse : kit.soft, styles.button, className)}
      {...pressProps(still, disabled)}
      {...rest}
    >
      <span className={styles.window} aria-hidden="true">
        <span className={styles.row}>{label}</span>
        <span className={styles.row}>{hoverLabel}</span>
      </span>
    </motion.button>
  )
}
