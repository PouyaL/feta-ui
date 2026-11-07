'use client'
import { animate, AnimatePresence, motion, useMotionTemplate, useMotionValue, useTransform, type AnimationPlaybackControls, type MotionValue } from 'motion/react'
import { Fragment, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { ease, spring } from '../../motion-tokens'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './slider.module.css'

const TIP_HIDE_MS = 300
const TICK_EVERY = 7

export type SliderProps = {
  /** One number, or two for a range. Every style takes both. */
  value?: number | [number, number]
  defaultValue?: number | [number, number]
  onValueChange?: (value: number | [number, number]) => void
  min?: number
  max?: number
  step?: number
  /** `line` for forms, `bold` for one headline value, `field` for dense inspectors. Default `line`. */
  styleKind?: 'line' | 'bold' | 'field'
  /** The accessible name. `field` also shows it inside the row. */
  label: string
  /** Formats the value in the tip and for screen readers. */
  format?: (value: number) => string
  /** `vertical` stands the slider up, `length` px tall. */
  orientation?: 'horizontal' | 'vertical'
  length?: number
  /** Keeps the value tip showing. */
  alwaysTip?: boolean
  /** Ticks along a `bold` slider. */
  ticks?: boolean
  disabled?: boolean
  animated?: boolean
  className?: string
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))
const decimals = (value: number): number => String(value).split('.')[1]?.length ?? 0

function Thumb({ at, index, values, min, max, step, label, format, disabled, tip, vertical, still, onStep, onEntry, onFocus, onBlur }: {
  at: MotionValue<number>
  index: number
  values: number[]
  min: number
  max: number
  step: number
  label: string
  format: (value: number) => string
  disabled: boolean
  tip: boolean
  vertical: boolean
  still: boolean
  onStep: (index: number, value: number) => void
  onEntry?: ((index: number) => void) | undefined
  onFocus: () => void
  onBlur: () => void
}) {
  const x = useMotionTemplate`${at}%`
  const value = values[index] ?? min
  const low = index === 1 ? (values[0] ?? min) : min
  const high = index === 0 && values.length > 1 ? (values[1] ?? max) : max

  function onKeyDown(e: KeyboardEvent<HTMLSpanElement>): void {
    if (disabled) return
    if (e.key === 'Enter' && onEntry) {
      e.preventDefault()
      onEntry(index)
      return
    }
    const page = step * 10
    const next: Record<string, number> = { ArrowRight: value + step, ArrowUp: value + step, ArrowLeft: value - step, ArrowDown: value - step, PageUp: value + page, PageDown: value - page, Home: low, End: high }
    const target = next[e.key]
    if (target === undefined) return
    e.preventDefault()
    onStep(index, clamp(target, low, high))
  }

  return (
    <motion.span className={styles.rail} style={{ x }}>
      <span
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={values.length > 1 ? `${label} ${index === 0 ? 'minimum' : 'maximum'}` : label}
        aria-orientation={vertical ? 'vertical' : undefined}
        aria-valuemin={low}
        aria-valuemax={high}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        aria-disabled={disabled || undefined}
        data-index={index}
        className={styles.thumb}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <span className={styles.halo} aria-hidden="true" />
        <AnimatePresence>
          {tip ? (
            <motion.span
              className={styles.tip}
              aria-hidden="true"
              initial={still ? false : { y: 4, opacity: 0, scale: 0.9, x: '-50%' }}
              animate={{ y: 0, opacity: 1, scale: 1, x: '-50%' }}
              exit={{ opacity: 0, x: '-50%' }}
              transition={{ duration: still ? 0 : 0.16, ease: ease.out }}
            >
              {format(value)}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
    </motion.span>
  )
}

/** Pick a value or a range by dragging. Thumbs follow the pointer one to one and spring only when they jump. */
export function Slider({ value, defaultValue, onValueChange, min = 0, max = 100, step = 1, styleKind = 'line', label, format = String, orientation = 'horizontal', length = 160, alwaysTip = false, ticks, disabled = false, animated = true, className }: SliderProps) {
  const still = useStill(animated)
  const track = useRef<HTMLDivElement>(null)
  const range = Array.isArray(value ?? defaultValue)
  const start = value ?? defaultValue ?? min
  const initial = Array.isArray(start) ? start : [start]
  const [held, setHeld] = useState<number[]>(initial)
  const current = value === undefined ? held : Array.isArray(value) ? value : [value]
  const percent = (v: number): number => ((v - min) / (max - min)) * 100
  const first = useMotionValue(percent(current[0] ?? min))
  const second = useMotionValue(percent(current[1] ?? max))
  const [active, setActive] = useState<number | null>(null)
  const [tipFor, setTipFor] = useState<number | null>(null)
  const [focused, setFocused] = useState(false)
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const positions = [first, second]
  const jumps = useRef<(AnimationPlaybackControls | undefined)[]>([])
  /** Where inside the thumb it was grabbed, so a drag follows the pointer without hopping. */
  const grab = useRef(0)
  const pad = useRef(0)
  /** The newest value waiting for the next frame, so a fast pointer commits once per frame. */
  const pending = useRef<number[] | null>(null)
  const frame = useRef(0)
  /** The value being typed in a Field, by thumb. */
  const [entry, setEntry] = useState<{ index: number; text: string } | null>(null)
  const entryDone = useRef(false)
  const fillStart = useTransform(first, (v) => (range ? v / 100 : 0))
  const fillEnd = useTransform(() => 1 - (range ? second.get() : first.get()) / 100)
  // `--pad` keeps Bold's knob inside the fill: both ends of the range sit one cap radius in.
  const fillClip = useMotionTemplate`inset(0 calc((100% - 2 * var(--pad)) * ${fillEnd}) 0 calc((100% - 2 * var(--pad)) * ${fillStart}) round var(--fill-round))`

  useEffect(() => () => { clearTimeout(hide.current); cancelAnimationFrame(frame.current) }, [])

  useEffect(() => {
    if (value === undefined || active !== null) return
    const list = Array.isArray(value) ? value : [value]
    list.forEach((v, i) => positions[i]?.set(percent(v)))
  })

  function commit(next: number[]): void {
    setHeld(next)
    onValueChange?.(range ? [next[0] ?? min, next[1] ?? max] : (next[0] ?? min))
  }

  function snap(raw: number): number {
    const places = Math.max(decimals(step), decimals(min))
    return clamp(Number((min + Math.round((raw - min) / step) * step).toFixed(places)), min, max)
  }

  function fromPointer(e: PointerEvent<HTMLDivElement>): number {
    const box = (track.current ?? e.currentTarget).getBoundingClientRect()
    if (orientation === 'vertical') return min + ((box.bottom - e.clientY - pad.current) / (box.height - pad.current * 2)) * (max - min)
    return min + ((e.clientX - box.left - pad.current) / (box.width - pad.current * 2)) * (max - min)
  }

  function flush(): void {
    frame.current = 0
    if (pending.current) commit(pending.current)
    pending.current = null
  }

  function setAt(index: number, next: number, jump: boolean): void {
    const list = [...(pending.current ?? current)]
    if (list[index] !== next) {
      list[index] = next
      pending.current = list
      if (jump) flush()
      else frame.current ||= requestAnimationFrame(flush)
    }
    const at = positions[index]
    if (!at) return
    // A jump still springing would fight the pointer, so a drag ends it and takes over at once.
    jumps.current[index]?.stop()
    if (jump && !still) jumps.current[index] = animate(at, percent(next), spring.jump)
    else at.jump(percent(next))
  }

  function openEntry(index: number): void {
    if (disabled) return
    entryDone.current = false
    setEntry({ index, text: String(current[index] ?? min) })
  }

  /** Saves a typed number, snapped and kept between its neighbours. A typo keeps the old value. */
  function closeEntry(save: boolean, refocus: boolean): void {
    if (!entry || entryDone.current) return
    entryDone.current = true
    const { index, text } = entry
    const typed = Number.parseFloat(text.replace(/[^\d.-]/g, ''))
    if (save && Number.isFinite(typed)) {
      const low = index === 1 ? (current[0] ?? min) : min
      const high = index === 0 && range ? (current[1] ?? max) : max
      setAt(index, clamp(snap(typed), low, high), true)
    }
    if (refocus) track.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus()
    setEntry(null)
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>): void {
    if (disabled || e.button !== 0) return
    pad.current = Number.parseFloat(getComputedStyle(track.current ?? e.currentTarget).getPropertyValue('--pad')) || 0
    const raw = fromPointer(e)
    const [low0 = min, high0 = max] = current
    // Thumbs on the same value: take the one that can still move toward the pointer.
    const index = !range ? 0 : low0 === high0 ? (low0 <= min || (low0 < max && raw > low0) ? 1 : 0) : Math.abs(raw - high0) < Math.abs(raw - low0) ? 1 : 0
    const onThumb = (e.target as Element).closest('[role="slider"]')
    grab.current = onThumb ? raw - (current[index] ?? min) : 0
    clearTimeout(hide.current)
    setActive(index)
    setTipFor(index)
    e.currentTarget.setPointerCapture(e.pointerId)
    const low = index === 1 ? (current[0] ?? min) : min
    const high = index === 0 && range ? (current[1] ?? max) : max
    if (!onThumb) setAt(index, clamp(snap(raw), low, high), true)
    ;(e.currentTarget.querySelector(`[data-index="${index}"]`) as HTMLElement | null)?.focus()
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>): void {
    if (active === null) return
    const low = active === 1 ? (current[0] ?? min) : min
    const high = active === 0 && range ? (current[1] ?? max) : max
    setAt(active, clamp(snap(fromPointer(e) - grab.current), low, high), false)
  }

  function onPointerUp(): void {
    cancelAnimationFrame(frame.current)
    flush()
    setActive(null)
    hide.current = setTimeout(() => setTipFor(null), TIP_HIDE_MS)
  }

  const body = (
    <div
      className={cx(styles.slider, orientation === 'horizontal' ? className : undefined)}
      data-style={styleKind}
      data-orientation={orientation}
      data-range={range ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-active={active !== null ? '' : undefined}
      data-focused={focused ? '' : undefined}
      data-still={still ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {styleKind === 'field' ? (
        <span className={styles.fieldText}>
          <span aria-hidden="true">{label}</span>
          <span className={styles.fieldValue}>
            {current.map((v, i) => (
              <Fragment key={i}>
                {i > 0 ? <span aria-hidden="true"> to </span> : null}
                {entry?.index === i ? (
                  <input
                    autoFocus
                    className={styles.fieldEntry}
                    style={{ width: `${Math.max(3, entry.text.length + 1)}ch` }}
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={range ? `${label} ${i === 0 ? 'minimum' : 'maximum'}` : label}
                    value={entry.text}
                    onChange={(e) => setEntry({ index: i, text: e.target.value })}
                    onFocus={(e) => e.target.select()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onBlur={() => closeEntry(true, false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); closeEntry(true, true) }
                      else if (e.key === 'Escape') { e.preventDefault(); closeEntry(false, true) }
                    }}
                  />
                ) : (
                  <span aria-hidden="true" className={styles.fieldNumber} onPointerDown={(e) => e.stopPropagation()} onClick={() => openEntry(i)}>{format(v)}</span>
                )}
              </Fragment>
            ))}
          </span>
        </span>
      ) : null}
      <div ref={track} className={styles.track}>
        {ticks && styleKind === 'bold' ? <span className={styles.ticks} style={{ backgroundSize: `${TICK_EVERY}px 100%` }} aria-hidden="true" /> : null}
        <motion.span className={styles.fill} style={{ clipPath: fillClip }} aria-hidden="true" />
        {current.map((_, i) => (
          <Thumb
            key={i}
            at={i === 0 ? first : second}
            index={i}
            values={current}
            min={min}
            max={max}
            step={step}
            label={label}
            format={format}
            disabled={disabled}
            tip={styleKind !== 'field' && orientation === 'horizontal' && (alwaysTip || (tipFor === i && !still))}
            vertical={orientation === 'vertical'}
            still={still}
            onStep={(index, next) => setAt(index, snap(next), true)}
            onEntry={styleKind === 'field' ? openEntry : undefined}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        ))}
      </div>
    </div>
  )
  if (orientation === 'horizontal') return body
  return <span className={cx(styles.upright, className)} style={{ '--length': `${length}px` } as CSSProperties}>{body}</span>
}
