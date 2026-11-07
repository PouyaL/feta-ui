'use client'
import { RollText, cx, useStill } from '../motion-kit/motion-kit'
import styles from './availability-cell.module.css'

export type AvailabilityState = 'booked' | 'one-slot' | 'open'
const LABEL: Record<AvailabilityState, string> = { booked: 'Booked', 'one-slot': 'One slot', open: 'Open' }

export type AvailabilityCellProps = {
  month: string
  /** Default `open`. */
  state?: AvailabilityState
  /** Replaces the state text. */
  note?: string
  /** Makes the cell a button, for picking a month to book. */
  onSelect?: () => void
  /** Rings the cell as the picked month. */
  selected?: boolean
  animated?: boolean
  className?: string | undefined
}

/** One month of availability, used six at a time in the Availability Strip. The month rolls on hover. */
export function AvailabilityCell({ month, state = 'open', note, onSelect, selected = false, animated = true, className }: AvailabilityCellProps) {
  const still = useStill(animated)
  const text = note ?? LABEL[state]
  const body = (
    <>
      <span className={styles.month}><RollText still={still}>{month}</RollText></span>
      <span className={styles.state}>{text}</span>
    </>
  )
  const shared = { className: cx(styles.cell, className), 'data-state': state, 'data-selected': selected ? '' : undefined, 'data-still': still ? '' : undefined, 'data-roll-host': '' }
  return onSelect
    ? <button type="button" {...shared} aria-pressed={selected} aria-label={`${month}, ${text}`} onClick={onSelect}>{body}</button>
    : <div {...shared}>{body}</div>
}
