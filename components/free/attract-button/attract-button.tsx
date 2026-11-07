'use client'
import { motion, type HTMLMotionProps } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { MagnetIcon } from '@fetaui/react/rounded/magnet'
import { spring } from '../../motion-tokens'
import { cx, kit, pressProps, useStill } from '../motion-kit/motion-kit'
import styles from './attract-button.module.css'

const STEP = 12
const LENGTH = 6
const THICK = 1.5
const FADE = 64
const NEAR = 84
const PULL = 7
const REST_ALPHA = 0.07
const NEAR_ALPHA = 0.5

type Filing = { x: number; y: number; rest: number; angle: number; velocity: number; alpha: number; pull: number }
type Pointer = { x: number; y: number; down: boolean } | null

export type AttractButtonProps = Omit<HTMLMotionProps<'button'>, 'children' | 'ref'> & {
  children?: ReactNode
  /** `false` keeps the filings static. */
  animated?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** Field lines of a bar magnet along the button: the angle a filing rests at. */
function restAngle(x: number, y: number, width: number, height: number): number {
  const north = { x: width / 2 - 60, y: height / 2 }
  const south = { x: width / 2 + 60, y: height / 2 }
  const part = (from: { x: number; y: number }, sign: number): [number, number] => {
    const dx = x - from.x
    const dy = y - from.y
    const cube = Math.max(1, (dx * dx + dy * dy) ** 1.5)
    return [(sign * dx) / cube, (sign * dy) / cube]
  }
  const [ax, ay] = part(north, 1)
  const [bx, by] = part(south, -1)
  return Math.atan2(ay + by, ax + bx)
}

/** Distance from the button's edge, which sets how far the field fades out. */
function edgeDistance(x: number, y: number, width: number, height: number, button: { w: number; h: number }): number {
  const dx = Math.max(Math.abs(x - width / 2) - button.w / 2, 0)
  const dy = Math.max(Math.abs(y - height / 2) - button.h / 2, 0)
  return Math.hypot(dx, dy)
}

/** A button in a field of iron filings. Near the pointer they turn to it; a press pulls them in. */
export function AttractButton({ children = 'Attract', animated = true, className, disabled, type = 'button', ref, ...rest }: AttractButtonProps) {
  const still = useStill(animated)
  const field = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const pointer = useRef<Pointer>(null)
  const wake = useRef<() => void>(() => undefined)
  const [down, setDown] = useState(false)

  useEffect(() => {
    const node = canvas.current
    const box = field.current
    const paint = node?.getContext('2d')
    if (!node || !box || !paint) return
    let filings: Filing[] = []
    let frame = 0
    let last = 0
    let width = 0
    let height = 0

    function layout(): void {
      if (!node || !box || !paint) return
      width = box.offsetWidth
      height = box.offsetHeight
      const ratio = devicePixelRatio || 1
      node.width = width * ratio
      node.height = height * ratio
      paint.setTransform(ratio, 0, 0, ratio, 0, 0)
      const button = box.querySelector('button')
      const size = { w: button?.offsetWidth ?? 144, h: button?.offsetHeight ?? 40 }
      filings = []
      for (let y = STEP / 2; y < height; y += STEP) {
        for (let x = STEP / 2; x < width; x += STEP) {
          const distance = edgeDistance(x, y, width, height, size)
          if (distance > FADE) continue
          const rest = restAngle(x, y, width, height)
          filings.push({ x, y, rest, angle: rest, velocity: 0, alpha: 1 - distance / FADE, pull: 0 })
        }
      }
    }

    function draw(): void {
      if (!node || !paint) return
      paint.clearRect(0, 0, width, height)
      paint.fillStyle = getComputedStyle(node).color
      const at = pointer.current
      for (const filing of filings) {
        const near = at ? Math.max(0, 1 - Math.hypot(at.x - filing.x, at.y - filing.y) / NEAR) : 0
        const ink = filing.alpha * (REST_ALPHA + near * NEAR_ALPHA) * 2
        const towardX = (width / 2 - filing.x) * filing.pull
        const towardY = (height / 2 - filing.y) * filing.pull
        paint.globalAlpha = Math.min(1, ink)
        paint.save()
        paint.translate(filing.x + towardX, filing.y + towardY)
        paint.rotate(filing.angle)
        paint.fillRect(-LENGTH / 2, -THICK / 2, LENGTH, THICK)
        paint.restore()
      }
      paint.globalAlpha = 1
    }

    function tick(now: number): void {
      const dt = Math.min(0.032, (now - last) / 1000 || 0.016)
      last = now
      const at = pointer.current
      let moving = false
      for (const filing of filings) {
        const distance = at ? Math.hypot(at.x - filing.x, at.y - filing.y) : Infinity
        const near = Math.max(0, 1 - distance / NEAR)
        const toPointer = at ? Math.atan2(at.y - filing.y, at.x - filing.x) : filing.rest
        const blend = near > 0 ? toPointer : filing.rest
        const delta = Math.atan2(Math.sin(blend - filing.angle), Math.cos(blend - filing.angle))
        filing.velocity += (spring.filing.stiffness * delta - spring.filing.damping * filing.velocity) * dt
        filing.angle += filing.velocity * dt
        const pullTarget = at?.down ? (PULL / Math.max(24, Math.hypot(width / 2 - filing.x, height / 2 - filing.y))) : 0
        filing.pull += (pullTarget - filing.pull) * Math.min(1, dt * 14)
        if (Math.abs(delta) > 0.002 || Math.abs(filing.velocity) > 0.01 || Math.abs(filing.pull - pullTarget) > 0.001) moving = true
      }
      draw()
      frame = moving ? requestAnimationFrame(tick) : 0
    }

    wake.current = () => {
      if (frame || still) return
      last = performance.now()
      frame = requestAnimationFrame(tick)
    }

    layout()
    draw()
    const resize = new ResizeObserver(() => { layout(); draw() })
    resize.observe(box)
    const theme = new MutationObserver(draw)
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => { cancelAnimationFrame(frame); resize.disconnect(); theme.disconnect() }
  }, [still])

  // A disabled button lets the filings settle back to rest.
  useEffect(() => {
    if (!disabled) return
    pointer.current = null
    setDown(false)
    wake.current()
  }, [disabled])

  function track(x: number, y: number, pressed: boolean): void {
    const box = field.current?.getBoundingClientRect()
    if (!box || still || disabled) return
    pointer.current = { x: x - box.left, y: y - box.top, down: pressed }
    wake.current()
  }

  return (
    <div
      ref={field}
      className={cx(styles.field, className)}
      onPointerMove={(e) => track(e.clientX, e.clientY, down)}
      onPointerLeave={() => { pointer.current = null; setDown(false); wake.current() }}
      onPointerDown={(e) => { if (disabled) return; setDown(true); track(e.clientX, e.clientY, true) }}
      onPointerUp={(e) => { setDown(false); track(e.clientX, e.clientY, false) }}
    >
      <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
      <motion.button ref={ref} type={type} disabled={disabled} className={cx(kit.control, kit.inverse, styles.button)} {...pressProps(still, disabled)} {...rest}>
        <span className={cx(kit.icon, styles.magnet)}><MagnetIcon /></span>
        {children}
      </motion.button>
    </div>
  )
}
