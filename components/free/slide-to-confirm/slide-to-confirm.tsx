'use client'
import { animate, motion, useMotionTemplate, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type CSSProperties } from 'react'
import { ArrowRightIcon } from '@fetaui/react/rounded/arrow-right'
import { LoaderIcon } from '@fetaui/react/rounded/loader'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { spring } from '../../motion-tokens'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './slide-to-confirm.module.css'

const INSET = 4
const THUMB = 48
const COMMIT_AT = 0.9
const FLICK = 800
const NUDGE = 0.1

export type SlideToConfirmProps = {
  label?: string
  doneLabel?: string
  /** Runs at the end of the slide. The thumb shows a loader until the promise settles. */
  onConfirm?: () => Promise<void> | void
  disabled?: boolean
  /** `false` jumps the thumb instead of springing it. */
  animated?: boolean
  className?: string
}

type State = 'idle' | 'dragging' | 'confirming' | 'done'

/** Drag the thumb across to confirm. Past 90% or a fast flick, it commits. */
export function SlideToConfirm({ label = 'Slide to pay $24.00', doneLabel = 'Paid', onConfirm, disabled, animated = true, className }: SlideToConfirmProps) {
  const still = useStill(animated)
  const track = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const [state, setState] = useState<State>('idle')
  const [width, setWidth] = useState(340)
  const [percent, setPercent] = useState(0)
  const travel = width - THUMB - INSET * 2
  const reach = useRef(travel)
  reach.current = travel
  // Follows the thumb, then closes the last inset as it arrives, so a full track has no gap.
  const trail = useTransform(x, (value) => (value > 0 ? value + THUMB + INSET + INSET * Math.min(1, value / reach.current) : 0))
  // Paint only: the trail keeps its full size and is revealed up to the thumb.
  const reveal = useMotionTemplate`inset(0 calc(100% - ${trail}px) 0 0 round 9999px)`
  const locked = disabled || state === 'confirming' || state === 'done'

  useLayoutEffect(() => {
    const node = track.current
    if (!node) return
    const measure = (): void => setWidth(node.offsetWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const moveTo = (to: number): void => {
    if (still) x.set(to)
    else animate(x, to, spring.snap)
  }

  async function commit(): Promise<void> {
    setState('confirming')
    setPercent(100)
    moveTo(travel)
    try {
      await onConfirm?.()
      setState('done')
    } catch {
      setState('idle')
      setPercent(0)
      moveTo(0)
    }
  }

  function onDragEnd(_: unknown, info: PanInfo): void {
    if (x.get() / travel >= COMMIT_AT || info.velocity.x > FLICK) { void commit(); return }
    setState('idle')
    setPercent(0)
    moveTo(0)
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>): void {
    if (locked) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void commit(); return }
    const step = e.key === 'ArrowRight' ? NUDGE : e.key === 'ArrowLeft' ? -NUDGE : 0
    if (!step) return
    e.preventDefault()
    const next = Math.min(1, Math.max(0, x.get() / travel + step))
    x.set(next * travel)
    setPercent(Math.round(next * 100))
    if (next >= COMMIT_AT) void commit()
  }

  const text = state === 'done' ? doneLabel : label

  return (
    <div ref={track} data-state={state} data-disabled={disabled ? '' : undefined} className={cx(styles.track, className)} style={{ '--track': `${width}px` } as CSSProperties}>
      <span className={styles.label}>{text}</span>
      <motion.span className={styles.trail} style={{ clipPath: reveal }} aria-hidden="true">
        <span className={styles.trailLabel}>{text}</span>
      </motion.span>
      <motion.button
        type="button"
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={state === 'done' ? doneLabel : `${percent}%`}
        disabled={disabled}
        className={styles.thumb}
        style={{ x }}
        drag={locked ? false : 'x'}
        dragConstraints={{ left: 0, right: travel }}
        dragElastic={0}
        dragMomentum={false}
        onDragStart={() => setState('dragging')}
        onDrag={() => setPercent(Math.round((x.get() / travel) * 10) * 10)}
        onDragEnd={onDragEnd}
        onKeyDown={onKeyDown}
      >
        {state === 'confirming' ? <span className={styles.spin}><LoaderIcon trigger="none" /></span> : state === 'done' ? <Tick02Icon /> : <ArrowRightIcon />}
      </motion.button>
      <span role="status" aria-live="polite" className={styles.live}>{state === 'done' ? doneLabel : ''}</span>
    </div>
  )
}
