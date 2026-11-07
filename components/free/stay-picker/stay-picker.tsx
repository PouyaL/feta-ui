'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { ChevronLeftIcon } from '@fetaui/react/rounded/chevron-left'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { duration, ease } from '../../motion-tokens'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { LabelSwap, RollingText, cx, useStill } from '../motion-kit/motion-kit'
import styles from './stay-picker.module.css'

export type StayRange = { from: Date; to: Date }
/** The picked nights so far: nothing, a check-in only, or a full stay. */
export type StaySelection = { from: Date | null; to: Date | null }

export type StayPickerProps = {
  /** The month shown first. */
  month: Date
  /** The price of a night, or null when it is booked. */
  priceFor: (night: Date) => number | null
  currency?: string
  /** Named under the title. Default USD. */
  currencyName?: string
  /** The selection, for a controlled picker. Pair it with `onChange`. */
  value?: StaySelection
  /** The first selection of an uncontrolled picker. */
  defaultValue?: StaySelection
  /** Fires on every pick, deselect and clear. */
  onChange?: (value: StaySelection) => void
  /** The shortest stay in nights. Default 1. */
  minNights?: number
  /** The longest stay in nights. */
  maxNights?: number
  /** Return a promise to hold Reserve in a loading state. A rejection returns to Reserve and shows `failedMessage`. */
  onReserve?: (stay: StayRange, total: number) => void | Promise<void>
  /** Shown when onReserve rejects. */
  failedMessage?: string
  locale?: string
  animated?: boolean
  className?: string
}

type Refusal = { night: Date; text: string }

const EMPTY: StaySelection = { from: null, to: null }
const same = (a: Date | null, b: Date | null): boolean => Boolean(a && b) && a?.toDateString() === b?.toDateString()
const add = (date: Date, days: number): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const startOf = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1)
const sameMonth = (a: Date, b: Date): boolean => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
const nightsBetween = (a: Date, b: Date): Date[] => {
  const out: Date[] = []
  for (let d = a; d < b; d = add(d, 1)) out.push(d)
  return out
}
const keyOf = (stay: StaySelection): string => `${stay.from?.toDateString() ?? ''}|${stay.to?.toDateString() ?? ''}`

/**
 * Pick a stay night by night, with prices in the grid. A range cannot cross a booked night.
 * Clicking the check-in again clears the stay; clicking the check-out keeps the check-in and asks for a new check-out. Esc clears.
 */
export function StayPicker({ month: firstMonth, priceFor, currency = '$', currencyName = 'USD', value, defaultValue, onChange, minNights = 1, maxNights, onReserve, failedMessage = 'Could not reserve these nights. Try again.', locale = 'en-US', animated = true, className }: StayPickerProps) {
  const still = useStill(animated)
  const grid = useRef<HTMLDivElement>(null)
  const [month, setMonth] = useState(() => startOf(firstMonth))
  const [own, setOwn] = useState<StaySelection>(defaultValue ?? EMPTY)
  const stay = value ?? own
  const { from, to } = stay
  const [hover, setHover] = useState<Date | null>(null)
  const [refused, setRefused] = useState<Refusal | null>(null)
  // The stay these flags belong to, so a new selection, from a click or from the parent, drops them.
  const [reservedKey, setReservedKey] = useState<string | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [reserving, setReserving] = useState(false)
  const [cursor, setCursor] = useState<Date>(() => defaultValue?.from ?? value?.from ?? startOf(firstMonth))
  const focusNext = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const days = useMemo(() => Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)), [month])
  const prices = useMemo(() => days.map(priceFor), [days, priceFor])
  const lowest = useMemo(() => Math.min(...prices.filter((p): p is number => p !== null)), [prices])
  // Built once per locale: a hover renders the whole grid, and each formatter is costly to construct.
  const { heading, stamp, long, short } = useMemo(() => ({
    heading: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
    stamp: new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }),
    long: new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }),
    short: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
  }), [locale])
  const title = heading.format(month)
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2023, 0, 2 + i)).slice(0, 2)), [locale])

  const firstFull = (a: Date, b: Date): Date | undefined => nightsBetween(a, b).find((night) => priceFor(night) === null)
  const count = from && to ? nightsBetween(from, to).length : 0
  const total = from && to ? nightsBetween(from, to).reduce((sum, night) => sum + (priceFor(night) ?? 0), 0) : 0
  const key = keyOf(stay)
  const reserved = reservedKey === key && count > 0
  const failed = failedKey === key

  // Keyboard moves into another month: focus the cursor once that month renders.
  useEffect(() => {
    if (!focusNext.current) return
    focusNext.current = false
    grid.current?.querySelector<HTMLElement>(`[data-day="${cursor.getDate()}"]`)?.focus()
  }, [month, cursor])

  function commit(next: StaySelection): void {
    setRefused(null)
    if (value === undefined) setOwn(next)
    onChange?.(next)
  }

  /** Why `day` cannot close a stay that starts on `start`, or null when it can. */
  function closeRefusal(start: Date, day: Date): string | null {
    const full = firstFull(start, day)
    if (full) return `${short.format(full)} is booked. Check out on ${short.format(full)} or earlier`
    const length = nightsBetween(start, day).length
    if (length < minNights) return `Stays are ${minNights} nights or more`
    if (maxNights !== undefined && length > maxNights) return `Stays are ${maxNights} ${maxNights === 1 ? 'night' : 'nights'} at most`
    return null
  }

  async function reserve(): Promise<void> {
    if (!from || !to || !valid || reserving || reserved) return
    const stayKey = key
    setReserving(true)
    setFailedKey(null)
    try {
      await onReserve?.({ from, to }, total)
      if (alive.current) setReservedKey(stayKey)
    } catch {
      if (alive.current) setFailedKey(stayKey)
    } finally {
      if (alive.current) setReserving(false)
    }
  }

  function choose(day: Date): void {
    if (reserving) return
    // Hover only updates while a check-out is pending, so start the preview from the night under the pointer.
    setHover(day)
    // Deselect: the check-in clears the stay, the check-out returns to check-in only.
    if (same(day, from)) { commit(EMPTY); return }
    if (same(day, to) && from) { commit({ from, to: null }); return }
    const booked = priceFor(day) === null
    if (from && !to && day > from) {
      const why = closeRefusal(from, day)
      if (why) { setRefused({ night: day, text: why }); return }
      commit({ from, to: day })
      return
    }
    // A new check-in: the first pick, a pick before check-in, or any pick once the stay is complete.
    if (booked) { setRefused({ night: day, text: `${short.format(day)} is booked. Pick another check-in night` }); return }
    commit({ from: day, to: null })
  }

  function clear(): boolean {
    if (reserving || (!from && !to && !refused)) return false
    setRefused(null)
    if (from || to) commit(EMPTY)
    return true
  }

  function moveTo(next: Date): void {
    setCursor(next)
    setHover(next)
    if (sameMonth(next, month)) grid.current?.querySelector<HTMLElement>(`[data-day="${next.getDate()}"]`)?.focus()
    else { focusNext.current = true; setMonth(startOf(next)) }
  }

  function onEscape(e: KeyboardEvent<HTMLElement>): void {
    // Only claims Esc when there is something to clear, so a surrounding dialog still closes.
    if (e.key === 'Escape' && clear()) { e.preventDefault(); e.stopPropagation() }
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, day: Date): void {
    const weekday = (day.getDay() + 6) % 7
    const steps: Record<string, () => Date> = {
      ArrowRight: () => add(day, 1),
      ArrowLeft: () => add(day, -1),
      ArrowDown: () => add(day, 7),
      ArrowUp: () => add(day, -7),
      Home: () => add(day, -weekday),
      End: () => add(day, 6 - weekday),
      PageDown: () => new Date(day.getFullYear(), day.getMonth() + 1, Math.min(day.getDate(), new Date(day.getFullYear(), day.getMonth() + 2, 0).getDate())),
      PageUp: () => new Date(day.getFullYear(), day.getMonth() - 1, Math.min(day.getDate(), new Date(day.getFullYear(), day.getMonth(), 0).getDate())),
    }
    const step = steps[e.key]
    if (!step) return
    e.preventDefault()
    moveTo(step())
  }

  function shift(by: number): void {
    const next = new Date(month.getFullYear(), month.getMonth() + by, 1)
    setMonth(next)
    setHover(null)
  }

  const blank = (month.getDay() + 6) % 7
  // A stay given by the parent, or kept across a rule change, still has to meet the rules to be reserved.
  const valid = Boolean(from && to && to > from && !closeRefusal(from, to))
  // The one night in the tab order: the cursor, else the check-in, else the first night of the month.
  const tabStop = sameMonth(cursor, month) ? cursor.getDate() : from && sameMonth(from, month) ? from.getDate() : 1
  const summary = from && to ? `${stamp.format(from)} → ${stamp.format(to)} · ${count} ${count === 1 ? 'night' : 'nights'}` : from ? `Check-in ${stamp.format(from)}. Now pick check-out` : 'Pick a check-in night'
  const edge = hover && from && !to && hover > from && !closeRefusal(from, hover) ? hover : null
  // The first booked night from check-in to the end of this month. A night closes the stay when none lies before it.
  const lastDay = days[days.length - 1]
  const wall = from && !to && lastDay ? firstFull(from, add(lastDay, 1)) : undefined

  return (
    <section className={cx(styles.card, className)} aria-label="Choose your stay" data-still={still ? '' : undefined} onKeyDown={onEscape}>
      <header className={styles.head}>
        <IconButton variant="ghost" size="sm" animated={animated} label="Previous month" icon={<ChevronLeftIcon />} onClick={() => shift(-1)} />
        <span className={styles.heading}><b className={styles.title} aria-live="polite">{title}</b><span>Nightly price in {currencyName}</span></span>
        <IconButton variant="ghost" size="sm" animated={animated} label="Next month" icon={<ChevronRightIcon />} onClick={() => shift(1)} />
      </header>
      <div ref={grid} className={styles.grid} role="group" aria-label={title} onPointerLeave={() => setHover(null)}>
        {weekdays.map((weekday) => <span key={weekday} className={styles.weekday} aria-hidden="true">{weekday}</span>)}
        {blank > 0 ? <span style={{ gridColumn: `span ${blank}` }} /> : null}
        {days.map((day, i) => {
          const price = prices[i] ?? null
          const booked = price === null
          const start = same(day, from)
          const end = same(day, to)
          const inside = Boolean(from && to && day > from && day < to)
          const preview = Boolean(from && edge && day > from && day <= edge)
          const bad = same(day, refused?.night ?? null)
          // A booked night can still end a stay: its guests arrive after check-out.
          const closing = Boolean(from && !to && day > from && (!wall || day <= wall))
          const role = start ? ', check-in' : end ? ', check-out' : ''
          return (
            <button
              key={day.toDateString()}
              type="button"
              data-night=""
              data-day={day.getDate()}
              tabIndex={day.getDate() === tabStop ? 0 : -1}
              aria-disabled={(booked && !closing) || undefined}
              aria-pressed={start || end || inside}
              aria-label={`${long.format(day)}, ${booked ? 'full' : `${currency}${price}`}${role}`}
              className={styles.night}
              data-end={start || end ? '' : undefined}
              data-inside={inside ? '' : undefined}
              data-preview={preview ? '' : undefined}
              data-booked={booked ? '' : undefined}
              data-refused={bad ? '' : undefined}
              onPointerEnter={() => { if (from && !to) setHover(day) }}
              onFocus={() => { setCursor(day); setHover(day) }}
              onClick={() => choose(day)}
              onKeyDown={(e) => onKeyDown(e, day)}
            >
              <span className={styles.date}>{day.getDate()}</span>
              <span className={styles.price} data-low={price === lowest ? '' : undefined}>{booked ? 'Full' : `${currency}${price}`}</span>
            </button>
          )
        })}
      </div>
      <div className={styles.note} role="status">
        <AnimatePresence initial={false} mode="wait">
          {failed || refused ? (
            <motion.span key={failed ? 'failed' : `refused-${refused?.text ?? ''}`} className={styles.refused} initial={still ? false : { y: -4, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0, transition: { duration: still ? 0 : duration.fast } }} transition={{ duration: still ? 0 : duration.message, ease: ease.out }}>
              <AlertCircleIcon size={14} aria-hidden="true" />
              <span>{failed ? failedMessage : refused?.text}</span>
            </motion.span>
          ) : (
            <span key="sum"><LabelSwap swapKey={summary} still={still}>{summary}</LabelSwap></span>
          )}
        </AnimatePresence>
      </div>
      <div className={styles.foot}>
        <span className={styles.totalBox}>
          <span>Total</span>
          {count ? <b className={styles.total} data-reserved={reserved ? '' : undefined}>{currency}<RollingText value={String(total)} still={still} /></b> : <b className={styles.total}>Pick dates</b>}
          {reserved ? <span className={styles.sent}>Confirmation sent</span> : count ? <span>{currency}{Math.round(total / count)} a night, taxes in</span> : null}
        </span>
        <Button
          animated={animated}
          variant={reserved ? 'secondary' : 'primary'}
          leadingIcon={reserved ? <Tick02Icon /> : undefined}
          disabled={!valid}
          aria-disabled={reserved || undefined}
          status={reserving ? 'loading' : 'idle'}
          onClick={() => { void reserve() }}
        >
          {reserved ? 'Reserved' : 'Reserve'}
        </Button>
      </div>
    </section>
  )
}
