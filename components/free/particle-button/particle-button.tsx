'use client'
import { motion, useAnimationControls, type HTMLMotionProps } from 'motion/react'
import { useEffect, useRef, useState, type MouseEvent, type Ref } from 'react'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { LoaderIcon } from '@fetaui/react/rounded/loader'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { delay, duration, spring } from '../../motion-tokens'
import { cx, kit, LabelSwap, useStill } from '../motion-kit/motion-kit'
import styles from './particle-button.module.css'

const SHAKE = [0, -5, 5, -3, 3, 0]
const CHIPS = 12
const FLIGHT = 0.65

export type ParticleButtonProps = Omit<HTMLMotionProps<'button'>, 'children' | 'ref' | 'onClick'> & {
  variant?: 'primary' | 'outline'
  label?: string
  pendingLabel?: string
  successLabel?: string
  errorLabel?: string
  /** Runs on click. Resolve for Success, reject for Error. */
  onAction?: () => Promise<void> | void
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  /** `false` turns off the chips, the shake and the press scale. */
  animated?: boolean
  ref?: Ref<HTMLButtonElement>
}

type State = 'idle' | 'pending' | 'success' | 'error'

/** Each chip flies out with gravity and spin. Seeded by index, so a burst always looks the same. */
function Chip({ index }: { index: number }) {
  const angle = (index / CHIPS) * Math.PI * 2
  const reach = 34 + (index % 3) * 12
  const x = Math.cos(angle) * reach * 1.5
  const y = Math.sin(angle) * reach
  return (
    <motion.span
      className={styles.chip}
      data-shape={index % 2 ? 'dot' : 'bar'}
      initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
      animate={{ x, y: [0, y, y + 28], rotate: index % 2 ? 180 : -180, opacity: [1, 1, 0] }}
      transition={{ duration: FLIGHT, ease: 'easeOut', times: [0, 0.6, 1] }}
    />
  )
}

/** An async button that walks Idle, Pending, Success and Error. */
export function ParticleButton({ variant = 'primary', label = 'Save changes', pendingLabel = 'Saving', successLabel = 'Saved', errorLabel = 'Try again', onAction, onClick, animated = true, className, disabled, type = 'button', ref, ...rest }: ParticleButtonProps) {
  const still = useStill(animated)
  const shake = useAnimationControls()
  const [state, setState] = useState<State>('idle')
  const width = useRef(0)
  const inner = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (state !== 'success' && state !== 'error') return
    if (state === 'error' && !still) void shake.start({ x: SHAKE, transition: { duration: duration.shake } })
    const timer = setTimeout(() => setState('idle'), delay.reset * 1000)
    return () => clearTimeout(timer)
  }, [state, still, shake])

  async function handleClick(e: MouseEvent<HTMLButtonElement>): Promise<void> {
    onClick?.(e)
    if (state !== 'idle') return
    if (inner.current) width.current = inner.current.offsetWidth
    setState('pending')
    try {
      await onAction?.()
      setState('success')
    } catch {
      setState('error')
    }
  }

  const face = {
    idle: { text: label, icon: null },
    pending: { text: pendingLabel, icon: <span className={styles.spin}><LoaderIcon trigger="none" /></span> },
    success: { text: successLabel, icon: <Tick02Icon /> },
    error: { text: errorLabel, icon: <AlertCircleIcon /> },
  }[state]

  return (
    <motion.button
      ref={(node: HTMLButtonElement | null) => {
        inner.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      type={type}
      disabled={disabled}
      aria-busy={state === 'pending' || undefined}
      aria-live="polite"
      data-state={state}
      data-variant={variant}
      className={cx(kit.control, variant === 'primary' ? kit.inverse : kit.surface, styles.button, className)}
      style={state === 'idle' || !width.current ? {} : { minWidth: width.current }}
      animate={shake}
      onClick={(e: MouseEvent<HTMLButtonElement>) => void handleClick(e)}
      {...(still || disabled || state !== 'idle' ? {} : { whileTap: { scale: 0.98 } })}
      transition={spring.press}
      {...rest}
    >
      <LabelSwap swapKey={state} still={still} className={styles.face}>
        {face.icon ? <span className={kit.icon}>{face.icon}</span> : null}
        {face.text}
      </LabelSwap>
      {state === 'success' && !still ? <span className={styles.burst} aria-hidden="true">{Array.from({ length: CHIPS }, (_, i) => <Chip key={i} index={i} />)}</span> : null}
    </motion.button>
  )
}
