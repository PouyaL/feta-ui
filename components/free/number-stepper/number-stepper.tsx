'use client'
import { MinusIcon } from '@fetaui/react/rounded/minus'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { useState } from 'react'
import { IconButton } from '../icon-button/icon-button'
import { RollingText, cx, useStill } from '../motion-kit/motion-kit'
import styles from './number-stepper.module.css'

export type NumberStepperProps = {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** What is being counted. Names the group and both buttons. */
  label: string
  disabled?: boolean
  animated?: boolean
  className?: string | undefined
}

/** Minus, value and plus Icon Buttons in a 10% ink pill. Minus turns off at `min`, plus at `max`. */
export function NumberStepper({ value, defaultValue = 1, onValueChange, min = 0, max = 999, step = 1, label, disabled = false, animated = true, className }: NumberStepperProps) {
  const still = useStill(animated)
  const [own, setOwn] = useState(defaultValue)
  const current = value ?? own
  const change = (next: number): void => {
    const clamped = Math.min(max, Math.max(min, next))
    if (value === undefined) setOwn(clamped)
    onValueChange?.(clamped)
  }
  return (
    <div role="group" aria-label={label} className={cx(styles.stepper, className)} data-disabled={disabled ? '' : undefined}>
      <IconButton variant="ghost" size="sm" label={`Fewer ${label.toLowerCase()}`} icon={<MinusIcon />} disabled={disabled || current <= min} onClick={() => change(current - step)} animated={animated} />
      <output aria-live="polite" className={styles.value}><RollingText value={String(current)} still={still} /></output>
      <IconButton variant="ghost" size="sm" label={`More ${label.toLowerCase()}`} icon={<PlusIcon />} disabled={disabled || current >= max} onClick={() => change(current + step)} animated={animated} />
    </div>
  )
}
