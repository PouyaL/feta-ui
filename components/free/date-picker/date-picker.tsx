'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { CalendarIcon } from '@fetaui/react/rounded/calendar'
import { duration, ease } from '../../motion-tokens'
import { Button } from '../button/button'
import { Calendar, type DateRange } from '../calendar/calendar'
import { form, useFieldControl } from '../form-kit/form-kit'
import { useDismiss } from '../form-kit/use-dismiss'
import { cx, LabelSwap, useStill } from '../motion-kit/motion-kit'
import { parseDate } from './parse-date'
import styles from './date-picker.module.css'

type Shared = {
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  id?: string
  defaultMonth?: Date
  isDisabled?: (date: Date) => boolean
  booked?: Date[]
  locale?: string
  /** Month and year selects replace the title. */
  dropdowns?: boolean
  'aria-label'?: string
  animated?: boolean
  className?: string
}

export type DatePickerProps = Shared & (
  | {
      mode?: 'single'
      value?: Date | null
      defaultValue?: Date | null
      onValueChange?: (value: Date | null) => void
      presets?: never
      /** Adds a time row under the month. Past days are disabled. */
      withTime?: boolean
      time?: string
      defaultTime?: string
      onTimeChange?: (time: string) => void
      /** The field takes typed dates like "next friday", and reads them back underneath. */
      natural?: boolean
    }
  | { mode: 'range'; value?: DateRange | null; defaultValue?: DateRange | null; onValueChange?: (value: DateRange | null) => void; /** Quick picks on the left, in days back from today. */ presets?: { label: string; days: number }[]; withTime?: never; time?: never; defaultTime?: never; onTimeChange?: never; natural?: never }
)

/** A pill field that opens a month in a floating surface. */
export function DatePicker(props: DatePickerProps) {
  const { placeholder = 'Pick a date', invalid, disabled, id, defaultMonth, isDisabled, booked, locale = 'en-US', dropdowns = false, 'aria-label': label, animated = true, className } = props
  const still = useStill(animated)
  const field = useFieldControl({ id, invalid, disabled })
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [heldDate, setHeldDate] = useState<Date | null>(props.mode !== 'range' ? props.defaultValue ?? null : null)
  const [heldRange, setHeldRange] = useState<DateRange | null>(props.mode === 'range' ? props.defaultValue ?? null : null)
  const [heldTime, setHeldTime] = useState(props.defaultTime ?? '')
  const [typed, setTyped] = useState('')
  const close = useCallback(() => setOpen(false), [])
  const format = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }), [locale])

  useDismiss(root, open, close)

  function done(): void {
    setOpen(false)
    trigger.current?.focus()
  }

  const pastOff = (date: Date): boolean => {
    const now = new Date()
    return date < new Date(now.getFullYear(), now.getMonth(), now.getDate()) || Boolean(isDisabled?.(date))
  }
  const shared = { ...(props.mode !== 'range' && props.withTime ? { isDisabled: pastOff } : isDisabled ? { isDisabled } : {}), ...(booked ? { booked } : {}), locale, dropdowns, animated }
  let text: string | null
  let picker: ReactNode

  if (props.mode === 'range') {
    const value = props.value === undefined ? heldRange : props.value
    text = value ? `${format.format(value.start)}${value.end ? ` to ${format.format(value.end)}` : ''}` : null
    const set = (next: DateRange | null): void => { setHeldRange(next); props.onValueChange?.(next) }
    const month = defaultMonth ?? value?.start
    picker = (
      <div className={styles.rangeBody}>
        {props.presets ? (
          <div role="group" aria-label="Quick picks" className={styles.presets}>
            {props.presets.map((preset) => (
              <Button
                key={preset.label}
                size="sm"
                variant="ghost"
                animated={animated}
                onClick={() => {
                  const end = new Date()
                  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - preset.days)
                  set({ start, end })
                  done()
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        ) : null}
        <Calendar {...shared} {...(month ? { defaultMonth: month } : {})} mode="range" value={value} onValueChange={set} onApply={done} />
      </div>
    )
  } else {
    const value = props.value === undefined ? heldDate : props.value
    const time = props.time ?? heldTime
    text = value ? `${format.format(value)}${props.withTime && time ? ` at ${time}` : ''}` : null
    const month = defaultMonth ?? value
    picker = (
      <>
        <Calendar {...shared} {...(month ? { defaultMonth: month } : {})} value={value} onValueChange={(next) => { setHeldDate(next); props.onValueChange?.(next); if (!props.withTime) done() }} />
        {props.withTime ? (
          <label className={styles.timeRow}>
            <span>Time</span>
            <input type="time" className={styles.time} value={time} onChange={(e) => { setHeldTime(e.target.value); props.onTimeChange?.(e.target.value) }} />
            <Button size="sm" animated={animated} disabled={!value || !time} onClick={done}>Done</Button>
          </label>
        ) : null}
      </>
    )
  }

  if (props.mode !== 'range' && props.natural) {
    const value = props.value === undefined ? heldDate : props.value
    const read = (raw: string): void => {
      setTyped(raw)
      const next = parseDate(raw, new Date())
      if (next || !raw) { setHeldDate(next); props.onValueChange?.(next) }
    }
    const parsed = typed ? parseDate(typed, new Date()) : value
    return (
      <div className={cx(styles.picker, className)}>
        <span className={form.pill} data-invalid={field.invalid || (typed && !parsed) ? '' : undefined} data-disabled={field.disabled ? '' : undefined} data-still={still ? '' : undefined}>
          <span className={form.quiet}><CalendarIcon /></span>
          <input id={field.id} className={form.entry} aria-label={label} aria-invalid={field.invalid || (typed && !parsed) ? true : undefined} aria-describedby={field.describedBy} autoComplete="off" disabled={field.disabled} placeholder={props.placeholder ?? 'Try next friday'} value={typed} onChange={(e) => read(e.target.value)} />
        </span>
        <span className={styles.readBack} role="status">
          {typed && !parsed ? 'That is not a date yet' : parsed ? <LabelSwap swapKey={parsed.toDateString()} still={still}>{format.format(parsed)}</LabelSwap> : ''}
        </span>
      </div>
    )
  }

  return (
    <div ref={root} className={cx(styles.picker, className)} onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); done() } }}>
      <button
        ref={trigger}
        id={field.id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        aria-invalid={field.invalid || undefined}
        aria-describedby={field.describedBy}
        disabled={field.disabled}
        data-open={open ? '' : undefined}
        data-invalid={field.invalid ? '' : undefined}
        data-disabled={field.disabled ? '' : undefined}
        data-still={still ? '' : undefined}
        className={cx(form.pill, styles.trigger)}
        onClick={(e) => {
          // Safari does not focus a button on click, and Esc needs it to.
          e.currentTarget.focus()
          setOpen(!open)
        }}
      >
        <span className={form.quiet}><CalendarIcon /></span>
        <span className={styles.value} data-empty={text ? undefined : ''}><LabelSwap swapKey={text ?? ''} still={still}>{text ?? placeholder}</LabelSwap></span>
        {field.invalid ? <span className={form.danger}><AlertCircleIcon trigger="none" /></span> : null}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-label={label ?? 'Choose a date'}
            className={cx(form.pop, styles.pop)}
            initial={still ? { opacity: 1 } : { opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
            transition={{ duration: still ? 0 : duration.open, ease: ease.out }}
          >
            {picker}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
