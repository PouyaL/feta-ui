'use client'
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from 'motion/react'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { RotateCcwIcon } from '@fetaui/react/rounded/rotate-ccw'
import { SparklesIcon } from '@fetaui/react/rounded/sparkles'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { Button } from '../button/button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './photo-straighten.module.css'

const PX_PER_DEGREE = 9
const LIMIT = 15
const SNAP_DEGREES = 0.6
const SETTLE_SPRING = { type: 'spring', duration: 0.45, bounce: 0.1 } as const
const THROW_MS = 120
const KEY_STEP = 0.1
const AUTO_MS = 700
const LABELS = [-15, 0, 15]

const clampAngle = (value: number): number => Math.min(LIMIT, Math.max(-LIMIT, value))
const display = (angle: number): string => `${angle < 0 ? '−' : ''}${Math.abs(angle).toFixed(1)}°`
const round = (value: number): number => Math.round(value * 10) / 10

export type PhotoStraightenProps = {
  src: string
  alt: string
  /** The photo's tilt in degrees. The correction starts at 0. */
  tilt?: number
  defaultAngle?: number
  /** Works out the correction. Without it, Auto uses the opposite of `tilt`. */
  autoLevel?: () => Promise<number>
  onChange?: (angle: number) => void
  animated?: boolean
  className?: string
}

/** Levels a tilted horizon. The ruler throws, settles on a spring and snaps to level. */
export function PhotoStraighten({ src, alt, tilt = 0, defaultAngle = 0, autoLevel, onChange, animated = true, className }: PhotoStraightenProps) {
  const still = useStill(animated)
  const angle = useMotionValue(defaultAngle)
  const rotate = useTransform(angle, (value) => value + tilt)
  const x = useTransform(angle, (value) => -value * PX_PER_DEGREE)
  const label = useRef<HTMLSpanElement>(null)
  const drag = useRef<{ x: number; from: number; last: number; at: number; speed: number } | null>(null)
  const motionRef = useRef<ReturnType<typeof animate> | null>(null)
  const [active, setActive] = useState(false)
  const [auto, setAuto] = useState(false)
  const [failed, setFailed] = useState(false)
  const [settled, setSettled] = useState(defaultAngle)
  const level = Math.abs(settled + tilt) < SNAP_DEGREES / 2 && tilt !== 0

  useMotionValueEvent(angle, 'change', (value) => { if (label.current) label.current.textContent = display(value) })
  useEffect(() => () => motionRef.current?.stop(), [])

  function settle(target: number): void {
    const end = round(Math.abs(target + tilt) <= SNAP_DEGREES ? -tilt : Math.abs(target) <= SNAP_DEGREES ? 0 : clampAngle(target))
    setSettled(end)
    onChange?.(end)
    motionRef.current?.stop()
    if (still) { angle.set(end); return }
    motionRef.current = animate(angle, end, SETTLE_SPRING)
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>): void {
    e.currentTarget.setPointerCapture(e.pointerId)
    motionRef.current?.stop()
    setActive(true)
    drag.current = { x: e.clientX, from: angle.get(), last: e.clientX, at: e.timeStamp, speed: 0 }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>): void {
    const held = drag.current
    if (!held) return
    held.speed = (e.clientX - held.last) / Math.max(1, e.timeStamp - held.at)
    held.last = e.clientX
    held.at = e.timeStamp
    angle.set(clampAngle(held.from - (e.clientX - held.x) / PX_PER_DEGREE))
  }

  function onPointerUp(): void {
    const held = drag.current
    drag.current = null
    setActive(false)
    if (!held) return
    settle(still ? angle.get() : angle.get() - (held.speed * THROW_MS) / PX_PER_DEGREE)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    const by = { ArrowRight: KEY_STEP, ArrowUp: KEY_STEP, ArrowLeft: -KEY_STEP, ArrowDown: -KEY_STEP, PageUp: 1, PageDown: -1 }[e.key]
    if (by !== undefined) {
      e.preventDefault()
      const next = clampAngle(round(angle.get() + by))
      angle.set(next)
      setSettled(next)
      onChange?.(next)
    }
    if (e.key === 'Home') { e.preventDefault(); settle(0) }
  }

  async function runAuto(): Promise<void> {
    setAuto(true)
    setFailed(false)
    try {
      const target = autoLevel ? await autoLevel() : await new Promise<number>((done) => setTimeout(() => done(-tilt), AUTO_MS))
      settle(target)
    } catch {
      setFailed(true)
    } finally {
      setAuto(false)
    }
  }

  return (
    <div className={cx(styles.tray, className)} data-still={still ? '' : undefined} data-active={active ? '' : undefined} data-level={level ? '' : undefined}>
      <div className={styles.body}>
        <div className={styles.photo}>
          <motion.img src={src} alt={alt} className={styles.image} draggable={false} style={{ rotate }} />
          <span aria-hidden="true" className={styles.grid} />
          <span className={styles.chip} role="status">{auto ? <SparklesIcon /> : level ? <Tick02Icon /> : null}{auto ? 'Auto leveling' : failed ? 'Auto failed' : level ? 'Level' : tilt !== 0 ? 'Crooked' : ''}</span>
        </div>
      </div>
      <div className={styles.controls}>
        <div className={styles.row}>
          <Button variant="ghost" shape="pill" size="sm" animated={animated} status={auto ? 'loading' : 'idle'} leadingIcon={<SparklesIcon />} onClick={() => void runAuto()}>Auto</Button>
          <span ref={label} className={styles.angle}>{display(defaultAngle)}</span>
          <Button variant="ghost" shape="pill" size="sm" animated={animated} disabled={settled === 0} leadingIcon={<RotateCcwIcon />} onClick={() => settle(0)}>Reset</Button>
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Straighten"
          aria-valuemin={-LIMIT}
          aria-valuemax={LIMIT}
          aria-valuenow={settled}
          aria-valuetext={`${settled} degrees`}
          className={styles.ruler}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          <motion.span aria-hidden="true" className={styles.scale} style={{ x }}>
            {LABELS.map((value) => <span key={value} className={styles.tickLabel} style={{ left: value * PX_PER_DEGREE }}>{value}</span>)}
          </motion.span>
          <span aria-hidden="true" className={styles.centre} />
        </div>
      </div>
    </div>
  )
}
