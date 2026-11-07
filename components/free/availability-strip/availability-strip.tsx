'use client'
import { motion } from 'motion/react'
import { AvailabilityCell, type AvailabilityState } from '../availability-cell/availability-cell'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './availability-strip.module.css'

export type AvailabilityMonth = { month: string; state: AvailabilityState; note?: string }

export type AvailabilityStripProps = {
  /** Default Availability. */
  label?: string
  /** Default Updated every Monday. */
  note?: string
  /** Six months. */
  months: AvailabilityMonth[]
  /** Makes each month a button. */
  onSelect?: (month: string) => void
  /** The picked month. */
  selected?: string
  animated?: boolean
  className?: string | undefined
}

const RISE_Y = 6
const STAGGER_S = 0.05
const CELL_S = 0.32
const EASE = [0.23, 1, 0.32, 1] as const

/** Six months of availability beside a label. The months rise in one after another; pointing at one dims the rest. Two columns of three on Mobile. */
export function AvailabilityStrip({ label = 'Availability', note = 'Updated every Monday', months, onSelect, selected, animated = true, className }: AvailabilityStripProps) {
  const still = useStill(animated)
  const enter = still ? {} : { initial: 'hidden' as const, whileInView: 'shown' as const, viewport: { once: true, amount: 0.4 } }
  return (
    <motion.div className={cx(styles.strip, className)} data-still={still ? '' : undefined} {...enter} variants={{ hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: CELL_S, ease: EASE, staggerChildren: STAGGER_S, delayChildren: 0.08 } } }}>
      <div className={styles.label}><p className={styles.name}>{label}</p><p className={styles.note}>{note}</p></div>
      <ul className={styles.months}>
        {months.map((item) => (
          <motion.li key={item.month} variants={{ hidden: { opacity: 0, y: RISE_Y }, shown: { opacity: 1, y: 0, transition: { duration: CELL_S, ease: EASE } } }}>
            <AvailabilityCell {...item} animated={animated} {...(onSelect ? { onSelect: () => onSelect(item.month), selected: selected === item.month } : {})} />
          </motion.li>
        ))}
      </ul>
    </motion.div>
  )
}
