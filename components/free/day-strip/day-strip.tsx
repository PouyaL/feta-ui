'use client'
import { motion } from 'motion/react'
import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { spring } from '../../motion-tokens'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './day-strip.module.css'

export type DayStripProps = {
  /** The first day shown. */
  start: Date
  /** Days shown. Default 5. */
  days?: number
  value?: Date
  defaultValue?: Date
  onValueChange?: (value: Date) => void
  /** Days before this one sink onto the tray. */
  today?: Date
  locale?: string
  animated?: boolean
  className?: string
}

const sameDay = (a: Date, b: Date | undefined): boolean => Boolean(b) && a.toDateString() === b?.toDateString()

/** Pick a day from a strip of soft capsules. The selected day grows and fills its disc with ink. */
export function DayStrip({ start, days = 5, value, defaultValue, onValueChange, today, locale = 'en-US', animated = true, className }: DayStripProps) {
  const still = useStill(animated)
  const uid = useId()
  const [held, setHeld] = useState(defaultValue ?? start)
  const current = value ?? held
  const list = useMemo(() => Array.from({ length: days }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)), [start, days])
  const weekday = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }), [locale])
  const full = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }), [locale])

  function choose(day: Date): void {
    setHeld(day)
    onValueChange?.(day)
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    const day = list[index + by]
    if (!by || !day) return
    e.preventDefault()
    choose(day)
    const row = e.currentTarget.parentElement?.parentElement
    row?.querySelectorAll<HTMLElement>('[role="radio"]')[index + by]?.focus()
  }

  return (
    <div role="radiogroup" aria-label="Day" className={cx(styles.strip, className)} data-still={still ? '' : undefined}>
      {list.map((day, i) => {
        const on = sameDay(day, current)
        const past = today ? day.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() : false
        return (
          <span key={day.toISOString()} className={styles.column}>
            <span className={styles.weekday} data-on={on ? '' : undefined} aria-hidden="true">{on ? <motion.span {...(still ? {} : { layoutId: `${uid}-pointer` })} className={styles.pointer} transition={spring.jump} /> : null}{weekday.format(day)}</span>
            <motion.button
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={full.format(day)}
              tabIndex={on ? 0 : -1}
              data-on={on ? '' : undefined}
              data-past={past ? '' : undefined}
              className={styles.capsule}
              onClick={() => choose(day)}
              onKeyDown={(e) => onKeyDown(e, i)}
              {...(still ? {} : { whileTap: { scale: 0.96 } })}
              transition={spring.press}
            >
              <span className={styles.disc}>{day.getDate()}</span>
            </motion.button>
          </span>
        )
      })}
    </div>
  )
}
