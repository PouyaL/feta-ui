'use client'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { animate, AnimatePresence, motion, useMotionValue, type AnimationPlaybackControls } from 'motion/react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { spring } from '../../motion-tokens'
import { cx, RollingText, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import styles from './liquid-slider.module.css'

export type LiquidSliderProps = {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** The accessible name and the card's title. */
  label?: string
  unit?: string
  /** Below this share of the range, the card says so. Default .2. */
  lowAt?: number
  lowText?: string
  fullText?: string
  /**
   * The water's color, any CSS color. Default: ink, the look with no color. It is written to
   * `--feta-slider-accent`, and the water draws it at up to 60%, like the chart palettes.
   */
  color?: string
  disabled?: boolean
  animated?: boolean
  className?: string
}

/** The glass on Web. Mobile measures 112 by 202, and the geometry follows the measured box. */
const WEB = { w: 120, h: 212 }
/** Space under the water: the base ellipse and slab. */
const BASE = 27
/** The water's surface at the top of the range sits 16 below the glass top, under the rim. */
const BRIM = 16
const COLUMNS = 34
const SPREAD = 2600
const TENSION = 30
const DAMPING = 2.4
const BULGE = 14
const STEP_S = 1 / 120
/** The Sloshing frame tilts the surface 7 degrees; the springs may reach a little further. */
const MAX_TILT = 10
/** Kick per px of sideways pointer travel while dragging, and the release slosh from pointer speed. */
const SWAY_KICK = 3
const RELEASE_SLOSH = 40
const KEY_SLOSH = 60
const MAX_SLOSH = 90
/** Bubbles at rest, as shares of the water's depth (Default frame): x, radius, height. */
const BUBBLES = [[42.5, 2.5, 0.527], [75.5, 1.5, 0.286], [59, 1, 0.141]] as const
/** Two more join while dragging (Dragging frame). */
const DRAG_BUBBLES = [[86.5, 2.5, 0.735], [41.5, 1.5, 0.138]] as const
/** Drops thrown by a slosh, above the surface (Sloshing frame): x, rx, ry, height. */
const DROPS = [[22.5, 2.5, 3.25, 30], [37.5, 1.5, 1.95, 45], [98, 2, 2.6, 26]] as const
const SCALE = [1, 0.75, 0.5, 0.25, 0]
const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))
const watchLoop = (node: SVGGElement | null): (() => void) | undefined => (node ? watchOffscreen(node as unknown as HTMLElement) : undefined)
const fmt = (n: number): string => n.toLocaleString('en-US')

/** A glass that fills as you drag. The surface is 34 small springs, and it rests when the energy is gone. */
export function LiquidSlider({ value, defaultValue = 1250, onValueChange, min = 0, max = 2000, step = 50, label = 'Water today', unit = 'ml', lowAt = 0.2, lowText = 'Drink up', fullText = 'Goal reached', color, disabled = false, animated = true, className }: LiquidSliderProps) {
  const still = useStill(animated)
  const id = useId().replace(/:/g, '')
  const box = useRef<SVGSVGElement>(null)
  const water = useRef<SVGPathElement>(null)
  const waterClip = useRef<SVGPathElement>(null)
  const surface = useRef<SVGGElement>(null)
  const bulge = useRef<SVGEllipseElement>(null)
  const drops = useRef<SVGGElement>(null)
  const bubbles = useRef<(SVGCircleElement | null)[]>([])
  const [size, setSize] = useState(WEB)
  const [held, setHeld] = useState(defaultValue)
  const [dragging, setDragging] = useState(false)
  const [splash, setSplash] = useState(0)
  const [start, setStart] = useState<number | null>(null)
  const current = clamp(value ?? held, min, max)
  const share = (current - min) / (max - min)
  const level = useMotionValue(share)
  const heights = useRef(new Float32Array(COLUMNS))
  const speeds = useRef(new Float32Array(COLUMNS))
  const pull = useRef<number | null>(null)
  const pointer = useRef({ x: 0, t: 0, vx: 0 })
  const raf = useRef(0)
  const last = useRef(0)
  const rise = useRef<AnimationPlaybackControls | undefined>(undefined)
  const { w: W, h: H } = size
  const bottom = H - BASE
  // The frame loop reads the size from here, so a loop started before a resize draws the new glass.
  const geometry = useRef(size)

  // Mobile draws a 112 by 202 glass. The box is measured once and on resize, never per frame.
  useLayoutEffect(() => {
    const node = box.current?.parentElement
    if (!node) return
    const measure = (): void => {
      const next = { w: Math.round(node.clientWidth), h: Math.round(node.clientHeight) }
      if (next.w > 0 && next.h > 0) setSize((was) => (was.w === next.w && was.h === next.h ? was : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const draw = useCallback(() => {
    const h = heights.current
    const { w: W, h: H } = geometry.current
    const bottom = H - BASE
    const top = bottom - level.get() * (bottom - BRIM)
    const span = W - 6
    let d = `M3 ${bottom}`
    let mean = 0
    let lean = 0
    let spread = 0
    for (let i = 0; i < COLUMNS; i++) {
      const y = h[i] ?? 0
      d += `L${(3 + (i / (COLUMNS - 1)) * span).toFixed(1)} ${(top + y).toFixed(1)}`
      mean += y
    }
    mean /= COLUMNS
    for (let i = 0; i < COLUMNS; i++) {
      const x = (i / (COLUMNS - 1) - 0.5) * span
      lean += x * ((h[i] ?? 0) - mean)
      spread += x * x
    }
    d += `L${W - 3} ${bottom}Z`
    water.current?.setAttribute('d', d)
    waterClip.current?.setAttribute('d', d)
    const tilt = clamp((Math.atan2(lean / spread, 1) * 180) / Math.PI, -MAX_TILT, MAX_TILT)
    const middle = top + mean
    surface.current?.setAttribute('transform', `translate(${W / 2} ${middle.toFixed(2)}) rotate(${tilt.toFixed(2)})`)
    drops.current?.setAttribute('transform', `translate(0 ${middle.toFixed(2)})`)
    const depth = bottom - middle
    bubbles.current.forEach((node, i) => {
      const at = BUBBLES[i]?.[2] ?? DRAG_BUBBLES[i - BUBBLES.length]?.[2] ?? 0
      node?.setAttribute('cy', (bottom - at * depth).toFixed(1))
    })
    const target = pull.current
    if (bulge.current && target !== null) {
      bulge.current.setAttribute('cx', (3 + (target / (COLUMNS - 1)) * span).toFixed(1))
      bulge.current.setAttribute('cy', (top + (h[Math.round(target)] ?? 0) - 5).toFixed(1))
    }
  }, [level])

  const tick = useCallback((now: number) => {
    const h = heights.current
    const v = speeds.current
    const gap = Math.min(1 / 30, (now - last.current) / 1000)
    last.current = now
    for (let t = 0; t < gap; t += STEP_S) {
      const target = pull.current
      for (let i = 0; i < COLUMNS; i++) {
        const left = h[Math.max(0, i - 1)] ?? 0
        const right = h[Math.min(COLUMNS - 1, i + 1)] ?? 0
        const here = h[i] ?? 0
        const rest = target === null ? 0 : -BULGE * Math.exp(-(((i - target) / 4) ** 2))
        v[i] = (v[i] ?? 0) + (SPREAD * (left + right - 2 * here) - TENSION * (here - rest) - DAMPING * (v[i] ?? 0)) * STEP_S
      }
      for (let i = 0; i < COLUMNS; i++) h[i] = (h[i] ?? 0) + (v[i] ?? 0) * STEP_S
    }
    draw()
    let energy = 0
    for (let i = 0; i < COLUMNS; i++) energy += Math.abs(h[i] ?? 0) + Math.abs(v[i] ?? 0)
    if (energy > 0.4 || pull.current !== null || level.isAnimating()) raf.current = requestAnimationFrame(tick)
    else { raf.current = 0; h.fill(0); v.fill(0); draw() }
  }, [draw, level])

  const wake = useCallback(() => {
    if (raf.current) return
    last.current = performance.now()
    raf.current = requestAnimationFrame(tick)
  }, [tick])

  useEffect(() => () => { cancelAnimationFrame(raf.current); raf.current = 0; rise.current?.stop() }, [])
  // A new glass size (Mobile) redraws the water at once.
  useLayoutEffect(() => { geometry.current = size; draw() }, [draw, size])

  useEffect(() => {
    rise.current?.stop()
    if (still) {
      cancelAnimationFrame(raf.current)
      raf.current = 0
      pull.current = null
      heights.current.fill(0)
      speeds.current.fill(0)
      level.jump(share)
      draw()
      return
    }
    // The frame loop draws while the level moves, so the spring needs no draw of its own.
    rise.current = animate(level, share, spring.level)
    wake()
  }, [share, still, level, draw, wake])

  function commit(next: number): void {
    const snapped = clamp(min + Math.round((next - min) / step) * step, min, max)
    if (snapped === current) return
    setHeld(snapped)
    onValueChange?.(snapped)
  }

  function kick(strength: number): void {
    if (still) return
    speeds.current.forEach((_, i) => { speeds.current[i] = (speeds.current[i] ?? 0) + strength * (i / (COLUMNS - 1) - 0.5) })
    wake()
  }

  function slosh(strength: number): void {
    if (still) return
    kick(strength)
    setSplash((n) => n + 1)
  }

  function fromPointer(e: PointerEvent<HTMLDivElement>): void {
    const rect = box.current?.getBoundingClientRect()
    if (!rect) return
    const scale = rect.height / H
    const y = (e.clientY - rect.top) / scale
    commit(min + ((bottom - y) / (bottom - BRIM)) * (max - min))
    if (still) return
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1)
    pull.current = x * (COLUMNS - 1)
    const now = performance.now()
    const dx = e.clientX - pointer.current.x
    const dt = Math.max(1, now - pointer.current.t)
    pointer.current = { x: e.clientX, t: now, vx: (dx / dt) * 1000 }
    if (dragging && dx !== 0) kick(clamp(dx * SWAY_KICK, -MAX_SLOSH, MAX_SLOSH))
  }

  function release(): void {
    if (!dragging) return
    setDragging(false)
    setStart(null)
    pull.current = null
    const vx = pointer.current.vx
    slosh(Math.abs(vx) > 50 ? clamp(vx * 0.1, -MAX_SLOSH, MAX_SLOSH) : RELEASE_SLOSH)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    const page = step * 10
    const map: Record<string, number> = { ArrowUp: current + step, ArrowRight: current + step, ArrowDown: current - step, ArrowLeft: current - step, PageUp: current + page, PageDown: current - page, Home: min, End: max }
    const next = map[e.key]
    if (next === undefined || disabled) return
    e.preventDefault()
    const was = current
    commit(next)
    if (clamp(next, min, max) !== was) slosh(next > was ? KEY_SLOSH : -KEY_SLOSH)
  }

  const low = share < lowAt
  const full = current >= max
  const delta = start === null ? 0 : current - start
  const meta = dragging && delta !== 0 ? `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))} ${unit.toUpperCase()}` : `GOAL ${fmt(max)}`
  const style = color ? ({ '--feta-slider-accent': color } as CSSProperties) : undefined
  // The Focus frame's ring: the glass outline 6 out at the sides, from 4 above the rim to 8 above the bottom.
  const [L, R, T, B, mid] = [-6, W + 6, -4, H - 8, W / 2]
  const k = (R - L) * 0.2239
  const ring = `M${L} ${T + 13}C${L} ${T + 5.82} ${mid - k} ${T} ${mid} ${T}C${mid + k} ${T} ${R} ${T + 5.82} ${R} ${T + 13}V${B - 13}C${R} ${B - 5.82} ${mid + k} ${B} ${mid} ${B}C${mid - k} ${B} ${L} ${B - 5.82} ${L} ${B - 13}Z`

  return (
    <section className={cx(styles.card, className)} style={style} data-accent={color ? '' : undefined} data-disabled={disabled ? '' : undefined} data-still={still ? '' : undefined}>
      <header className={styles.head}>
        <span className={styles.title}>{label}</span>
        <span className={styles.meta}>{meta}</span>
      </header>
      <div className={styles.body}>
        <div className={styles.readout}>
          <div className={styles.note} role="status">
            <AnimatePresence initial={false} mode="popLayout">
              {full ? (
                <motion.span key="full" className={styles.done} initial={still ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, transition: { duration: still ? 0 : 0.12 } }} transition={still ? { duration: 0 } : spring.stamp}>
                  <span className={styles.badge} aria-hidden="true"><CheckIcon size={10} /></span>
                  {fullText}
                </motion.span>
              ) : low ? (
                <motion.span key="low" className={styles.hint} initial={still ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: still ? 0 : 0.12 } }} transition={{ duration: still ? 0 : 0.16 }}>{lowText}</motion.span>
              ) : null}
            </AnimatePresence>
          </div>
          <span className={styles.value} aria-hidden="true"><RollingText value={fmt(current)} still={still} /></span>
          <span className={styles.unit} aria-hidden="true">{unit} of {fmt(max)}</span>
        </div>
        <div
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={label}
          aria-orientation="vertical"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={current}
          aria-valuetext={`${fmt(current)} ${unit} of ${fmt(max)}`}
          aria-disabled={disabled || undefined}
          className={styles.wrap}
          data-dragging={dragging ? '' : undefined}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            if (disabled || e.button !== 0) return
            e.currentTarget.setPointerCapture(e.pointerId)
            pointer.current = { x: e.clientX, t: performance.now(), vx: 0 }
            setStart(current)
            setDragging(true)
            fromPointer(e)
            wake()
          }}
          onPointerMove={(e) => { if (dragging) fromPointer(e) }}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
        >
          <div className={styles.glass}>
            <svg ref={box} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className={styles.svg}>
              <defs>
                <filter id={`${id}-b8`} x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="4" /></filter>
                <filter id={`${id}-b2`} x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="1" /></filter>
                <linearGradient id={`${id}-wall`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" className={styles.s8} /><stop offset="0.16" className={styles.s4} /><stop offset="0.82" className={styles.s4} /><stop offset="1" className={styles.s10} />
                </linearGradient>
                <linearGradient id={`${id}-body`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" className={styles.wEdge} /><stop offset="0.3" className={styles.wMid} /><stop offset="0.75" className={styles.wMid} /><stop offset="1" className={styles.wEdge} />
                </linearGradient>
                <linearGradient id={`${id}-depth`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" className={styles.clear} /><stop offset="1" className={styles.wDeep} />
                </linearGradient>
                <linearGradient id={`${id}-top`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" className={styles.wTopA} /><stop offset="1" className={styles.wTopB} />
                </linearGradient>
                <linearGradient id={`${id}-shine`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" className={styles.lit} /><stop offset="1" className={styles.unlit} />
                </linearGradient>
                <linearGradient id={`${id}-glint`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" className={styles.unlit} /><stop offset="0.5" className={styles.lit} /><stop offset="1" className={styles.unlit} />
                </linearGradient>
                <clipPath id={`${id}-water`}><path ref={waterClip} /></clipPath>
              </defs>
              <ellipse className={styles.shadowSoft} cx={W / 2} cy={H - 13} rx={W / 2 + 18} ry={11} filter={`url(#${id}-b8)`} />
              <ellipse className={styles.shadowContact} cx={W / 2} cy={H - 13} rx={W / 2 + 1} ry={5} filter={`url(#${id}-b2)`} />
              <rect x={0} y={9} width={W} height={H - 36} fill={`url(#${id}-wall)`} />
              <ellipse className={styles.rim} cx={W / 2} cy={9} rx={W / 2 - 0.5} ry={8.5} />
              <ellipse className={styles.paper} cx={W / 2} cy={H - 21} rx={W / 2} ry={9} />
              <ellipse className={styles.tint} cx={W / 2} cy={H - 21} rx={W / 2} ry={9} />
              <rect className={styles.paper} x={0} y={H - 27} width={W} height={6} />
              <rect className={styles.tint} x={0} y={H - 27} width={W} height={6} />
              <ellipse className={styles.tint} cx={W / 2} cy={H - 27} rx={W / 2 - 3} ry={7} />
              <path ref={water} fill={`url(#${id}-body)`} />
              <path d={`M3 ${BRIM}H${W - 3}V${bottom}H3Z`} fill={`url(#${id}-depth)`} clipPath={`url(#${id}-water)`} />
              <ellipse ref={bulge} className={styles.bulge} rx={17} ry={7} cx={W / 2} cy={-20} />
              <g clipPath={`url(#${id}-water)`}>
                <g ref={watchLoop} data-loop="" className={styles.bubbles}>
                  {[...BUBBLES, ...DRAG_BUBBLES].map(([x, r], i) => (
                    <circle key={i} ref={(node) => { bubbles.current[i] = node }} className={styles.bubble} data-extra={i >= BUBBLES.length ? '' : undefined} cx={x * (W / WEB.w)} cy={bottom} r={r - 0.375} />
                  ))}
                </g>
              </g>
              <g ref={surface} transform={`translate(${W / 2} ${bottom - share * (bottom - BRIM)})`}>
                <ellipse className={styles.surface} rx={W / 2 - 3.5} ry={6.5} fill={`url(#${id}-top)`} />
                <ellipse className={styles.meniscus} rx={W / 2 - 7.5} ry={4.5} />
                <rect className={styles.grab} x={-14} y={-3} width={28} height={6} rx={3} />
              </g>
              <g ref={drops} key={splash} className={styles.drops} data-on={splash > 0 && !still ? '' : undefined}>
                {DROPS.map(([x, rx, ry, up], i) => (
                  <ellipse key={i} className={styles.drop} style={{ '--up': `${-up}px` } as CSSProperties} cx={x * (W / WEB.w)} cy={0} rx={rx - 0.375} ry={ry - 0.375} />
                ))}
              </g>
              <rect className={styles.tint} x={0} y={9} width={1.5} height={H - 30} />
              <rect className={styles.tint} x={W - 1.5} y={9} width={1.5} height={H - 30} />
              <rect className={styles.inner} x={3} y={11} width={1} height={H - 36} />
              <rect className={styles.inner} x={W - 4} y={11} width={1} height={H - 36} />
              <rect x={11} y={23} width={8} height={(H - 36) * 0.7} rx={4} fill={`url(#${id}-shine)`} />
              <rect x={W - 15} y={31} width={3} height={(H - 36) * 0.4} rx={1.5} fill={`url(#${id}-shine)`} className={styles.thin} />
              <path className={styles.lip} d={`M1 9A${W / 2 - 1} 8 0 0 0 ${W - 1} 9`} />
              <path className={styles.glintLine} d="M14.4 13C18.97 13.69 24.87 14.27 31.7 14.7C38.52 15.14 46.12 15.41 54 15.5" />
              <path className={styles.baseFront} d={`M1 ${H - 21}A${W / 2 - 1} 8 0 0 0 ${W - 1} ${H - 21}`} />
              <ellipse cx={46.8} cy={H - 15.5} rx={30} ry={1.5} fill={`url(#${id}-glint)`} />
              <path className={styles.halo} d={ring} />
              <path className={styles.ring} d={ring} />
            </svg>
          </div>
        </div>
        <ol className={styles.marks} aria-hidden="true">{SCALE.map((at) => <li key={at}>{fmt(Math.round(min + at * (max - min)))}</li>)}</ol>
      </div>
    </section>
  )
}
