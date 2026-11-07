'use client'
import { StarIcon } from '@fetaui/react/rounded/star'
import { motion } from 'motion/react'
import { useId, useState, type HTMLAttributes } from 'react'
import { spring } from '../../motion-tokens'
import { cx, kit, useStill } from '../motion-kit/motion-kit'
import styles from './rating.module.css'

const STARS = [1, 2, 3, 4, 5] as const

export type RatingProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> & {
  label: string
  /** Controlled rating, 1 to 5. */
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  /** Shows the average, with the number of ratings beside it. */
  readOnly?: boolean
  /** How many ratings the average is from. */
  count?: number
  disabled?: boolean
  animated?: boolean
}

/** Five stars. Hover previews up to the pointer. */
export function Rating({ label, value, defaultValue = 0, onValueChange, readOnly = false, count, disabled = false, animated = true, className, ...rest }: RatingProps) {
  const still = useStill(animated)
  const name = useId()
  const [held, setHeld] = useState(defaultValue)
  const [hover, setHover] = useState(0)
  const chosen = value ?? held
  const shown = hover || chosen
  const text = readOnly ? `${chosen.toFixed(1)}${count === undefined ? '' : ` · ${count} ratings`}` : shown ? `${shown} of 5` : 'No rating'

  function pick(next: number): void {
    if (value === undefined) setHeld(next)
    onValueChange?.(next)
  }

  if (readOnly) {
    return (
      <div role="img" aria-label={`${label}: ${chosen.toFixed(1)} of 5${count === undefined ? '' : ` from ${count} ratings`}`} data-still={animated ? undefined : ''} className={cx(styles.rating, className)} {...rest}>
        <span className={styles.label} aria-hidden="true">{label}</span>
        <span className={styles.row} aria-hidden="true">
          <span className={styles.stars} data-small="">{STARS.map((star) => <span key={star} className={styles.star} data-filled={Math.round(chosen) >= star ? '' : undefined}><StarIcon size={16} /></span>)}</span>
          <span className={styles.value}>{text}</span>
        </span>
      </div>
    )
  }

  return (
    <div role="radiogroup" aria-label={label} data-still={animated ? undefined : ''} className={cx(styles.rating, className)} {...rest}>
      <span className={styles.label} aria-hidden="true">{label}</span>
      <span className={styles.row}>
        <span className={styles.stars} onPointerLeave={() => setHover(0)}>
          {STARS.map((star) => (
            <motion.label key={star} className={styles.star} data-filled={shown >= star ? '' : undefined} onPointerEnter={() => { if (!disabled) setHover(star) }} {...(still || disabled ? {} : { whileTap: { scale: 0.9 }, transition: spring.press })}>
              <input className={kit.srOnly} type="radio" name={name} value={star} checked={chosen === star} disabled={disabled} onChange={() => pick(star)} aria-label={`${star} of 5`} />
              <StarIcon size={24} />
            </motion.label>
          ))}
        </span>
        <span className={styles.value} aria-live="polite">{text}</span>
      </span>
    </div>
  )
}
