'use client'
import { motion, type HTMLMotionProps } from 'motion/react'
import { useState, type MouseEvent, type Ref } from 'react'
import { MoonIcon } from '@fetaui/react/rounded/moon'
import { SunIcon } from '@fetaui/react/rounded/sun'
import { duration, ease } from '../../motion-tokens'
import { cx, kit, LabelSwap, pressProps, useStill } from '../motion-kit/motion-kit'
import styles from './theme-toggle.module.css'

export type ThemeValue = 'light' | 'dark'

export type ThemeToggleProps = Omit<HTMLMotionProps<'button'>, 'children' | 'ref' | 'value' | 'defaultValue'> & {
  kind?: 'round' | 'labeled' | 'icon'
  value?: ThemeValue | undefined
  defaultValue?: ThemeValue
  /** Apply the theme here. It runs inside the view transition, so the new theme spreads as a circle. */
  onValueChange?: (value: ThemeValue) => void
  /** `false` swaps the theme with a cross fade. */
  animated?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** Spreads the new theme as a circle from the button, or falls back to a plain change. */
export function spread(change: () => void, x: number, y: number): void {
  const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  // Animation frames pause during the update, so a timeout gives React its turn to commit.
  const transition = document.startViewTransition(() => {
    change()
    return new Promise<void>((done) => setTimeout(done))
  })
  transition.ready.then(() => {
    const root = document.documentElement
    const timing = { duration: duration.spread * 1000, easing: `cubic-bezier(${ease.spread.join(', ')})` }
    root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${reach}px at ${x}px ${y}px)`] }, { ...timing, pseudoElement: '::view-transition-new(root)' })
    root.animate({ opacity: [1, 1] }, { ...timing, pseudoElement: '::view-transition-old(root)' })
  }).catch(() => undefined)
}

/** A light and dark switch that shows a sun or a moon, so the value reads at a glance. */
export function ThemeToggle({ kind = 'round', value, defaultValue = 'light', onValueChange, animated = true, className, onClick, disabled, type = 'button', ref, ...rest }: ThemeToggleProps) {
  const still = useStill(animated)
  const [held, setHeld] = useState<ThemeValue>(defaultValue)
  const current = value ?? held
  const dark = current === 'dark'

  function handleClick(e: MouseEvent<HTMLButtonElement>): void {
    onClick?.(e)
    const next: ThemeValue = dark ? 'light' : 'dark'
    const change = (): void => { setHeld(next); onValueChange?.(next) }
    if (still || typeof document.startViewTransition !== 'function') { change(); return }
    const box = e.currentTarget.getBoundingClientRect()
    spread(change, box.left + box.width / 2, box.top + box.height / 2)
  }

  const icon = <span className={kit.icon}>{dark ? <MoonIcon /> : <SunIcon />}</span>

  return (
    <motion.button
      ref={ref}
      type={type}
      role="switch"
      aria-checked={dark}
      aria-label="Dark theme"
      disabled={disabled}
      data-kind={kind}
      data-value={current}
      className={cx(kit.control, styles.toggle, className)}
      onClick={handleClick}
      {...pressProps(still, disabled)}
      {...rest}
    >
      {kind === 'round' ? <span className={styles.face}><LabelSwap swapKey={current} still={still}>{icon}</LabelSwap></span> : (
        <LabelSwap swapKey={current} still={still} className={styles.row}>
          {icon}
          {kind === 'labeled' ? (dark ? 'Dark' : 'Light') : null}
        </LabelSwap>
      )}
    </motion.button>
  )
}
