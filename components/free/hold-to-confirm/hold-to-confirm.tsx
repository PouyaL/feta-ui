'use client'
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform, type AnimationPlaybackControls } from 'motion/react'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Delete02Icon } from '@fetaui/react/rounded/delete-02'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { delay, duration, spring } from '../../motion-tokens'
import { useLabelMotion } from '../button/label-motion'
import { cx, kit, useStill } from '../motion-kit/motion-kit'
import styles from './hold-to-confirm.module.css'

export type HoldToConfirmProps = {
  kind?: 'outline' | 'solid'
  label?: string
  progressLabel?: string
  doneLabel?: string
  icon?: ReactNode
  /** Fires when the sweep reaches the far edge. */
  onComplete?: () => void
  disabled?: boolean
  /** `false` keeps the sweep, which shows progress, but drops the press, the pop and the label motion. */
  animated?: boolean
  className?: string
}

type Phase = 'rest' | 'holding' | 'complete'

// Motion values not in motion-tokens, named for promotion.
/** The sweep starts slow and gathers pace, so a brush of the finger barely moves it. */
const SWEEP_CURVE = 1.6
/** The press while held. Deeper than the shared 0.98, because it is held, not tapped. */
const HOLD_SCALE = 0.97
const PROGRESS_STEP = 10

/**
 * Press and hold to confirm. A sweep crosses the button from the leading edge; it fires when it meets
 * the far edge, and springs back if you let go early.
 */
export function HoldToConfirm({ kind = 'outline', label = 'Hold to delete', progressLabel = 'Release to cancel', doneLabel = 'Deleted', icon, onComplete, disabled, animated = true, className }: HoldToConfirmProps) {
  const still = useStill(animated)
  const [phase, setPhaseState] = useState<Phase>('rest')
  // Handlers read the phase from a ref, so a key up straight after the key down still sees `holding`.
  const phaseRef = useRef<Phase>('rest')
  const setPhase = (next: Phase) => { phaseRef.current = next; setPhaseState(next) }
  const [step, setStep] = useState(0)
  const time = useMotionValue(0)
  const scale = useMotionValue(1)
  const sweep = useTransform(time, (t) => Math.pow(Math.min(1, Math.max(0, t)), SWEEP_CURVE))
  const widthRef = useRef(0)
  const edge = useTransform(sweep, (v) => `translateX(${(v * widthRef.current).toFixed(1)}px)`)
  const edgeOpacity = useTransform(sweep, (v) => (v > 0.001 && v < 0.999 ? 1 : 0))
  const run = useRef<AnimationPlaybackControls | null>(null)
  const reset = useRef<number>(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const done = useRef(onComplete)
  done.current = onComplete

  const shown = phase === 'complete' ? doneLabel : phase === 'holding' ? progressLabel : label
  const motionLabel = useLabelMotion(shown, !still, true)

  useMotionValueEvent(time, 'change', (t) => {
    const v = Math.pow(Math.min(1, Math.max(0, t)), SWEEP_CURVE)
    const next = Math.round((v * 100) / PROGRESS_STEP) * PROGRESS_STEP
    setStep((now) => (now === next ? now : next))
  })

  useEffect(() => () => { run.current?.stop(); window.clearTimeout(reset.current) }, [])

  const press = (to: number) => { if (!still) animate(scale, to, spring.press) }

  const start = () => {
    if (disabled || phaseRef.current !== 'rest') return
    widthRef.current = buttonRef.current?.offsetWidth ?? 0
    setPhase('holding')
    press(HOLD_SCALE)
    run.current?.stop()
    // Linear in time; the curve lives in `sweep`, so letting go and holding again picks up where it was.
    const fill = animate(time, 1, { duration: duration.hold * (1 - time.get()), ease: 'linear' })
    run.current = fill
    void fill.then(() => {
      if (time.get() < 1) return
      setPhase('complete')
      if (!still) animate(scale, 1, spring.stamp)
      done.current?.()
      reset.current = window.setTimeout(() => {
        setPhase('rest')
        run.current = still ? null : animate(time, 0, spring.settle)
        if (still) time.set(0)
      }, delay.reset * 1000)
    })
  }

  const stop = () => {
    if (phaseRef.current !== 'holding') return
    run.current?.stop()
    if (time.get() >= 1) return
    setPhase('rest')
    press(1)
    run.current = still ? null : animate(time, 0, spring.settle)
    if (still) time.set(0)
  }

  const down = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    motionLabel.handlers.onPointerDown(event)
    start()
  }
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    // A held key repeats; only the first press starts the sweep. Enter would also click, which does nothing here.
    event.preventDefault()
    if (event.repeat) return
    motionLabel.handlers.onKeyDown(event)
    start()
  }
  const keyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); stop() }
  }

  const glyph = phase === 'complete' ? <Tick02Icon size={18} {...(still ? {} : { trigger: 'inView' as const })} /> : (icon ?? <Delete02Icon size={18} />)

  return (
    <span className={cx(styles.wrap, kind === 'solid' && styles.wrapSolid, className)}>
      <motion.button
        ref={buttonRef}
        type="button"
        aria-label={label}
        disabled={disabled}
        data-kind={kind}
        data-state={phase}
        data-still={still ? '' : undefined}
        className={cx(kit.control, kind === 'solid' ? kit.inverse : kit.surface, styles.button, kind === 'solid' && styles.solid)}
        style={{ scale }}
        onPointerDown={down}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onPointerEnter={motionLabel.handlers.onPointerEnter}
        onPointerLeave={motionLabel.handlers.onPointerLeave}
        onKeyDown={keyDown}
        onKeyUp={keyUp}
        onBlur={stop}
        onContextMenu={(event) => event.preventDefault()}
      >
        <motion.span className={styles.sweep} style={{ scaleX: sweep }} aria-hidden="true" data-keep-motion="" />
        <motion.span className={styles.edge} style={{ transform: edge, opacity: edgeOpacity }} aria-hidden="true" data-keep-motion="" />
        <span className={styles.content} aria-hidden="true">
          <span className={cx(kit.icon, styles.glyph)}>{glyph}</span>
          <span className={styles.labels}>
            {/* The button keeps the width of its longest label, so nothing shifts as they change. */}
            {[label, progressLabel, doneLabel].map((text, i) => <span key={i} className={styles.sizer}>{text}</span>)}
            <span className={styles.label}>{motionLabel.label}</span>
          </span>
        </span>
      </motion.button>
      <span className={kit.srOnly} role="progressbar" aria-label={`${label} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={step} />
      <span className={kit.srOnly} aria-live="polite">{phase === 'complete' ? doneLabel : ''}</span>
    </span>
  )
}
