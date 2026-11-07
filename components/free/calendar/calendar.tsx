'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowLeftIcon } from '@fetaui/react/rounded/arrow-left'
import { ArrowRightIcon } from '@fetaui/react/rounded/arrow-right'
import { duration, ease, spring } from '../../motion-tokens'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { Select } from '../select/select'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './calendar.module.css'

const WEEK = 7
const ROWS = 6
const SLIDE = 24
const NO_DATES: Date[] = []

export type DateRange = { start: Date; end: Date | null }

type Shared = {
  /** The month to open on. Defaults to the value, then today. */
  defaultMonth?: Date
  /** Show two months side by side on Web. */
  months?: 1 | 2
  /** Days that cannot be picked. */
  isDisabled?: (date: Date) => boolean
  /** Days shown struck through. */
  booked?: Date[]
  /** Days with a dot. */
  events?: Date[]
  /** Month and year selects replace the title. */
  dropdowns?: boolean
  /** Fixed by default, so the server and browser render the same text. */
  locale?: string
  /** The day ringed as today. Defaults to the browser's date, set after mount. */
  today?: Date
  animated?: boolean
  className?: string
}

export type CalendarProps = Shared & (
  | { mode?: 'single'; value?: Date | null; defaultValue?: Date | null; onValueChange?: (value: Date | null) => void; onApply?: never; slots?: never; slot?: never; onSlotChange?: never }
  | { mode: 'range'; value?: DateRange | null; defaultValue?: DateRange | null; onValueChange?: (value: DateRange | null) => void; /** Adds the summary and Apply footer. */ onApply?: (value: DateRange) => void; slots?: never; slot?: never; onSlotChange?: never }
  | { mode: 'datetime'; value?: Date | null; defaultValue?: Date | null; onValueChange?: (value: Date | null) => void; onApply?: (value: Date, slot: string) => void; /** Time slots under the month. */ slots: string[]; slot?: string; onSlotChange?: (slot: string) => void }
)

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1)
const addMonths = (date: Date, count: number): Date => new Date(date.getFullYear(), date.getMonth() + count, 1)
/** A day of the month, held to that month's last day. */
const inMonth = (day: number, month: Date): Date => new Date(month.getFullYear(), month.getMonth(), Math.min(day, new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()))
const addDays = (date: Date, count: number): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + count)
const sameDay = (a: Date | null | undefined, b: Date | null | undefined): boolean => Boolean(a && b) && a?.toDateString() === b?.toDateString()
const dayValue = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
const between = (date: Date, a: Date, b: Date): boolean => {
  const [low, high] = [dayValue(a), dayValue(b)].sort((x, y) => x - y) as [number, number]
  return dayValue(date) > low && dayValue(date) < high
}

const years = (around: number): { value: string; label: string }[] => Array.from({ length: 11 }, (_, i) => ({ value: String(around - 5 + i), label: String(around - 5 + i) }))

function monthDays(month: Date): Date[] {
  const first = startOfMonth(month)
  return Array.from({ length: WEEK * ROWS }, (_, i) => addDays(first, i - first.getDay()))
}

/** Pick a date, a range, or a date and time. Six rows always, so the height never jumps. */
export function Calendar(props: CalendarProps) {
  const { mode = 'single', defaultMonth, months = 1, isDisabled, booked = NO_DATES, events = [], locale = 'en-US', dropdowns = false, today: todayProp, animated = true, className } = props
  const still = useStill(animated)
  const [heldDate, setHeldDate] = useState<Date | null>(mode !== 'range' ? ((props.defaultValue as Date | null | undefined) ?? null) : null)
  const [heldRange, setHeldRange] = useState<DateRange | null>(mode === 'range' ? ((props.defaultValue as DateRange | null | undefined) ?? null) : null)
  const date = mode === 'range' ? null : props.value === undefined ? heldDate : (props.value as Date | null)
  const range = mode === 'range' ? (props.value === undefined ? heldRange : (props.value as DateRange | null)) : null
  const anchor = defaultMonth ?? date ?? range?.start ?? null
  // The server cannot know today in the viewer's zone, so an unanchored month waits for the browser.
  const [view, setView] = useState<Date | null>(anchor ? startOfMonth(anchor) : null)
  const [browserToday, setToday] = useState<Date | null>(null)
  const today = todayProp ?? browserToday
  const [cursor, setCursor] = useState<Date | null>(date ?? range?.start ?? anchor)
  const [direction, setDirection] = useState(1)
  const [hover, setHover] = useState<Date | null>(null)
  const [heldSlot, setHeldSlot] = useState<string | undefined>(undefined)
  const grid = useRef<HTMLDivElement>(null)
  const follow = useRef(false)
  const slot = mode === 'datetime' ? props.slot ?? heldSlot : undefined

  useEffect(() => {
    const now = new Date()
    setToday(now)
    setView((current) => current ?? startOfMonth(now))
    setCursor((current) => current ?? now)
  }, [])

  // After the render, so a key that changes the month lands on the new page, not the one leaving.
  useEffect(() => {
    if (!follow.current || !cursor) return
    follow.current = false
    const cells = grid.current?.parentElement?.parentElement?.querySelectorAll<HTMLElement>('[tabindex="0"]')
    cells?.item(cells.length - 1)?.focus()
  }, [cursor, view])

  const dayFormat = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }), [locale])
  const titleFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale])
  const shortFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }), [locale])
  const monthNames = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { month: 'short' })
    return Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: format.format(new Date(2023, i, 1)) }))
  }, [locale])
  const weekdays = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    const long = new Intl.DateTimeFormat(locale, { weekday: 'long' })
    return Array.from({ length: WEEK }, (_, i) => { const d = new Date(2023, 0, 1 + i); return { short: format.format(d).slice(0, 2), long: long.format(d) } })
  }, [locale])

  function page(step: number): void {
    setDirection(step)
    if (!view) return
    const next = addMonths(view, step)
    setView(next)
    // The Tab stop stays on a day the page shows.
    if (cursor) setCursor(inMonth(cursor.getDate(), next))
  }

  const bookedDays = useMemo(() => new Set(booked.map(dayValue)), [booked])
  function jump(month: Date): void {
    if (view) setDirection(month > view ? 1 : -1)
    setView(month)
    if (cursor) setCursor(inMonth(cursor.getDate(), month))
  }

  const blocked = (day: Date): boolean => Boolean(isDisabled?.(day)) || bookedDays.has(dayValue(day))

  function pick(day: Date): void {
    setCursor(day)
    if (mode === 'range') {
      const next: DateRange = !range || range.end || dayValue(day) < dayValue(range.start) ? { start: day, end: null } : { start: range.start, end: day }
      setHeldRange(next)
      ;(props.onValueChange as ((v: DateRange | null) => void) | undefined)?.(next)
    } else {
      setHeldDate(day)
      ;(props.onValueChange as ((v: Date | null) => void) | undefined)?.(day)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (!cursor) return
    const steps: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: WEEK, ArrowUp: -WEEK, Home: -cursor.getDay(), End: WEEK - 1 - cursor.getDay() }
    const by = steps[e.key]
    let next: Date | null = by === undefined ? null : addDays(cursor, by)
    if (e.key === 'PageDown') next = inMonth(cursor.getDate(), addMonths(cursor, 1))
    if (e.key === 'PageUp') next = inMonth(cursor.getDate(), addMonths(cursor, -1))
    if (!next) return
    e.preventDefault()
    setCursor(next)
    if (view) {
      const months = (next.getFullYear() - view.getFullYear()) * 12 + next.getMonth() - view.getMonth()
      if (months !== 0 && months !== (props.months === 2 ? 1 : 0)) { setDirection(months > 0 ? 1 : -1); setView(startOfMonth(next)) }
    }
    follow.current = true
  }

  const end = range?.end ?? (range && hover && dayValue(hover) > dayValue(range.start) ? hover : null)

  function dayCell(day: Date, month: Date) {
    const outside = day.getMonth() !== month.getMonth()
    const isBooked = bookedDays.has(dayValue(day))
    const off = Boolean(isDisabled?.(day))
    const start = sameDay(range?.start, day)
    const finish = sameDay(range?.end, day)
    const middle = Boolean(range && end && between(day, range.start, end))
    const previewEnd = Boolean(range && !range.end && sameDay(hover, day) && end)
    const chosen = sameDay(date, day) || start || finish
    const focusable = sameDay(cursor, day) && !outside
    return (
      <button
        key={day.toISOString()}
        type="button"
        role="gridcell"
        tabIndex={focusable ? 0 : -1}
        aria-label={dayFormat.format(day)}
        aria-selected={chosen || undefined}
        aria-disabled={off || isBooked || undefined}
        aria-current={sameDay(today, day) ? 'date' : undefined}
        data-outside={outside ? '' : undefined}
        data-today={sameDay(today, day) ? '' : undefined}
        data-booked={isBooked ? '' : undefined}
        data-off={off ? '' : undefined}
        data-band={middle || previewEnd ? '' : undefined}
        data-start={start && end ? '' : undefined}
        data-end={finish || previewEnd ? '' : undefined}
        data-event={events.some((event) => sameDay(event, day)) ? '' : undefined}
        className={styles.day}
        onClick={() => { if (!blocked(day)) pick(day) }}
        // Only a range previews on hover, so other modes do not re-render every cell.
        onPointerEnter={mode === 'range' ? () => setHover(day) : undefined}
        onFocus={() => setCursor(day)}
      >
        {chosen ? <motion.span className={styles.chip} initial={still ? false : { scale: 0.9 }} animate={{ scale: 1 }} transition={spring.pop} /> : null}
        <span className={styles.number}>{day.getDate()}</span>
      </button>
    )
  }

  const shown = view ? Array.from({ length: months }, (_, i) => addMonths(view, i)) : []
  const applyRange = props.mode === 'range' ? props.onApply : undefined
  const summary = range ? `${shortFormat.format(range.start)}${range.end ? ` to ${shortFormat.format(range.end)}` : ''}` : 'Pick a start date'
  const applyDatetime = props.mode === 'datetime' ? props.onApply : undefined

  return (
    <div className={cx(styles.calendar, className)} data-months={months} data-still={still ? '' : undefined}>
      <div className={styles.card} onPointerLeave={() => setHover(null)}>
        <div className={styles.monthsRow}>
          {(view ? shown : [null]).map((month, i) => {
            const days = month ? monthDays(month) : []
            return (
            <div key={i} className={styles.month}>
              <div className={styles.header}>
                {i === 0 ? <IconButton variant="ghost" size="sm" animated={animated} label="Previous month" icon={<ArrowLeftIcon />} onClick={() => page(-1)} /> : <span className={styles.navSpace} />}
                {dropdowns && month ? (
                  <span className={styles.selects}>
                    <Select kind="pill" aria-label="Month" animated={animated} value={String(month.getMonth())} options={monthNames} onValueChange={(next) => jump(new Date(month.getFullYear(), Number(next), 1))} />
                    <Select kind="pill" aria-label="Year" animated={animated} value={String(month.getFullYear())} options={years(month.getFullYear())} onValueChange={(next) => jump(new Date(Number(next), month.getMonth(), 1))} />
                  </span>
                ) : <span className={styles.titleBox} aria-live="polite">
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={month?.toISOString() ?? 'blank'}
                      className={styles.title}
                      initial={still ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: still ? 0 : duration.focus, ease: ease.out }}
                    >
                      {month ? titleFormat.format(month) : ' '}
                    </motion.span>
                  </AnimatePresence>
                </span>}
                {i === shown.length - 1 || !view ? <IconButton variant="ghost" size="sm" animated={animated} label="Next month" icon={<ArrowRightIcon />} onClick={() => page(1)} /> : <span className={styles.navSpace} />}
              </div>
              <div ref={i === 0 ? grid : undefined} role="grid" aria-label={month ? titleFormat.format(month) : 'Calendar'} className={styles.grid} onKeyDown={onKeyDown}>
                <div role="row" className={styles.week}>
                  {weekdays.map((d) => <span key={d.long} role="columnheader" aria-label={d.long} className={styles.weekday}>{d.short}</span>)}
                </div>
                <div className={styles.rows}>
                  <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                    <motion.div
                      key={month?.toISOString() ?? 'blank'}
                      custom={direction}
                      className={styles.page}
                      initial={still ? false : { x: direction * SLIDE, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={still ? { opacity: 0, transition: { duration: 0 } } : { x: -direction * SLIDE, opacity: 0 }}
                      transition={{ duration: still ? 0 : duration.month, ease: ease.out }}
                    >
                      {Array.from({ length: ROWS }, (_, row) => (
                        <div key={row} role="row" className={styles.week}>
                          {month ? days.slice(row * WEEK, (row + 1) * WEEK).map((day) => dayCell(day, month)) : Array.from({ length: WEEK }, (_, c) => <span key={c} className={styles.day} />)}
                        </div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      </div>
      {props.mode === 'datetime' ? (
        <div role="group" aria-label="Time" className={styles.slots}>
          {props.slots.map((time) => (
            <Button key={time} size="sm" shape="pill" variant={slot === time ? 'primary' : 'secondary'} animated={animated} aria-pressed={slot === time} onClick={() => { setHeldSlot(time); props.onSlotChange?.(time) }}>{time}</Button>
          ))}
        </div>
      ) : null}
      {applyRange ? (
        <div className={styles.footer}>
          <span className={styles.summary}>{summary}</span>
          <Button size="sm" variant="ghost" animated={animated} onClick={() => { setHeldRange(null); (props.onValueChange as ((v: DateRange | null) => void) | undefined)?.(null) }}>Clear</Button>
          <Button size="sm" animated={animated} disabled={!range?.end} onClick={() => { if (range) applyRange(range) }}>Apply</Button>
        </div>
      ) : null}
      {applyDatetime ? (
        <div className={styles.footer}>
          <span className={styles.summary}>{date ? `${shortFormat.format(date)}${slot ? ` at ${slot}` : ''}` : 'Pick a date'}</span>
          <Button size="sm" animated={animated} disabled={!date || !slot} onClick={() => { if (date && slot) applyDatetime(date, slot) }}>Confirm</Button>
        </div>
      ) : null}
    </div>
  )
}
