'use client'
import type { ReactNode } from 'react'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { Button } from '../button/button'
import { Radio } from '../radio/radio'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Tag, kit } from '../data-kit/data-kit'
import styles from './plan-card.module.css'

export type PlanCardProps = {
  name: string
  price: string
  period: string
  pitch: string
  features: string[]
  /** `current` disables the Button, `recommended` uses Primary, `selected` rings the card. Default `default`. */
  state?: 'default' | 'current' | 'recommended' | 'selected'
  /** Button text. */
  action: ReactNode
  onAction?: () => void
  /** The Radio in the corner, for choosing between cards. */
  onSelect?: () => void
  animated?: boolean
  className?: string | undefined
}

/** One plan: name, price, pitch, features with checks and a full width Button. */
export function PlanCard({ name, price, period, pitch, features, state = 'default', action, onAction, onSelect, animated = true, className }: PlanCardProps) {
  const still = useStill(animated)
  return (
    <article className={cx(styles.card, kit.enter, className)} data-state={state} data-still={still ? '' : undefined} aria-label={`${name} plan`}>
      <header className={styles.head}>
        <h3 className={styles.name}>{name}</h3>
        {state === 'current' ? <Tag>Current</Tag> : null}
        {state === 'recommended' ? <Tag tone="accent" mark>Recommended</Tag> : null}
        {state === 'default' || state === 'selected' ? <Radio aria-label={`Select ${name}`} checked={state === 'selected'} onChange={() => onSelect?.()} animated={animated} /> : null}
      </header>
      <p className={styles.price}><span className={styles.amount}>{price}</span> <span className={styles.period}>{period}</span></p>
      <p className={styles.pitch}>{pitch}</p>
      <ul className={styles.features}>
        {features.map((feature) => <li key={feature} className={styles.feature}><CheckIcon size={16} aria-hidden="true" />{feature}</li>)}
      </ul>
      <Button className={cx(styles.action)} shape="pill" variant={state === 'recommended' || state === 'selected' ? 'primary' : 'secondary'} disabled={state === 'current'} onClick={onAction} animated={animated}>{action}</Button>
    </article>
  )
}
