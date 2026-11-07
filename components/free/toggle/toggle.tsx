'use client'
import { motion, type HTMLMotionProps } from 'motion/react'
import { useState, type MouseEvent, type ReactNode, type Ref } from 'react'
import { spring } from '../../motion-tokens'
import { useStill } from '../motion-kit/use-still'
import styles from './toggle.module.css'

const SCALE_PRESS = 0.96

export type ToggleProps = Omit<HTMLMotionProps<'button'>, 'children' | 'ref'> & {
  /** Controlled state. Leave it out to let the toggle hold its own. */
  pressed?: boolean
  defaultPressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  /** `segment` belongs on a tray, inside Toggle Group. Default `ghost`. */
  appearance?: 'ghost' | 'outline' | 'segment'
  icon?: ReactNode
  /** Without text, pass `aria-label`. */
  children?: string | undefined
  /** Rendered behind the content. Toggle Group slides its lift through this. */
  underlay?: ReactNode
  /** `false` turns off the press scale. */
  animated?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** A button that stays pressed. */
export function Toggle({
  pressed, defaultPressed = false, onPressedChange, appearance = 'ghost', icon, children, underlay, animated = true,
  className, onClick, disabled, role, type = 'button', ref, ...rest
}: ToggleProps) {
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultPressed)
  const on = pressed ?? held

  function handleClick(e: MouseEvent<HTMLButtonElement>): void {
    onClick?.(e)
    if (pressed === undefined) setHeld(!on)
    onPressedChange?.(!on)
  }

  return (
    <motion.button
      ref={ref}
      type={type}
      role={role}
      disabled={disabled}
      {...(role === 'radio' ? { 'aria-checked': on } : { 'aria-pressed': on })}
      data-appearance={appearance}
      data-content={children ? 'text' : 'icon'}
      data-on={on ? '' : undefined}
      data-still={still ? '' : undefined}
      className={[styles.toggle, className].filter(Boolean).join(' ')}
      onClick={handleClick}
      {...(still || disabled ? {} : { whileTap: { scale: SCALE_PRESS } })}
      transition={spring.toggle}
      {...rest}
    >
      {underlay}
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      {children ? <span className={styles.text}>{children}</span> : null}
    </motion.button>
  )
}
