'use client'
import type { ReactNode } from 'react'
import { ZapIcon } from '@fetaui/react/rounded/zap'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Meter, Tag, Tween, kit } from '../data-kit/data-kit'
import styles from './usage-meter.module.css'

/** Usage Meter Handoff: the fill tweens over 400 ms, and Warning starts at 80%. */
const FILL_MS = 400
const WARNING_AT = 0.8

export type UsageMeterProps = {
  metric: string
  used: number
  limit: number
  /** A word after the numbers, like GB. */
  unit?: string
  hint?: ReactNode
  /** Shown top right while Normal, like Resets Nov 1. */
  meta?: ReactNode
  icon?: ReactNode
  format?: (value: number) => string
  animated?: boolean
  className?: string | undefined
}

const plain = (value: number): string => Math.round(value).toLocaleString('en-US')

/** A metric against its limit. State comes from the numbers: Warning at 80%, Over limit past 100%. */
export function UsageMeter({ metric, used, limit, unit, hint, meta, icon, format = plain, animated = true, className }: UsageMeterProps) {
  const still = useStill(animated)
  const ratio = limit > 0 ? used / limit : 0
  const over = ratio > 1
  const warning = !over && ratio >= WARNING_AT
  return (
    <div className={cx(styles.meter, kit.enter, className)} data-still={still ? '' : undefined} data-state={over ? 'over' : warning ? 'warning' : 'normal'}>
      <div className={styles.top}>
        <span className={styles.metric}>{icon ?? <ZapIcon size={16} aria-hidden="true" />}{metric}</span>
        {over ? <Tag tone="danger" mark>Over limit</Tag> : warning ? <Tag tone="warning" mark>{Math.round(ratio * 100)}% used</Tag> : meta ? <span className={styles.meta}>{meta}</span> : null}
      </div>
      <p className={styles.numbers}><Tween className={styles.used} value={used} format={format} animated={animated} /> <span className={styles.limit}>of {format(limit)}{unit ? ` ${unit}` : ''}</span></p>
      <Meter value={ratio} tone={over ? 'danger' : warning ? 'warning' : 'neutral'} label={`${metric} used`} ms={still ? 0 : FILL_MS} />
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  )
}
