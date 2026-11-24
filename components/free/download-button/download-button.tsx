'use client'
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react'
import type { Ref } from 'react'
import { ArrowUpRightIcon } from '@fetaui/react/rounded/arrow-up-right'
import { RefreshCwIcon } from '@fetaui/react/rounded/refresh-cw'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { duration, ease, scalePress, spring } from '../../motion-tokens'
import { cx, kit, useStill } from '../motion-kit/motion-kit'
import styles from './download-button.module.css'

export type DownloadStatus = 'idle' | 'downloading' | 'done' | 'error'

export type DownloadButtonProps = Omit<HTMLMotionProps<'button'>, 'children' | 'ref'> & {
  /** The resting label. */
  label?: string
  /** Where the download stands. You own it: set `downloading` when it starts, then `done` or `error`. */
  status?: DownloadStatus
  /** How far along, from 0 to 1. Leave it out while the size is unknown and the ring turns instead. */
  progress?: number
  doneLabel?: string
  errorLabel?: string
  /** `false` keeps the label and arrow in place, and swaps statuses without movement. */
  animated?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** The ring's circumference, on a 36 unit circle with a radius of 16. */
const RING = 2 * Math.PI * 16
/** The shake on an error: a short, decaying sideways nudge. */
const SHAKE_X = [0, -4, 4, -2, 2, 0]

/**
 * A download call to action: a white pill with the label beside an orange badge holding a diagonal arrow. Hover or
 * focus rolls the label up one row and sends the arrow out to the top right while a new one comes in from the
 * bottom left. While downloading, a ring fills round the badge and the label counts the percentage; done swaps in
 * a tick, and an error shakes once and offers a retry.
 */
export function DownloadButton({ label = 'Download CV', status = 'idle', progress, doneLabel = 'Downloaded', errorLabel = 'Try again', animated = true, className, disabled, type = 'button', onClick, ref, ...rest }: DownloadButtonProps) {
  const still = useStill(animated)
  const moving = !still
  const busy = status === 'downloading'
  const known = progress !== undefined
  const pct = known ? Math.round(Math.min(1, Math.max(0, progress)) * 100) : 0
  const text = status === 'downloading' ? (known ? `Downloading ${pct}%` : 'Downloading') : status === 'done' ? doneLabel : status === 'error' ? errorLabel : label

  const roll = still
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: duration.focus } }
    : { initial: { y: '110%', opacity: 0 }, animate: { y: '0%', opacity: 1 }, exit: { y: '-110%', opacity: 0 }, transition: { duration: 0.32, ease: ease['out-soft'] } }
  const pop = still
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: duration.focus } }
    : { initial: { scale: 0.4, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.4, opacity: 0 }, transition: spring.pop }

  return (
    <>
      <motion.button
        ref={ref}
        type={type}
        disabled={disabled}
        aria-busy={busy || undefined}
        aria-disabled={busy || undefined}
        data-status={status}
        data-still={still ? '' : undefined}
        className={cx(kit.control, styles.button, className)}
        onClick={(event) => { if (busy) { event.preventDefault(); return } onClick?.(event) }}
        // One transition object: the press spring, the width ease between labels and the error shake.
        layout={moving}
        animate={moving && status === 'error' ? { x: SHAKE_X } : { x: 0 }}
        {...(moving && !busy && !disabled ? { whileTap: { scale: scalePress } } : {})}
        transition={{ scale: spring.press, layout: { duration: duration.width, ease: ease.out }, x: { duration: moving ? duration.shake : 0, ease: ease.standard } }}
        {...rest}
      >
        <span className={styles.pill}>
          <span className={styles.window}>
            <AnimatePresence mode="popLayout" initial={false}>
              {status === 'idle' ? (
                // Idle: two rows that roll on hover in CSS, so the pointer never re-renders.
                <motion.span key="idle" className={styles.roll} {...roll}>
                  <span className={styles.row}>{label}</span>
                  <span className={styles.row} aria-hidden="true">{label}</span>
                </motion.span>
              ) : (
                // The percentage changes in place; only a new status rolls.
                <motion.span key={status} className={styles.status} {...roll}>{text}</motion.span>
              )}
            </AnimatePresence>
          </span>
        </span>
        <span className={styles.badge} aria-hidden="true">
          {status === 'downloading' ? (
            <svg className={styles.ring} data-known={known ? '' : undefined} viewBox="0 0 36 36">
              <circle className={styles.track} cx="18" cy="18" r="16" />
              <circle className={styles.fill} cx="18" cy="18" r="16" strokeDasharray={RING} strokeDashoffset={known ? RING * (1 - pct / 100) : RING * 0.72} />
            </svg>
          ) : null}
          <AnimatePresence mode="popLayout" initial={false}>
            {status === 'idle' || status === 'downloading' ? (
              <motion.span key="arrows" className={styles.arrows} {...pop}>
                <span className={styles.arrow}><ArrowUpRightIcon trigger="none" /></span>
                <span className={styles.arrow}><ArrowUpRightIcon trigger="none" /></span>
              </motion.span>
            ) : (
              <motion.span key={status} className={styles.glyph} {...pop}>
                {status === 'done' ? <Tick02Icon trigger="none" /> : <RefreshCwIcon trigger="none" />}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </motion.button>
      {/* Each status is announced once as it changes, and the percentage at its tens. */}
      <span className={styles.live} role="status">{status === 'idle' ? '' : status === 'downloading' && known ? `Downloading ${Math.floor(pct / 10) * 10}%` : text}</span>
    </>
  )
}
