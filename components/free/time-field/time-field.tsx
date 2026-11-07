'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { ClockIcon } from '@fetaui/react/rounded/clock'
import { duration, ease } from '../../motion-tokens'
import { form, useFieldControl } from '../form-kit/form-kit'
import { cx, RollingText, useStill } from '../motion-kit/motion-kit'
import styles from './time-field.module.css'

type Parts = { hour: number | null; minute: number | null; period: 'AM' | 'PM' | null }
type Segment = keyof Parts

export type TimeFieldProps = {
  /** 24 hour text, like 09:30. */
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
  /** Earliest and latest times, as 24 hour text. Outside them, the field turns invalid. */
  min?: string
  max?: string
  /** Replaces the out of range message. */
  error?: ReactNode
  invalid?: boolean
  disabled?: boolean
  id?: string
  'aria-label'?: string
  animated?: boolean
  className?: string
}

const toParts = (text: string | null | undefined): Parts => {
  if (!text) return { hour: null, minute: null, period: null }
  const [h = 0, m = 0] = text.split(':').map(Number)
  return { hour: h % 12 || 12, minute: m, period: h >= 12 ? 'PM' : 'AM' }
}

const toText = ({ hour, minute, period }: Parts): string | null => {
  // An unset period reads as AM, as the field shows it.
  if (hour === null || minute === null) return null
  const h = (hour % 12) + (period === 'PM' ? 12 : 0)
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const pad = (value: number | null, blank: string): string => (value === null ? blank : String(value).padStart(2, '0'))

/** A segmented time input. Each segment is a spin button, and the focused one is an inverse chip. */
export function TimeField({ value, defaultValue = null, onValueChange, min, max, error, invalid, disabled, id, 'aria-label': label = 'Time', animated = true, className }: TimeFieldProps) {
  const still = useStill(animated)
  const field = useFieldControl({ id, invalid, disabled })
  const [held, setHeld] = useState<Parts>(toParts(defaultValue))
  const typed = useRef('')
  const sent = useRef(value ?? defaultValue)
  const [overHour, setOverHour] = useState(false)
  const parts = value ? toParts(value) : held
  const text = toText(parts)
  const outside = Boolean(text && ((min && text < min) || (max && text > max)))
  const bad = field.invalid || outside || overHour
  const message = error ?? (overHour ? 'Hours run 1 to 12' : outside ? `Pick a time from ${min} to ${max}` : null)

  // A parent clearing the value empties the segments. The field's own Backspace keeps the others.
  useEffect(() => {
    if (value === null && sent.current !== null) setHeld(toParts(null))
    if (value !== undefined) sent.current = value
  }, [value])

  function set(next: Parts): void {
    setHeld(next)
    const out = toText(next)
    if (out === sent.current) return
    sent.current = out
    onValueChange?.(out)
  }

  function step(segment: Segment, by: number): void {
    setOverHour(false)
    if (segment === 'period') { set({ ...parts, period: parts.period === 'PM' ? 'AM' : 'PM' }); return }
    const size = segment === 'hour' ? 12 : 60
    const low = segment === 'hour' ? 1 : 0
    const now = parts[segment] ?? (by > 0 ? low + size - 1 : low)
    set({ ...parts, [segment]: ((now - low + by + size) % size) + low })
  }

  function onKeyDown(e: KeyboardEvent<HTMLSpanElement>, segment: Segment): void {
    const next = (dir: 1 | -1): void => {
      const row = [...e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="spinbutton"]') ?? []]
      row[row.indexOf(e.currentTarget) + dir]?.focus()
    }
    if (e.key === 'ArrowUp') { e.preventDefault(); step(segment, 1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); step(segment, -1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); next(-1) }
    else if (e.key === 'Backspace') { e.preventDefault(); typed.current = ''; set({ ...parts, [segment]: null }) }
    else if (segment === 'period' && /^[ap]$/i.test(e.key)) { set({ ...parts, period: e.key.toLowerCase() === 'a' ? 'AM' : 'PM' }); next(1) }
    else if (segment !== 'period' && /^\d$/.test(e.key)) {
      e.preventDefault()
      const digits = `${typed.current}${e.key}`
      const number = Number(digits)
      const top = segment === 'hour' ? 12 : 59
      if (segment === 'hour') setOverHour(number > top)
      if (number <= top && !(segment === 'hour' && number === 0)) set({ ...parts, [segment]: number })
      if (digits.length === 2 || number * 10 > top) { typed.current = ''; next(1) } else typed.current = digits
    }
  }

  const segment = (name: Segment, shown: string, valueNow: number | undefined, low: number, high: number, title: string) => (
    <span
      role="spinbutton"
      tabIndex={field.disabled ? -1 : 0}
      aria-label={`${label} ${title}`}
      aria-valuenow={valueNow}
      aria-valuemin={low}
      aria-valuemax={high}
      aria-valuetext={shown}
      aria-invalid={bad || undefined}
      aria-disabled={field.disabled || undefined}
      data-empty={parts[name] === null ? '' : undefined}
      className={styles.segment}
      onKeyDown={(e) => onKeyDown(e, name)}
      onFocus={() => { typed.current = '' }}
    >
      {still || parts[name] === null ? shown : <RollingText value={shown} still={still} />}
    </span>
  )

  return (
    <div className={cx(styles.wrap, className)}>
      <div id={field.id} role="group" aria-label={label} aria-describedby={field.describedBy} className={cx(form.pill, styles.field)} data-invalid={bad ? '' : undefined} data-disabled={field.disabled ? '' : undefined} data-still={still ? '' : undefined}>
        <span className={form.quiet}><ClockIcon /></span>
        {segment('hour', pad(parts.hour, 'hh'), parts.hour ?? undefined, 1, 12, 'hour')}
        <span className={styles.colon} aria-hidden="true">:</span>
        {segment('minute', pad(parts.minute, 'mm'), parts.minute ?? undefined, 0, 59, 'minute')}
        {segment('period', parts.period ?? 'AM', parts.period === 'PM' ? 1 : 0, 0, 1, 'AM or PM')}
      </div>
      <AnimatePresence initial={false}>
        {bad && message ? (
          <motion.span key="message" role="alert" className={cx(form.message, styles.message)} initial={still ? false : { y: -4, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: still ? 0 : duration.message, ease: ease.out }}>
            <AlertCircleIcon trigger="none" /> {message}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
