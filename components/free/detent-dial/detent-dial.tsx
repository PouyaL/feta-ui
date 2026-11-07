'use client'
import { animate, motion, useMotionTemplate, useMotionValue, useMotionValueEvent, type AnimationPlaybackControls } from 'motion/react'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { MinusIcon } from '@fetaui/react/rounded/minus'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { IconButton } from '../icon-button/icon-button'
import { cx, RollingText, useStill } from '../motion-kit/motion-kit'
import styles from './detent-dial.module.css'

const SWEEP = 270
const SIZE = 240
const DEAD_ZONE = 14
const PULL = 0.65
const OVERSHOOT = 10
const REPEAT_MS = 120
const COAST = 0.32
/** Only the last 80 ms of movement counts as a flick. */
const FLICK_WINDOW_MS = 80
const SETTLE = { type: 'spring', duration: 0.35, bounce: 0.2 } as const
const BIG_STEP = 2

export type DetentDialProps = {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  unit?: string
  disabled?: boolean
  animated?: boolean
  className?: string
}

/** A rotary control that clicks into steps. It follows the finger, coasts on a flick and settles. */
export function DetentDial({ value, defaultValue = 21, onValueChange, min = 16, max = 30, step = 0.5, label = 'Temperature', unit = '°C', disabled = false, animated = true, className }: DetentDialProps) {
  const still = useStill(animated)
  const dial = useRef<HTMLDivElement>(null)
  const ticks = useRef<SVGGElement>(null)
  const last = useRef({ angle: 0, at: 0, speed: 0 })
  const run = useRef<AnimationPlaybackControls | null>(null)
  const repeat = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const [held, setHeld] = useState(defaultValue)
  const [turning, setTurning] = useState(false)
  const current = value ?? held
  const aim = useRef(current)
  const span = max - min
  const count = Math.round(span / step) + 1
  const toAngle = (v: number): number => ((v - min) / span) * SWEEP - SWEEP / 2
  const fromAngle = (a: number): number => min + ((a + SWEEP / 2) / SWEEP) * span
  const snap = (v: number): number => Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step))
  const angle = useMotionValue(toAngle(current))
  const rotate = useMotionTemplate`rotate(${angle}deg)`
  const atLimit = current === min || current === max

  function paintTicks(at: number): void {
    const lines = ticks.current?.children
    if (!lines) return
    for (let i = 0; i < lines.length; i++) {
      const tickAngle = (i / (count - 1)) * SWEEP - SWEEP / 2
      const distance = (tickAngle - at) / 16
      const major = i % 4 === 0 ? 2 : 0
      const length = 6 + major + 7 * Math.exp(-distance * distance)
      const line = lines.item(i)
      line?.setAttribute('y2', String(16 + length))
      line?.toggleAttribute('data-on', tickAngle <= at + 0.01)
    }
  }

  useMotionValueEvent(angle, 'change', paintTicks)
  useEffect(() => { paintTicks(angle.get()) })
  useEffect(() => () => { clearInterval(repeat.current); run.current?.stop() }, [])

  // A value the dial did not set itself moves the pointer too.
  useEffect(() => {
    if (value === undefined || value === aim.current || turning) return
    aim.current = value
    run.current?.stop()
    if (still) angle.set(toAngle(value))
    else run.current = animate(angle, toAngle(value), SETTLE)
    // Only when the value changes: the end of a turn settles by itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function commit(next: number): void {
    aim.current = next
    setHeld(next)
    onValueChange?.(next)
  }

  function settle(next: number, velocity = 0): void {
    run.current?.stop()
    commit(next)
    if (still) { angle.set(toAngle(next)); return }
    run.current = animate(angle, toAngle(next), { ...SETTLE, velocity })
  }

  function pointerAngle(e: PointerEvent<HTMLDivElement>): number | null {
    const box = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - box.left - box.width / 2
    const y = e.clientY - box.top - box.height / 2
    if (Math.hypot(x, y) < DEAD_ZONE) return null
    return (Math.atan2(x, -y) * 180) / Math.PI
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>): void {
    if (disabled || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    run.current?.stop()
    setTurning(true)
    last.current = { angle: angle.get(), at: e.timeStamp, speed: 0 }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>): void {
    if (!turning) return
    const raw = pointerAngle(e)
    if (raw === null) return
    const limit = SWEEP / 2
    // Past either end, resistance grows up to the overshoot.
    const beyond = Math.abs(raw) > limit ? limit + Math.min(OVERSHOOT, (Math.abs(raw) - limit) / 3) : Math.abs(raw)
    // Across the gap the sign of raw flips, so the side comes from where the dial already is.
    const side = Math.abs(raw) > limit ? (last.current.angle < 0 ? -1 : 1) : Math.sign(raw)
    const free = side * beyond
    const target = Math.abs(raw) > limit ? (still ? side * limit : free) : free
    const clamped = Math.max(-limit, Math.min(limit, target))
    const nearest = toAngle(snap(fromAngle(clamped)))
    const pulled = Math.abs(raw) > limit ? target : target + (nearest - target) * PULL
    const dt = Math.max(1, e.timeStamp - last.current.at)
    last.current = { angle: pulled, at: e.timeStamp, speed: ((pulled - last.current.angle) / dt) * 1000 }
    angle.set(pulled)
    const next = snap(fromAngle(clamped))
    if (next !== current) commit(next)
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>): void {
    if (!turning) return
    setTurning(false)
    const speed = still || e.timeStamp - last.current.at > FLICK_WINDOW_MS ? 0 : last.current.speed
    const coast = speed * COAST * 0.2
    settle(snap(fromAngle(Math.max(-SWEEP / 2, Math.min(SWEEP / 2, angle.get() + coast)))), speed)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (disabled) return
    const next: Record<string, number> = { ArrowUp: current + step, ArrowRight: current + step, ArrowDown: current - step, ArrowLeft: current - step, PageUp: current + BIG_STEP, PageDown: current - BIG_STEP, Home: min, End: max }
    const target = next[e.key]
    if (target === undefined) return
    e.preventDefault()
    settle(snap(target))
  }

  function hold(direction: number): void {
    let at = current
    const move = (): void => { at = snap(at + direction * step); settle(at) }
    move()
    clearInterval(repeat.current)
    repeat.current = setInterval(move, REPEAT_MS)
  }

  const release = (): void => clearInterval(repeat.current)
  const center = SIZE / 2

  return (
    <div className={cx(styles.tray, className)} data-disabled={disabled ? '' : undefined} data-still={still ? '' : undefined}>
      <div className={styles.card}>
        <div
          ref={dial}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={current}
          aria-valuetext={`${current} ${unit}`}
          aria-disabled={disabled || undefined}
          className={styles.dial}
          data-limit={atLimit ? '' : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          <svg className={styles.ticks} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            <g ref={ticks}>
              {Array.from({ length: count }, (_, i) => {
                const a = (i / (count - 1)) * SWEEP - SWEEP / 2
                return <line key={i} x1={center} x2={center} y1={16} y2={22} transform={`rotate(${a} ${center} ${center})`} />
              })}
            </g>
          </svg>
          <span className={styles.knob} aria-hidden="true">
            <motion.span className={styles.pointer} style={{ transform: rotate }}><span className={styles.indicator} /></motion.span>
            <span className={styles.readout} data-turning={turning ? '' : undefined}>
              <span className={styles.value}><RollingText value={current.toFixed(1)} still={still} /></span>
              <span className={styles.label}>{label}</span>
              <span className={styles.range}>{min} to {max}{unit}</span>
            </span>
          </span>
        </div>
      </div>
      <div className={styles.footer}>
        <span onPointerUp={release} onPointerLeave={release}>
          <IconButton variant="secondary" size="md" animated={animated} label={`Lower ${label}`} disabled={disabled || current === min} icon={<MinusIcon />} onPointerDown={() => hold(-1)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); settle(snap(current - step)) } }} />
        </span>
        <span className={styles.now}>{disabled ? 'Locked' : `Now ${current.toFixed(1)}${unit}`}</span>
        <span onPointerUp={release} onPointerLeave={release}>
          <IconButton variant="secondary" size="md" animated={animated} label={`Raise ${label}`} disabled={disabled || current === max} icon={<PlusIcon />} onPointerDown={() => hold(1)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); settle(snap(current + step)) } }} />
        </span>
      </div>
    </div>
  )
}
