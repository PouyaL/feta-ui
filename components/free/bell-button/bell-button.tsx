'use client'
import { animate, motion, type HTMLMotionProps } from 'motion/react'
import { useEffect, useRef, useState, type MouseEvent, type Ref } from 'react'
import { BellIcon } from '@fetaui/react/rounded/bell'
import { BellOffIcon } from '@fetaui/react/rounded/bell-off'
import { BellRingIcon } from '@fetaui/react/rounded/bell-ring'
import { duration, ease, spring } from '../../motion-tokens'
import { cx, kit, LabelSwap, pressProps, useStill } from '../motion-kit/motion-kit'
import styles from './bell-button.module.css'

const RING_MS = 1200
const TILT = -12

export type BellButtonProps = Omit<HTMLMotionProps<'button'>, 'children' | 'ref'> & {
  variant?: 'default' | 'compact' | 'icon'
  pressed?: boolean | undefined
  defaultPressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  label?: string
  pressedLabel?: string
  /** `false` turns off the swing and the press scale. */
  animated?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** A subscribe toggle with a bell that swings on two coupled springs. */
export function BellButton({ variant = 'default', pressed, defaultPressed = false, onPressedChange, label = 'Subscribe', pressedLabel = 'Subscribed', animated = true, className, onClick, disabled, type = 'button', ref, ...rest }: BellButtonProps) {
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultPressed)
  const [ringing, setRinging] = useState(false)
  const bell = useRef<HTMLSpanElement>(null)
  const clapper = useRef<HTMLSpanElement>(null)
  const on = pressed ?? held

  useEffect(() => {
    if (!ringing) return
    const timer = setTimeout(() => setRinging(false), RING_MS)
    return () => clearTimeout(timer)
  }, [ringing])

  function handleClick(e: MouseEvent<HTMLButtonElement>): void {
    onClick?.(e)
    const next = !on
    setHeld(next)
    onPressedChange?.(next)
    if (!next || still) return
    setRinging(true)
    if (bell.current) animate(bell.current, { rotate: [TILT, 0] }, spring.bell)
    if (clapper.current) animate(clapper.current, { rotate: [-TILT / 2, 0] }, spring.clapper)
  }

  const Icon = !on ? BellOffIcon : ringing ? BellRingIcon : BellIcon
  const text = on ? pressedLabel : label

  return (
    <motion.button
      ref={ref}
      type={type}
      aria-pressed={on}
      aria-label={variant === 'icon' ? label : undefined}
      disabled={disabled}
      data-variant={variant}
      className={cx(kit.control, on ? kit.inverse : kit.surface, styles.button, className)}
      onClick={handleClick}
      {...(still ? {} : { layout: true })}
      {...pressProps(still, disabled)}
      transition={{ layout: { duration: duration.width, ease: ease.out }, ...spring.press }}
      style={{ borderRadius: 9999 }}
      {...rest}
    >
      <motion.span {...(still ? {} : { layout: 'position' as const })} className={cx(kit.icon, styles.bell)} ref={bell}><span ref={clapper} className={styles.clapper}><Icon trigger="none" /></span></motion.span>
      {variant === 'icon' ? null : <motion.span {...(still ? {} : { layout: 'position' as const })} className={styles.label}><LabelSwap swapKey={text} still={still}>{text}</LabelSwap></motion.span>}
    </motion.button>
  )
}
