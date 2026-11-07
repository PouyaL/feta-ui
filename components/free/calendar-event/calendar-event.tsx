'use client'
import { useEffect, useRef, type CSSProperties } from 'react'
import { cx, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import styles from './calendar-event.module.css'

export type CalendarEventTone = 'neutral' | 'accent' | 'success' | 'warning'

export type CalendarEventProps = {
  title: string
  time?: string
  /** Default `neutral`. */
  tone?: CalendarEventTone
  /** `selected` inverts the block, `now` rings it in danger and pulses its tag. Default `default`. */
  state?: 'default' | 'selected' | 'now'
  /** One line for a block under 30 px tall. */
  dense?: boolean
  /** Attendee dots, up to three. */
  people?: number
  /** Makes the block a button. */
  onSelect?: () => void
  animated?: boolean
  className?: string | undefined
  style?: CSSProperties | undefined
}

/** An event block for week views: colour tag, title, time and attendees. */
export function CalendarEvent({ title, time, tone = 'neutral', state = 'default', dense = false, people = 0, onSelect, animated = true, className, style }: CalendarEventProps) {
  const still = useStill(animated)
  const tag = useRef<HTMLElement>(null)
  useEffect(() => (tag.current && state === 'now' && !still ? watchOffscreen(tag.current) : undefined), [state, still])
  const Tag = onSelect ? 'button' : 'div'
  return (
    <Tag {...(onSelect ? { type: 'button' as const, onClick: onSelect, 'aria-pressed': state === 'selected' } : {})} className={cx(styles.event, className)} style={style} data-tone={tone} data-state={state} data-dense={dense ? '' : undefined} data-still={still ? '' : undefined} data-loop={state === 'now' ? '' : undefined}>
      <i ref={tag} aria-hidden="true" className={styles.tag} />
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {time ? <span className={styles.time}>{time}</span> : null}
        {people ? <span role="img" aria-label={`${people} people`} className={styles.people}>{Array.from({ length: Math.min(people, 3) }, (_, i) => <i key={i} data-i={i} />)}</span> : null}
      </span>
    </Tag>
  )
}
