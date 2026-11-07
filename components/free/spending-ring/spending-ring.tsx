'use client'
import { motion, useInView } from 'motion/react'
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ease, spring } from '../../motion-tokens'
import { Card } from '../card/card'
import { RollingText, useStill } from '../motion-kit/motion-kit'
import { rovingTarget } from '../toggle-group/roving'
import styles from './spending-ring.module.css'

const SIZE = 200
const CENTER = SIZE / 2
/** Inner radius over outer radius. */
const RATIO_REST = 0.78
const RATIO_ON = 0.7
const GAP = 0.05
const TAU = Math.PI * 2
/** Arcs sweep from 12 o'clock on load: 600 ms. */
const SWEEP_DURATION = 0.6

/** Stroke radius and width for a ring of the given inner ratio, keeping the outer edge fixed. */
const stroke = (ratio: number) => ({ r: (CENTER * (1 + ratio)) / 2, strokeWidth: CENTER * (1 - ratio) })

export type SpendingCategory = {
  name: string
  amount: number
  /** Like `Down $42 from September`. */
  delta?: string
}

export type SpendingRingProps = {
  categories: SpendingCategory[]
  title?: ReactNode
  /** Default the sum of the amounts. */
  total?: number
  /** The selected category name. Controlled when set. */
  value?: string
  defaultValue?: string
  onValueChange?: (name: string) => void
  /** Readout and total. */
  format?: (amount: number) => string
  /** Legend values. */
  formatShort?: (amount: number) => string
  animated?: boolean
  className?: string
}

const CENTS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const dollars = (amount: number): string => CENTS.format(amount)
const whole = (amount: number): string => `$${Math.round(amount)}`

/** A monochrome donut. The selected category is ink and thicker, and the rest stay at 10%. */
export function SpendingRing({ categories, title = 'October spending', total, value, defaultValue, onValueChange, format = dollars, formatShort = whole, animated = true, className }: SpendingRingProps) {
  const still = useStill(animated)
  const maskId = useId()
  const ring = useRef<SVGSVGElement>(null)
  const inView = useInView(ring, { once: true })
  const [held, setHeld] = useState(defaultValue ?? categories[0]?.name)
  const [preview, setPreview] = useState<string | null>(null)
  const selected = value ?? held
  const shown = preview ?? selected
  const current = categories.find((item) => item.name === shown)
  const sum = categories.reduce((all, item) => all + item.amount, 0)
  const fullTotal = total ?? sum
  const usable = TAU - GAP * categories.length

  function choose(name: string): void {
    setHeld(name)
    onValueChange?.(name)
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const next = rovingTarget(event)
    if (!next) return
    event.preventDefault()
    next.focus()
    next.click()
  }

  let angle = -Math.PI / 2 + GAP / 2
  const arcs = categories.map((item) => {
    const sweep = (item.amount / sum) * usable
    const arc = { item, sweep, start: angle }
    angle += sweep + GAP
    return arc
  })

  return (
    <Card className={className} bodyClassName={styles.body} animated={animated}>
      <div className={styles.header}><h3 className={styles.title}>{title}</h3><span className={styles.title}>{format(fullTotal)}</span></div>
      <div className={styles.wrap}>
        <div className={styles.ring}>
          <svg ref={ring} viewBox={`0 0 ${SIZE} ${SIZE}`} className={styles.svg} role="img" aria-label={categories.map((item) => `${item.name} ${format(item.amount)}`).join(', ')}>
            {still ? null : (
              <mask id={maskId}>
                <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
                  <motion.circle cx={CENTER} cy={CENTER} r={CENTER / 2} fill="none" stroke="white" strokeWidth={CENTER} initial={{ pathLength: 0 }} animate={{ pathLength: inView ? 1 : 0 }} transition={{ duration: SWEEP_DURATION, ease: ease.out }} />
                </g>
              </mask>
            )}
            <g mask={still ? undefined : `url(#${maskId})`}>
              {arcs.map(({ item, sweep, start }) => {
                const on = item.name === shown
                return (
                  <g key={item.name} transform={`rotate(${(start * 360) / TAU} ${CENTER} ${CENTER})`}>
                    <motion.circle
                      className={styles.arc}
                      data-on={on ? '' : undefined}
                      cx={CENTER}
                      cy={CENTER}
                      fill="none"
                      pathLength={1}
                      strokeDasharray={`${sweep / TAU} 1`}
                      initial={false}
                      animate={stroke(on ? RATIO_ON : RATIO_REST)}
                      transition={still ? { duration: 0 } : spring.pop}
                      onMouseEnter={() => setPreview(item.name)}
                      onMouseLeave={() => setPreview(null)}
                      onClick={() => choose(item.name)}
                    />
                  </g>
                )
              })}
            </g>
          </svg>
          {current ? (
            <div className={styles.readout} aria-live="polite">
              <span className={styles.name}><span className={styles.nameDot} />{current.name}</span>
              <span className={styles.amount}><RollingText value={format(current.amount)} still={still} /></span>
              <span className={styles.share}>{Math.round((current.amount / fullTotal) * 100)}% of total</span>
              {current.delta ? <span className={styles.delta}>{current.delta}</span> : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.legend} role="radiogroup" aria-label={typeof title === 'string' ? title : 'Categories'} data-roving-group="" data-still={still ? '' : undefined} onMouseLeave={() => setPreview(null)}>
        {categories.map((item) => {
          const on = item.name === shown
          return (
            <button
              key={item.name}
              type="button"
              role="radio"
              aria-checked={item.name === selected}
              tabIndex={item.name === selected ? 0 : -1}
              data-roving=""
              data-on={on ? '' : undefined}
              className={styles.item}
              onMouseEnter={() => setPreview(item.name)}
              onClick={() => choose(item.name)}
              onKeyDown={onKeyDown}
            >
              <span className={styles.dot} />
              <span className={styles.itemName}>{item.name}</span>
              <span className={styles.itemValue}>{formatShort(item.amount)}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
