'use client'
import { motion } from 'motion/react'
import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeftIcon } from '@fetaui/react/rounded/chevron-left'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { duration, ease } from '../../motion-tokens'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './calendar-schedule.module.css'

export type ScheduleEvent = { id: string; date: Date; title: string; time: string; /** Where, like Main room · 8 attendees. */ place?: string; tone?: 'ink' | 'success' | 'warning' | 'danger' }

export type CalendarScheduleProps = {
  month: Date
  events: ScheduleEvent[]
  /** Today, passed in so the server and the client agree. */
  today?: Date
  defaultSelected?: Date
  onAdd?: (day: Date) => void
  locale?: string
  animated?: boolean
  className?: string
}

const SHOWN = 2
const STAGGER = 0.04
const key = (date: Date): string => date.toDateString()

/** A month with its events in the grid, and the picked day's agenda beside it. */
export function CalendarSchedule({ month: firstMonth, events, today, defaultSelected, onAdd, locale = 'en-US', animated = true, className }: CalendarScheduleProps) {
  const still = useStill(animated)
  const grid = useRef<HTMLDivElement>(null)
  const [month, setMonth] = useState(new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1))
  const [selected, setSelected] = useState(defaultSelected ?? today ?? firstMonth)
  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>()
    for (const event of events) map.set(key(event.date), [...(map.get(key(event.date)) ?? []), event])
    return map
  }, [events])
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const lead = first.getDay()
    const count = Math.ceil((lead + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7
    return Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - lead + i))
  }, [month])
  const title = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2023, 0, 1 + i))), [locale])
  const long = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' })
  const agenda = byDay.get(key(selected)) ?? []
  const monthCount = events.filter((event) => event.date.getMonth() === month.getMonth() && event.date.getFullYear() === month.getFullYear()).length

  // Another month may not show the selected day, and the grid still needs a Tab stop.
  const stop = days.some((day) => key(day) === key(selected)) ? key(selected) : key(new Date(month.getFullYear(), month.getMonth(), 1))

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const by: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }
    const step = by[e.key]
    if (step === undefined) return
    e.preventDefault()
    const next = Math.min(days.length - 1, Math.max(0, index + step))
    const day = days[next]
    if (day) setSelected(day)
    grid.current?.querySelectorAll<HTMLElement>('[data-day]')[next]?.focus()
  }

  return (
    <section className={cx(styles.tray, className)} aria-label="Schedule" data-still={still ? '' : undefined}>
      <div className={styles.body}>
        <div className={styles.calendar}>
          <header className={styles.head}>
            <span className={styles.heading}><b className={styles.title} aria-live="polite">{title}</b><span>{monthCount} {monthCount === 1 ? 'event' : 'events'} this month</span></span>
            <IconButton variant="ghost" size="sm" animated={animated} label="Previous month" icon={<ChevronLeftIcon />} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
            <IconButton variant="ghost" size="sm" animated={animated} label="Next month" icon={<ChevronRightIcon />} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
          </header>
          <div ref={grid} className={styles.grid}>
            {weekdays.map((weekday, i) => <span key={i} className={styles.weekday} aria-hidden="true">{weekday}</span>)}
            {days.map((day, i) => {
              const list = byDay.get(key(day)) ?? []
              const on = key(day) === key(selected)
              return (
                <button key={key(day)} type="button" data-day="" tabIndex={key(day) === stop ? 0 : -1} aria-pressed={on} aria-label={`${long.format(day)}, ${list.length} ${list.length === 1 ? 'event' : 'events'}`} className={styles.day} data-on={on ? '' : undefined} data-outside={day.getMonth() !== month.getMonth() ? '' : undefined} onClick={() => setSelected(day)} onKeyDown={(e) => onKeyDown(e, i)}>
                  <span className={styles.number} data-today={today && key(today) === key(day) ? '' : undefined}>{day.getDate()}</span>
                  <span className={styles.chips} aria-hidden="true">
                    {list.slice(0, SHOWN).map((event) => <span key={event.id} className={styles.chip} data-tone={event.tone ?? 'ink'}>{event.title}</span>)}
                    {list.length > SHOWN ? <span className={styles.more}>+{list.length - SHOWN} more</span> : null}
                  </span>
                  <span className={styles.dots} aria-hidden="true">{list.slice(0, 3).map((event) => <i key={event.id} data-tone={event.tone ?? 'ink'} />)}</span>
                </button>
              )
            })}
          </div>
        </div>
        <motion.aside key={key(selected)} className={styles.agenda} aria-label="Agenda" aria-live="polite" initial={still ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: still ? 0 : duration.open, ease: ease.out }}>
          <header className={styles.agendaHead}>
            <span>{long.format(selected)}{today && key(today) === key(selected) ? <i className={styles.today}>Today</i> : null}</span>
            <IconButton variant="outline" size="sm" animated={animated} label="Add event" icon={<PlusIcon />} onClick={() => onAdd?.(selected)} />
          </header>
          {agenda.length ? (
            <ul className={styles.rows}>
              {agenda.map((event, i) => (
                <motion.li key={event.id} className={styles.row} data-tone={event.tone ?? 'ink'} initial={still ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: still ? 0 : duration.open, ease: ease.out, delay: still ? 0 : i * STAGGER }}>
                  <b>{event.title}</b><span>{event.time}</span>{event.place ? <span>{event.place}</span> : null}
                </motion.li>
              ))}
            </ul>
          ) : <p className={styles.empty}>Nothing planned</p>}
        </motion.aside>
      </div>
    </section>
  )
}
