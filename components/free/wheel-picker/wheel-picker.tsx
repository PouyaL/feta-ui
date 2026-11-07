'use client'
import { animate, motion, useMotionValue, useTransform, type AnimationPlaybackControls } from 'motion/react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { Button } from '../button/button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { spring } from '../../motion-tokens'
import styles from './wheel-picker.module.css'

export type WheelPickerProps = {
  /** 24 hour text, like 09:30. */
  value?: string
  defaultValue?: string
  /** Fires from Set time, once every wheel has settled. */
  onValueChange?: (value: string) => void
  /** Pressed on Cancel. Without it there is no Cancel. */
  onCancel?: () => void
  /** Minutes between rows. Default 1. */
  minuteStep?: number
  title?: string
  submitText?: string
  animated?: boolean
  className?: string
}

type WheelProps = { label: string; options: string[]; index: number; onIndex: (index: number) => void; onMoving: (moving: boolean) => void; still: boolean }

const VISIBLE = 5
const FLICK = 0.18
/** Quiet time after the last wheel event before the wheel snaps. */
const WHEEL_SETTLE_MS = 90
/** The snap runs in rows, so its rest thresholds are in rows too (about a third of a pixel). */
const WHEEL_REST = { restDelta: 0.01, restSpeed: 0.05 } as const

/*
 * The reel moves through a motion value written straight to its transform, so scrolling and
 * dragging never render React. React renders only when the index is committed on settle, and
 * the parent hears about moving only when it starts or stops.
 */
const Wheel = memo(function Wheel({ label, options, index, onIndex, onMoving, still }: WheelProps) {
  const row = useRef(34)
  const box = useRef<HTMLDivElement>(null)
  // Position in rows (0 is the first option, -1 the second), so the reel follows --row on any platform.
  const pos = useMotionValue(-index)
  const top = useTransform(pos, (v) => `calc(var(--row) * ${v + 2})`)
  const run = useRef<AnimationPlaybackControls | undefined>(undefined)
  const drag = useRef<{ startY: number; from: number; lastY: number; lastT: number; speed: number } | null>(null)
  const quiet = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const aim = useRef(index)
  const moving = useRef(false)

  useEffect(() => () => { run.current?.stop(); clearTimeout(quiet.current) }, [])

  // The row height comes from CSS (34 px, 40 px on mobile). Read once when a gesture starts, never per event.
  function readRow(): void {
    if (box.current) row.current = Number.parseFloat(getComputedStyle(box.current).getPropertyValue('--row')) || row.current
  }

  function setMoving(now: boolean): void {
    if (moving.current === now) return
    moving.current = now
    onMoving(now)
  }

  // A value the wheel did not set itself turns it too.
  useEffect(() => {
    if (index !== aim.current && !drag.current) settle(index)
    // Only when the index changes: settle is new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  function settle(next: number): void {
    const at = Math.min(options.length - 1, Math.max(0, next))
    aim.current = at
    onIndex(at)
    run.current?.stop()
    if (still) { pos.jump(-at); setMoving(false); return }
    setMoving(true)
    run.current = animate(pos, -at, { ...spring.wheel, ...WHEEL_REST, onComplete: () => setMoving(false) })
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    const map: Record<string, number> = { ArrowUp: index - 1, ArrowDown: index + 1, PageUp: index - 3, PageDown: index + 3, Home: 0, End: options.length - 1 }
    const next = map[e.key]
    if (next === undefined) return
    e.preventDefault()
    settle(next)
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>): void {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus()
    run.current?.stop()
    clearTimeout(quiet.current)
    readRow()
    setMoving(true)
    drag.current = { startY: e.clientY, from: pos.get(), lastY: e.clientY, lastT: e.timeStamp, speed: 0 }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>): void {
    const d = drag.current
    if (!d) return
    const gap = e.timeStamp - d.lastT
    if (gap > 0) d.speed = (e.clientY - d.lastY) / gap
    d.lastY = e.clientY
    d.lastT = e.timeStamp
    pos.set(Math.min(1, Math.max(-options.length, d.from + (e.clientY - d.startY) / row.current)))
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>): void {
    const d = drag.current
    if (!d) return
    drag.current = null
    const moved = Math.abs(e.clientY - d.startY) > 4
    const fresh = e.timeStamp - d.lastT < 80
    const rect = e.currentTarget.getBoundingClientRect()
    const tapped = index + Math.round((e.clientY - rect.top - rect.height / 2) / row.current)
    const thrown = -(pos.get() + (fresh ? (d.speed * 1000 * FLICK) / row.current : 0))
    settle(moved ? Math.round(thrown) : tapped)
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault()
    if (drag.current) return
    // A snap still running would pull against the new input, so the wheel takes over.
    run.current?.stop()
    if (!moving.current) readRow()
    setMoving(true)
    clearTimeout(quiet.current)
    const rows = e.deltaMode === 1 ? e.deltaY : e.deltaMode === 2 ? e.deltaY * VISIBLE : e.deltaY / row.current
    pos.set(Math.min(0, Math.max(-(options.length - 1), pos.get() - rows)))
    quiet.current = setTimeout(() => settle(Math.round(-pos.get())), WHEEL_SETTLE_MS)
  }
  const wheel = useRef(onWheel)
  wheel.current = onWheel

  // React's wheel listener is passive, and only a native one can keep the page still. It only
  // writes the motion value and a timer, so it stays cheap even though it cannot be passive.
  useEffect(() => {
    const node = box.current
    const listen = (e: WheelEvent): void => wheel.current(e)
    node?.addEventListener('wheel', listen, { passive: false })
    return () => node?.removeEventListener('wheel', listen)
  }, [])

  // Rows are built once per option list. A new index only moves the highlight, so a key press
  // does not rebuild sixty minute rows.
  const reel = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => options.map((option) => <span key={option}>{option}</span>), [options])
  useLayoutEffect(() => {
    const node = reel.current
    if (!node) return
    node.querySelector(':scope > [data-on]')?.removeAttribute('data-on')
    node.children[index]?.setAttribute('data-on', '')
  }, [index, rows])

  return (
    <div ref={box} role="spinbutton" tabIndex={0} aria-label={label} aria-valuenow={index} aria-valuemin={0} aria-valuemax={options.length - 1} aria-valuetext={options[index]} className={styles.wheel} onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <motion.div ref={reel} className={styles.reel} style={{ y: top }} aria-hidden="true">
        {rows}
      </motion.div>
    </div>
  )
})

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const PERIODS = ['AM', 'PM']

function toWheels(text: string, minuteStep: number): { hour: number; minute: number; period: number } {
  const [h24 = 9, m = 0] = text.split(':').map(Number)
  return { hour: (h24 % 12 || 12) - 1, minute: Math.round(m / minuteStep) % Math.ceil(60 / minuteStep), period: h24 >= 12 ? 1 : 0 }
}

/** Three wheels for a time. Set time waits until every wheel has settled. */
export function WheelPicker({ value, defaultValue = '08:41', onValueChange, onCancel, minuteStep = 1, title = 'Pickup time', submitText = 'Set time', animated = true, className }: WheelPickerProps) {
  const still = useStill(animated)
  const start = toWheels(value ?? defaultValue, minuteStep)
  const minutes = useMemo(() => Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => String(i * minuteStep).padStart(2, '0')), [minuteStep])
  const [hour, setHour] = useState(start.hour)
  const [minute, setMinute] = useState(start.minute)
  const [period, setPeriod] = useState(start.period)
  const [moving, setMoving] = useState([false, false, false])
  const [focused, setFocused] = useState(false)
  const busy = moving.some(Boolean)
  // Stable per wheel, and a no-op update returns the same array so React bails out.
  const marks = useMemo(() => [0, 1, 2].map((at) => (now: boolean): void => setMoving((all) => (all[at] === now ? all : all.map((one, i) => (i === at ? now : one))))), [])

  useEffect(() => {
    if (value === undefined) return
    const next = toWheels(value, minuteStep)
    setHour(next.hour)
    setMinute(next.minute)
    setPeriod(next.period)
  }, [value, minuteStep])

  const latest = useRef({ hour, minute, period, minutes, onValueChange })
  latest.current = { hour, minute, period, minutes, onValueChange }
  const submit = useCallback((): void => {
    const now = latest.current
    const h = ((now.hour + 1) % 12) + (now.period === 1 ? 12 : 0)
    now.onValueChange?.(`${String(h).padStart(2, '0')}:${now.minutes[now.minute] ?? '00'}`)
  }, [])
  // The buttons change only with busy, so turning a wheel does not render them.
  const actions = useMemo(() => (
    <div className={styles.actions}>
      {onCancel ? <Button variant="ghost" size="sm" animated={animated} onClick={onCancel}>Cancel</Button> : null}
      <Button size="sm" animated={animated} className={styles.submit} disabled={busy} onClick={submit}>{submitText}</Button>
    </div>
  ), [onCancel, animated, busy, submit, submitText])

  return (
    <div className={cx(styles.picker, className)} data-moving={busy && !still ? '' : undefined} role="group" aria-label={title} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
      <header className={styles.head}>
        <span>{title}</span>
        <span className={styles.reading} role="status">{busy ? 'Settling' : `${String(hour + 1).padStart(2, '0')}:${minutes[minute] ?? '00'} ${PERIODS[period] ?? 'AM'}`}</span>
      </header>
      <div className={styles.wheels} style={{ '--visible': VISIBLE } as CSSProperties}>
        <span className={styles.band} aria-hidden="true" />
        <Wheel label="Hour" options={HOURS} index={hour} onIndex={setHour} onMoving={marks[0]!} still={still} />
        <Wheel label="Minute" options={minutes} index={minute} onIndex={setMinute} onMoving={marks[1]!} still={still} />
        <Wheel label="AM or PM" options={PERIODS} index={period} onIndex={setPeriod} onMoving={marks[2]!} still={still} />
      </div>
      <p className={styles.hint}>{focused ? 'Arrow keys to change' : 'Scroll or drag a column'}</p>
      {actions}
    </div>
  )
}
