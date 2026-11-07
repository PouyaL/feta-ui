'use client'
import { motion, type HTMLMotionProps } from 'motion/react'
import { useState, type ReactNode, type Ref } from 'react'
import { cx, kit, pressProps, useStill } from '../motion-kit/motion-kit'
import styles from './expanding-arrow-button.module.css'

export type ExpandingArrowButtonProps = Omit<HTMLMotionProps<'button'>, 'children' | 'ref'> & {
  kind?: 'primary' | 'secondary'
  children?: ReactNode
  /** `false` still opens the chip, without motion, and turns off the press scale. */
  animated?: boolean
  ref?: Ref<HTMLButtonElement>
}

const TRAILS = [0, 1, 2, 3, 4] as const
/** Dots per column of one chevron. */
const COLUMNS = [2, 2, 1] as const

function Chevron() {
  return (
    <span className={styles.trail}>
      {COLUMNS.map((dots, column) => (
        <span key={column} className={styles.column}>
          {Array.from({ length: dots }, (_, dot) => <span key={dot} className={styles.dot} />)}
        </span>
      ))}
    </span>
  )
}

/** A wide call to action. On hover or focus, the chip opens across it as its chevrons run. */
export function ExpandingArrowButton({ kind = 'primary', children = 'Get started', animated = true, className, disabled, type = 'button', onTapStart, onTap, onTapCancel, ref, ...rest }: ExpandingArrowButtonProps) {
  const still = useStill(animated)
  // Motion's tap, not `:active`: Safari skips `:active` here and it misses a held Enter key.
  const [pressed, setPressed] = useState(false)
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      data-kind={kind}
      data-still={still ? '' : undefined}
      data-pressed={pressed && !disabled ? '' : undefined}
      className={cx(kit.control, styles.button, className)}
      {...pressProps(still, disabled)}
      {...rest}
      onTapStart={(...args) => { setPressed(true); onTapStart?.(...args) }}
      onTap={(...args) => { setPressed(false); onTap?.(...args) }}
      onTapCancel={(...args) => { setPressed(false); onTapCancel?.(...args) }}
    >
      <span className={styles.chip} aria-hidden="true">
        {TRAILS.map((trail) => <Chevron key={trail} />)}
      </span>
      {/* Stays in the DOM while hidden: it is the button's accessible name. */}
      <span className={styles.label}>{children}</span>
    </motion.button>
  )
}
