'use client'
import { motion } from 'motion/react'
import { useId, useState, type KeyboardEvent } from 'react'
import { spring } from '../../motion-tokens'
import { cx, RollingText, useStill } from '../motion-kit/motion-kit'
import styles from './billing-switch.module.css'

export type BillingPeriod = 'monthly' | 'yearly'

export type BillingSwitchProps = {
  value?: BillingPeriod
  defaultValue?: BillingPeriod
  onValueChange?: (value: BillingPeriod) => void
  /** The price per month, in each period. */
  prices?: Record<BillingPeriod, number>
  currency?: string
  /** The chip on Yearly. */
  save?: string
  disabled?: boolean
  animated?: boolean
  className?: string
}

const PERIODS: { value: BillingPeriod; label: string }[] = [{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]

/** Monthly and Yearly on a 4% tray. The active pill slides across and the price rolls. */
export function BillingSwitch({ value, defaultValue = 'monthly', onValueChange, prices = { monthly: 24, yearly: 19 }, currency = '$', save = 'Save 20%', disabled, animated = true, className }: BillingSwitchProps) {
  const still = useStill(animated)
  const id = useId()
  const [held, setHeld] = useState(defaultValue)
  const current = value ?? held

  function choose(next: BillingPeriod): void {
    setHeld(next)
    onValueChange?.(next)
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>): void {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    const next = current === 'monthly' ? 'yearly' : 'monthly'
    choose(next)
    e.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-period="${next}"]`)?.focus()
  }

  return (
    <div className={cx(styles.billing, className)} data-disabled={disabled ? '' : undefined}>
      <div role="radiogroup" aria-label="Billing period" className={styles.tray}>
        {PERIODS.map((period) => {
          const on = period.value === current
          return (
            <button
              key={period.value}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              data-period={period.value}
              disabled={disabled ?? false}
              className={styles.option}
              onClick={() => choose(period.value)}
              onKeyDown={onKeyDown}
            >
              {on ? <motion.span {...(still ? {} : { layoutId: `${id}-pill` })} className={styles.pill} transition={spring.jump} /> : null}
              <span className={styles.text}>{period.label}</span>
              {period.value === 'yearly' && save ? <span className={styles.save}>{save}</span> : null}
            </button>
          )
        })}
      </div>
      <p className={styles.price} aria-live="polite">
        <span className={styles.amount}>{currency}<RollingText value={String(prices[current])} still={still} /></span> a month
      </p>
    </div>
  )
}
