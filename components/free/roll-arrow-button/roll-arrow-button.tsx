'use client'
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react'
import type { ReactNode, Ref } from 'react'
import { ArrowUp02Icon } from '@fetaui/react/rounded/arrow-up-02'
import { RefreshCwIcon } from '@fetaui/react/rounded/refresh-cw'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { duration, ease, scalePress, spring } from '../../motion-tokens'
import { cx, kit, useStill } from '../motion-kit/motion-kit'
import styles from './roll-arrow-button.module.css'

export type RollArrowStatus = 'idle' | 'loading' | 'success' | 'error'

export type RollArrowButtonProps = Omit<HTMLMotionProps<'button'>, 'children' | 'ref'> & {
  /** The resting label. */
  label?: string
  /** Where the action stands. You own it: set `loading` when the work starts, then `success` or `error`. */
  status?: RollArrowStatus
  loadingLabel?: string
  successLabel?: string
  errorLabel?: string
  /** Mercury, a liquid silver gradient, keeps its look in Light and Dark. Ink follows the theme. */
  tone?: 'mercury' | 'ink'
  size?: 'md' | 'lg'
  /** Replaces the arrow in the badge while idle. */
  icon?: ReactNode
  /** `false` keeps the label and arrow in place, and swaps statuses without movement. */
  animated?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** The shake on an error: a short, decaying sideways nudge. */
const SHAKE_X = [0, -5, 5, -3, 3, 0]

/**
 * A pill call to action with a round arrow badge. Hover or focus lifts it onto a soft shadow, rolls the label up
 * (the old line shrinks away, a slightly larger copy rises and settles) and swaps the arrow, the old one out to
 * the right and a new one in from the left. Leaving plays it back. Statuses roll in the same way: a spinner while
 * loading, a tick on success, a shake and a retry arrow on error.
 */
export function RollArrowButton({ label = 'Get started', status = 'idle', loadingLabel = 'Starting', successLabel = 'You’re in', errorLabel = 'Try again', tone = 'mercury', size = 'lg', icon, animated = true, className, disabled, type = 'button', onClick, ref, ...rest }: RollArrowButtonProps) {
  const still = useStill(animated)
  const text = status === 'loading' ? loadingLabel : status === 'success' ? successLabel : status === 'error' ? errorLabel : label
  const busy = status === 'loading'
  const moving = !still

  const roll = still
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: duration.focus } }
    : { initial: { y: '110%', scale: 1.08, opacity: 0 }, animate: { y: '0%', scale: 1, opacity: 1 }, exit: { y: '-110%', scale: 0.92, opacity: 0 }, transition: { duration: 0.36, ease: ease['out-soft'] } }
  const pop = still
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: duration.focus } }
    : { initial: { scale: 0.4, opacity: 0, rotate: -30 }, animate: { scale: 1, opacity: 1, rotate: 0 }, exit: { scale: 0.4, opacity: 0 }, transition: spring.pop }

  return (
    <>
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      data-status={status}
      data-tone={tone}
      data-size={size}
      data-still={still ? '' : undefined}
      className={cx(kit.control, styles.button, className)}
      onClick={(event) => { if (busy) { event.preventDefault(); return } onClick?.(event) }}
      // One transition object: the press spring, the width ease between labels and the error shake.
      layout={moving}
      animate={moving && status === 'error' ? { x: SHAKE_X } : { x: 0 }}
      {...(moving && !busy && !disabled ? { whileTap: { scale: scalePress - 0.01 } } : {})}
      transition={{ scale: spring.press, layout: { duration: duration.width, ease: ease.out }, x: { duration: moving ? duration.shake : 0, ease: ease.standard } }}
      {...rest}
    >
      <span className={styles.window}>
        <AnimatePresence mode="popLayout" initial={false}>
          {status === 'idle' ? (
            // Idle: two rows that roll on hover in CSS, so the pointer never re-renders.
            <motion.span key="idle" className={styles.roll} {...roll}>
              <span className={styles.row}>{label}</span>
              <span className={styles.row} aria-hidden="true">{label}</span>
            </motion.span>
          ) : (
            <motion.span key={status} className={styles.status} {...roll}>{text}</motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className={styles.badge} aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false}>
          {status === 'idle' ? (
            <motion.span key="idle" className={styles.arrows} {...pop}>
              {/* The long arrow is the upward one, turned to point right. */}
              <span className={cx(styles.arrow, !icon && styles.long)}>{icon ?? <ArrowUp02Icon trigger="none" />}</span>
              <span className={cx(styles.arrow, !icon && styles.long)}>{icon ?? <ArrowUp02Icon trigger="none" />}</span>
            </motion.span>
          ) : status === 'loading' ? (
            <motion.span key="loading" className={styles.spinner} {...pop} />
          ) : (
            <motion.span key={status} className={styles.glyph} {...pop}>
              {status === 'success' ? <Tick02Icon trigger="none" /> : <RefreshCwIcon trigger="none" />}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
    {/* Each status is announced once as it changes; the resting label is not. */}
    <span className={styles.live} role="status">{status === 'idle' ? '' : text}</span>
    </>
  )
}
