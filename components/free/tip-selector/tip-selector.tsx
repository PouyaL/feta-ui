'use client'
import { animate, motion, useMotionValue, type AnimationPlaybackControls } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { spring } from '../../motion-tokens'
import { Button } from '../button/button'
import { LabelSwap, RollingText, cx, useStill } from '../motion-kit/motion-kit'
import styles from './tip-selector.module.css'

export type TipSelectorProps = {
  /** The bill before the tip. */
  subtotal: number
  /** Who gets the tip. */
  name?: string
  /** A line under the name. */
  note?: string
  currency?: string
  /** Percents shown as chips. */
  presets?: number[]
  defaultPercent?: number
  onPercentChange?: (percent: number) => void
  /** Resolves once the order is paid. */
  onPlaceOrder?: (total: number) => Promise<void>
  /** Shown when onPlaceOrder rejects. The button returns to Place order. */
  failedMessage?: string
  animated?: boolean
  className?: string
}

const PX_PER_PERCENT = 16
const TOP = 30
const FLICK = 0.25
const RECOMMENDED = 18
const rubber = (d: number): number => (d * 0.35) / (1 + d / 120)
const money = (value: number): string => value.toFixed(2)
const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/** A tape measure for tipping. Drag it under a fixed needle, and it rubber bands past the ends. */
export function TipSelector({ subtotal, name = 'Sam', note, currency = '$', presets = [15, 18, 20], defaultPercent = 18, onPercentChange, onPlaceOrder, failedMessage = 'Payment failed. Try again.', animated = true, className }: TipSelectorProps) {
  const still = useStill(animated)
  const [percent, setPercent] = useState(defaultPercent)
  const [dragging, setDragging] = useState(false)
  /** The tip that makes a whole total, once Round up is on. */
  const [roundTip, setRoundTip] = useState<number | null>(null)
  const [status, setStatus] = useState<'idle' | 'placing' | 'paid'>('idle')
  const [failed, setFailed] = useState(false)
  const x = useMotionValue(-defaultPercent * PX_PER_PERCENT)
  const run = useRef<AnimationPlaybackControls | undefined>(undefined)
  const drag = useRef<{ startX: number; from: number; lastX: number; lastT: number; speed: number } | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; run.current?.stop() }
  }, [])

  const tip = roundTip ?? (subtotal * percent) / 100
  const total = subtotal + tip
  const shownPercent = roundTip === null ? String(percent) : ((roundTip / subtotal) * 100).toFixed(1)
  const plain = roundTip !== null ? `Rounds the total to ${currency}${Math.round(total)}` : percent === 0 ? 'No tip' : `${percent}% of ${currency}${money(subtotal)}`
  const line = failed ? failedMessage : plain
  const ticks = useMemo(() => Array.from({ length: TOP + 1 }, (_, i) => i), [])

  function roundUp(): void {
    const next = Math.ceil(total) - subtotal
    const exact = (next / subtotal) * 100
    setRoundTip(next)
    setPercent(clamp(Math.round(exact), 0, TOP))
    run.current?.stop()
    if (still) x.jump(-exact * PX_PER_PERCENT)
    else run.current = animate(x, -exact * PX_PER_PERCENT, spring.settle)
  }

  function choose(next: number): void {
    const value = clamp(Math.round(next), 0, TOP)
    setFailed(false)
    setRoundTip(null)
    setPercent(value)
    onPercentChange?.(value)
    run.current?.stop()
    if (still) x.jump(-value * PX_PER_PERCENT)
    else run.current = animate(x, -value * PX_PER_PERCENT, spring.settle)
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>): void {
    if (e.button !== 0 || status !== 'idle') return
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus()
    run.current?.stop()
    setDragging(true)
    drag.current = { startX: e.clientX, from: x.get(), lastX: e.clientX, lastT: e.timeStamp, speed: 0 }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>): void {
    const d = drag.current
    if (!d) return
    const gap = e.timeStamp - d.lastT
    if (gap > 0) d.speed = (e.clientX - d.lastX) / gap
    d.lastX = e.clientX
    d.lastT = e.timeStamp
    const raw = d.from + e.clientX - d.startX
    const low = -TOP * PX_PER_PERCENT
    const eased = raw > 0 ? rubber(raw) : raw < low ? low - rubber(low - raw) : raw
    x.set(eased)
    const near = clamp(Math.round(-eased / PX_PER_PERCENT), 0, TOP)
    if (near !== percent) { setRoundTip(null); setPercent(near); onPercentChange?.(near) }
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>): void {
    const d = drag.current
    if (!d) return
    drag.current = null
    setDragging(false)
    const fresh = e.timeStamp - d.lastT < 80
    choose(-(x.get() + (fresh ? d.speed * 1000 * FLICK * 0.1 : 0)) / PX_PER_PERCENT)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    const map: Record<string, number> = { ArrowRight: percent + 1, ArrowUp: percent + 1, ArrowLeft: percent - 1, ArrowDown: percent - 1, PageUp: percent + 5, PageDown: percent - 5, Home: 0, End: TOP }
    const next = map[e.key]
    if (next === undefined || status !== 'idle') return
    e.preventDefault()
    choose(next)
  }

  async function place(): Promise<void> {
    setStatus('placing')
    setFailed(false)
    try {
      await onPlaceOrder?.(total)
      if (alive.current) setStatus('paid')
    } catch {
      // A rejected payment returns to the order, with the reason in the reading.
      if (alive.current) { setStatus('idle'); setFailed(true) }
    }
  }

  return (
    <section className={cx(styles.tray, className)} aria-label="Add a tip" data-still={still ? '' : undefined}>
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.avatar} aria-hidden="true">{name.slice(0, 1)}</span>
          <span className={styles.who}><b>Tip {name}</b>{note ? <span>{note}</span> : null}</span>
        </div>
        <div className={styles.reading} aria-live="polite">
          <span className={styles.amount}>{currency}<RollingText value={money(tip)} still={still} /></span>
          <span className={styles.line} data-failed={failed ? '' : undefined}>{line}</span>
        </div>
        <div
          role="slider"
          tabIndex={status === 'idle' ? 0 : -1}
          aria-label="Tip percent"
          aria-valuemin={0}
          aria-valuemax={TOP}
          aria-valuenow={percent}
          aria-valuetext={`${percent} percent, ${currency}${money(tip)}`}
          className={styles.window}
          data-dragging={dragging ? '' : undefined}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <motion.div className={styles.tape} style={{ x }} aria-hidden="true">
            {ticks.map((i) => <span key={i} className={styles.tick} style={{ left: i * PX_PER_PERCENT }} data-major={i % 5 === 0 || i === RECOMMENDED ? '' : undefined}>{i % 5 === 0 || i === RECOMMENDED ? <b>{i}%</b> : null}</span>)}
          </motion.div>
          <span className={styles.needle} aria-hidden="true" />
        </div>
        <div className={styles.chips}>
          {presets.map((preset) => <button key={preset} type="button" aria-pressed={roundTip === null && percent === preset} className={styles.chip} disabled={status !== 'idle'} onClick={() => choose(preset)}>{preset}%</button>)}
          <button type="button" aria-pressed={roundTip !== null} className={styles.chip} disabled={status !== 'idle'} onClick={roundUp}>Round up</button>
        </div>
        <dl className={styles.rows}>
          <div><dt>Subtotal</dt><dd>{currency}{money(subtotal)}</dd></div>
          <div><dt>{tip > 0 ? `Tip · ${shownPercent}%` : 'Tip'}</dt><dd>{currency}{money(tip)}</dd></div>
          <div data-total=""><dt>Total</dt><dd>{currency}{money(total)}</dd></div>
        </dl>
      </div>
      <Button animated={animated} className={styles.place} disabled={status === 'paid'} status={status === 'placing' ? 'loading' : 'idle'} onClick={() => { void place() }}>
        <LabelSwap swapKey={status} still={still}>{status === 'paid' ? 'Paid, thank you' : status === 'placing' ? 'Placing order' : `Place order · ${currency}${money(total)}`}</LabelSwap>
      </Button>
    </section>
  )
}
