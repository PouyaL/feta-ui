'use client'
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { duration, ease, spring } from '../../motion-tokens'
import { Button } from '../button/button'
import { LabelSwap, cx, useStill } from '../motion-kit/motion-kit'
import { ToggleGroup } from '../toggle-group/toggle-group'
import styles from './slot-picker.module.css'

export type SlotDay = { key: string; label: string; /** Used in the summary, like Mon, Nov 2. */ date: string; free: string; busy: [start: number, end: number][] }

export type SlotPickerProps = {
  title: string
  /** Under the title, like with Lena Ortiz · Lisbon. */
  subtitle?: string
  avatar?: ReactNode
  days: SlotDay[]
  /** Length options in minutes. */
  lengths?: number[]
  /** The viewer's zone, for the footer. */
  zone?: string
  /** The host, to show their local time and who gets the invite. */
  host?: { name: string; city: string; /** Hours ahead of the viewer. */ offset: number }
  /** The hour the timeline starts and ends. Default 9 and 17. */
  from?: number
  to?: number
  /** Return a promise to hold Confirm in a loading state. A rejection returns to Confirm and shows `failedMessage`. */
  onConfirm?: (day: string, start: number, minutes: number) => void | Promise<void>
  /** Shown when onConfirm rejects. */
  failedMessage?: string
  animated?: boolean
  className?: string
}

const SNAP = 0.25
const lengthLabel = (minutes: number): string => (minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`)
const time = (hour: number): string => {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}`
}
const clock = (hour: number): string => `${time(hour)}${hour >= 12 ? 'pm' : 'am'}`
const upper = (hour: number): string => `${time(hour)} ${hour >= 12 ? 'PM' : 'AM'}`

/** Book a time by placing a block on a day's timeline. It snaps to 15 minutes and avoids busy time. */
export function SlotPicker({ title, subtitle, avatar, days, lengths = [30, 60, 90], zone = 'Your time', host, from = 9, to = 17, onConfirm, failedMessage = 'Could not book this time. Try again.', animated = true, className }: SlotPickerProps) {
  const still = useStill(animated)
  const line = useRef<HTMLDivElement>(null)
  const block = useRef<HTMLDivElement>(null)
  // The block sits at its slot by top and height; moves and placing play as transforms only.
  const blockY = useMotionValue(0)
  const blockScale = useMotionValue(1)
  // The time label waits out the grow, then fades in, so the scale never squashes its text.
  const labelFade = useMotionValue(1)
  const placed = useRef<number | null>(null)
  const keyed = useRef(false)
  const [dayKey, setDayKey] = useState(days[0]?.key ?? '')
  const [minutes, setMinutes] = useState(lengths[1] ?? lengths[0] ?? 60)
  const [start, setStart] = useState<number | null>(null)
  const [ghost, setGhost] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [booked, setBooked] = useState(false)
  const [booking, setBooking] = useState(false)
  const [failed, setFailed] = useState(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const day = days.find((one) => one.key === dayKey) ?? days[0]
  const busy = day?.busy ?? []
  const span = minutes / 60
  const total = to - from

  const free = (at: number): boolean => at >= from && at + span <= to && !busy.some(([s, e]) => at < e && at + span > s)
  /** The nearest free start, so a block never lands on busy time. */
  const nearest = (at: number): number | null => {
    for (let gap = 0; gap <= total; gap += SNAP) {
      if (free(at + gap)) return at + gap
      if (free(at - gap)) return at - gap
    }
    return null
  }
  const fromPointer = (e: PointerEvent<HTMLDivElement>): number => {
    const box = (line.current ?? e.currentTarget).getBoundingClientRect()
    const hour = from + ((e.clientY - box.top) / box.height) * total - span / 2
    return from + Math.round((hour - from) / SNAP) * SNAP
  }
  const pick = (next: number | null): void => { if (next !== null && !booking) { setStart(next); setBooked(false); setFailed(false) } }

  async function confirm(): Promise<void> {
    if (start === null || booking) return
    setBooking(true)
    setFailed(false)
    try {
      await onConfirm?.(dayKey, start, minutes)
      if (alive.current) setBooked(true)
    } catch {
      if (alive.current) setFailed(true)
    } finally {
      if (alive.current) setBooking(false)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (start === null) return
    const by = e.key === 'ArrowDown' ? SNAP : e.key === 'ArrowUp' ? -SNAP : 0
    if (!by) return
    e.preventDefault()
    let at = start + by
    while (at >= from && at + span <= to && !free(at)) at += by
    if (free(at)) pick(at)
  }

  function onLineKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (start !== null || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    keyed.current = true
    pick(nearest(from))
  }

  // Placed from the keyboard, the block takes the focus so the arrows can move it.
  useEffect(() => {
    if (!keyed.current || start === null) return
    keyed.current = false
    block.current?.focus({ preventScroll: true })
  }, [start])

  const hovered = ghost !== null && start === null
  const summary = start !== null ? `${day?.date ?? ''} · ${time(start)} to ${upper(start + span)}` : hovered ? `Click to place ${lengthLabel(minutes)} here` : 'Click a free gap, then drag to move'
  const note = failed ? failedMessage : start === null || !host ? null : booked ? `Invite sent to ${host.name}` : `${upper(((start + host.offset) % 24 + 24) % 24)} for ${host.name} in ${host.city}`

  const pct = (hour: number): string => `${((hour - from) / total) * 100}%`
  const size = (hours: number): string => `${(hours / total) * 100}%`

  useLayoutEffect(() => {
    const before = placed.current
    placed.current = start
    if (start === null || before === start) return
    if (before === null) {
      // Placing grows the block down from the click, even when the click starts a drag.
      blockY.jump(0)
      if (still) { blockScale.jump(1); labelFade.jump(1); return }
      blockScale.jump(0)
      labelFade.jump(0)
      animate(blockScale, 1, { duration: duration.lift, ease: ease.out })
      animate(labelFade, 1, { duration: duration.lift, delay: duration.lift, ease: ease.out })
      return
    }
    if (still || dragging) { blockY.jump(0); return }
    const height = line.current?.clientHeight ?? 0
    blockY.jump(blockY.get() + ((before - start) / total) * height)
    animate(blockY, 0, spring.row)
  }, [start, still, dragging, total, blockY, blockScale, labelFade])

  // Reduced motion arriving mid grow settles the block and its label at once.
  useLayoutEffect(() => {
    if (!still) return
    blockScale.jump(1)
    labelFade.jump(1)
  }, [still, blockScale, labelFade])

  return (
    <section className={cx(styles.card, className)} aria-label={title} data-still={still ? '' : undefined}>
      <header className={styles.head}>{avatar}<span className={styles.heading}><b className={styles.title}>{title}</b>{subtitle ? <span>{subtitle}</span> : null}</span></header>
      <ToggleGroup type="single" label="Length" animated={animated} items={lengths.map((length) => ({ value: String(length), label: lengthLabel(length) }))} value={String(minutes)} onValueChange={(next) => { setMinutes(Number(next)); setStart(null); setBooked(false); setFailed(false) }} />
      <div className={styles.days} role="radiogroup" aria-label="Day">
        {days.map((one) => (
          <button key={one.key} type="button" role="radio" aria-checked={one.key === dayKey} disabled={one.free === 'Full'} className={styles.day} onClick={() => { setDayKey(one.key); setStart(null); setBooked(false); setFailed(false) }}>
            <span>{one.label}</span><span className={styles.dayFree}>{one.free}</span>
          </button>
        ))}
      </div>
      <div className={styles.timeline}>
        <ol className={styles.hours} style={{ '--hours': total } as CSSProperties} aria-hidden="true">{Array.from({ length: total + 1 }, (_, i) => <li key={i}>{clock(from + i)}</li>)}</ol>
        <div
          ref={line}
          className={styles.line}
          style={{ '--hours': total } as CSSProperties}
          role="group"
          tabIndex={start === null ? 0 : -1}
          aria-label="Timeline. Press Enter to place the meeting, or pick a free gap."
          onKeyDown={onLineKeyDown}
          onPointerMove={(e) => { if (dragging) pick(nearest(fromPointer(e))); else if (e.pointerType === 'mouse') setGhost(nearest(fromPointer(e))) }}
          onPointerLeave={() => setGhost(null)}
          onPointerDown={(e) => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); pick(nearest(fromPointer(e))); setDragging(true); setGhost(null) }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          {busy.filter(([s, e]) => e > from && s < to).map(([s, e]) => <span key={s} className={styles.busy} style={{ top: pct(Math.max(s, from)), height: size(Math.min(e, to) - Math.max(s, from)) }}>Busy</span>)}
          {ghost !== null && ghost !== start ? <span className={styles.ghost} style={{ top: pct(ghost), height: size(span) }} aria-hidden="true">{time(ghost)} to {time(ghost + span)}</span> : null}
          {start !== null ? (
            <motion.div
              ref={block}
              style={{ top: pct(start), height: size(span), y: blockY, scaleY: blockScale, transformOrigin: '50% 0%' }}
              role="slider"
              tabIndex={0}
              aria-label="Meeting start"
              aria-valuemin={from}
              aria-valuemax={to}
              aria-valuenow={start}
              aria-valuetext={`${time(start)} to ${upper(start + span)}`}
              aria-orientation="vertical"
              className={styles.block}
              data-dragging={dragging ? '' : undefined}
              onKeyDown={onKeyDown}
            >
              <motion.span style={{ opacity: labelFade }}>{time(start)} to {time(start + span)}</motion.span><i className={styles.handle} aria-hidden="true" />
            </motion.div>
          ) : null}
        </div>
      </div>
      <footer className={styles.foot}>
        <span className={styles.zone}>{zone}</span>
        <div className={styles.summary}>
          <span role="status" className={styles.when}><LabelSwap swapKey={summary} still={still}>{summary}</LabelSwap></span>
          {note ? <span className={styles.done} data-booked={booked ? '' : undefined} data-failed={failed ? '' : undefined}><AnimatePresence initial={false} mode="wait"><motion.span key={note} initial={still ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: still ? 0 : duration.message, ease: ease.out }}>{booked ? <Tick02Icon trigger="none" /> : null} {note}</motion.span></AnimatePresence></span> : null}
        </div>
        <Button size="sm" animated={animated} disabled={start === null || booked} status={booking ? 'loading' : 'idle'} onClick={() => { void confirm() }}>{booked ? 'Booked' : 'Confirm'}</Button>
      </footer>
    </section>
  )
}
