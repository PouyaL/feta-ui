'use client'
import { motion, useAnimationControls } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { UndoIcon } from '@fetaui/react/rounded/undo'
import { spring } from '../../motion-tokens'
import { Button } from '../button/button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './signature-pad.module.css'

const WIDE = 3.6
const THIN = 1.1
const WIDTH_EASE = 0.08
const SPEED_FOR_THIN = 2.4
const CLEAR_MS = 420
const FOLLOW = 0.55

type Point = { x: number; y: number; width: number }
type Stroke = Point[]

export type SignaturePadProps = {
  /** What is being signed, in the header. */
  title?: string
  /** Fires with a PNG data URL, or null when cleared. */
  onChange?: (signature: string | null) => void
  /** Fires when the signature is confirmed. */
  onConfirm?: (signature: string) => void
  /** Rings the pad and says why, when someone tries to continue. */
  required?: boolean
  disabled?: boolean
  animated?: boolean
  className?: string
}

/** A surface to sign on. Ink is smoothed and thins with speed; everything around it stays still. */
export function SignaturePad({ title = 'Sign to accept', onChange, onConfirm, required, disabled, animated = true, className }: SignaturePadProps) {
  const still = useStill(animated)
  const canvas = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const live = useRef<Stroke | null>(null)
  const tip = useRef({ x: 0, y: 0, width: WIDE })
  const puck = useRef<HTMLSpanElement>(null)
  const shake = useAnimationControls()
  const [count, setCount] = useState(0)
  const [signing, setSigning] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [hover, setHover] = useState(false)
  const [signedAt, setSignedAt] = useState<Date | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [tried, setTried] = useState(false)
  const signed = count > 0
  const locked = confirmed || disabled

  /** Adds one stroke's segments from `from` on, without touching what is already drawn. */
  const drawSegments = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke, from: number) => {
    for (let i = Math.max(1, from); i < stroke.length; i++) {
      const start = stroke[i - 1]
      const to = stroke[i]
      if (!start || !to) continue
      ctx.lineWidth = to.width
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    }
  }, [])

  const paint = useCallback(() => {
    const node = canvas.current
    const ctx = node?.getContext('2d')
    if (!node || !ctx) return
    const scale = window.devicePixelRatio || 1
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.clearRect(0, 0, node.width, node.height)
    ctx.strokeStyle = getComputedStyle(node).color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const stroke of [...strokes.current, ...(live.current ? [live.current] : [])]) drawSegments(ctx, stroke, 1)
  }, [drawSegments])

  useEffect(() => {
    const node = canvas.current
    if (!node) return
    const fit = (): void => {
      const scale = window.devicePixelRatio || 1
      node.width = node.offsetWidth * scale
      node.height = node.offsetHeight * scale
      paint()
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(node)
    // Ink follows the theme: the strokes are data, so they repaint in the new colour.
    const theme = new MutationObserver(paint)
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => { observer.disconnect(); theme.disconnect() }
  }, [paint])

  function emit(): void {
    setCount(strokes.current.length)
    if (strokes.current.length) setSignedAt(new Date())
    onChange?.(strokes.current.length ? canvas.current?.toDataURL('image/png') ?? null : null)
  }

  function at(e: PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const box = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - box.left, y: e.clientY - box.top }
  }

  function placePuck({ x, y }: { x: number; y: number }): void {
    if (puck.current) puck.current.style.transform = `translate(${x}px, ${y}px)`
  }

  function start(e: PointerEvent<HTMLCanvasElement>): void {
    if (locked || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const point = at(e)
    tip.current = { ...point, width: WIDE }
    live.current = [{ ...point, width: WIDE }]
    setSigning(true)
    paint()
  }

  function move(e: PointerEvent<HTMLCanvasElement>): void {
    const stroke = live.current
    if (!stroke) {
      placePuck(at(e))
      setHover(true)
      return
    }
    const drawn = stroke.length
    for (const sample of e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]) {
      const box = e.currentTarget.getBoundingClientRect()
      const target = { x: sample.clientX - box.left, y: sample.clientY - box.top }
      const x = tip.current.x + (target.x - tip.current.x) * FOLLOW
      const y = tip.current.y + (target.y - tip.current.y) * FOLLOW
      const speed = Math.hypot(x - tip.current.x, y - tip.current.y)
      const goal = Math.max(THIN, WIDE - (speed / SPEED_FOR_THIN) * (WIDE - THIN) * 0.25)
      const width = tip.current.width + (goal - tip.current.width) * WIDTH_EASE
      tip.current = { x, y, width }
      stroke.push({ x, y, width })
    }
    const ctx = canvas.current?.getContext('2d')
    if (ctx) drawSegments(ctx, stroke, drawn)
  }

  function end(): void {
    if (!live.current) return
    if (live.current.length === 1) {
      const dot = live.current[0]
      if (dot) live.current.push({ ...dot, x: dot.x + 0.1 })
    }
    strokes.current.push(live.current)
    live.current = null
    placePuck(tip.current)
    setSigning(false)
    paint()
    emit()
  }

  function undo(): void {
    strokes.current.pop()
    paint()
    emit()
  }

  function clear(): void {
    if (still) { strokes.current = []; paint(); emit(); return }
    setClearing(true)
    setTimeout(() => { strokes.current = []; paint(); emit(); setClearing(false) }, CLEAR_MS)
  }

  function confirm(): void {
    if (!signed) {
      setTried(true)
      if (!still) void shake.start({ x: [0, 2, -2, 0] })
      return
    }
    setConfirmed(true)
    const data = canvas.current?.toDataURL('image/png')
    if (data) onConfirm?.(data)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (locked) return
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo() }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); clear() }
  }

  const missing = required && tried && !signed
  const time = signedAt ? signedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null

  return (
    <div className={cx(styles.tray, className)} data-still={still ? '' : undefined} data-disabled={disabled ? '' : undefined}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.time} role="status">{confirmed ? 'Confirmed' : signed ? `Signed ${time}` : ''}</span>
      </div>
      <motion.div
        animate={shake}
        transition={{ duration: 0.24 }}
        role="group"
        tabIndex={locked ? -1 : 0}
        aria-label="Signature canvas. Draw with a mouse, pen or finger."
        className={styles.card}
        data-required={missing ? '' : undefined}
        onKeyDown={onKeyDown}
      >
        <canvas
          ref={canvas}
          className={styles.canvas}
          data-clearing={clearing ? '' : undefined}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={() => setHover(false)}
        />
        <span className={styles.hint} data-gone={signed || signing ? '' : undefined}>Sign here</span>
        <span className={styles.baseline} aria-hidden="true"><span className={styles.cross}>×</span></span>
        <span ref={puck} className={styles.puck} aria-hidden="true" hidden={!hover || signing || Boolean(locked)} />
        {confirmed ? (
          <motion.span className={styles.stamp} initial={still ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.stamp}><Tick02Icon trigger="none" /> Signed</motion.span>
        ) : null}
      </motion.div>
      <div className={styles.footer}>
        {missing ? <span className={styles.error} role="alert">A signature is required</span> : null}
        {confirmed ? (
          <Button variant="ghost" size="sm" animated={animated} onClick={() => setConfirmed(false)}>Edit</Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" animated={animated} disabled={!signed || Boolean(disabled)} leadingIcon={<UndoIcon />} onClick={undo}>Undo</Button>
            <Button variant="secondary" size="sm" animated={animated} disabled={!signed || Boolean(disabled)} onClick={clear}>Clear</Button>
            <Button size="sm" animated={animated} disabled={Boolean(disabled)} onClick={confirm}>Confirm</Button>
          </>
        )}
      </div>
    </div>
  )
}
