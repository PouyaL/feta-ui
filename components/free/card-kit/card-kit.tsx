'use client'
import { animate, useInView } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { ease } from '../../motion-tokens'

/** Value arrives: 600 ms from the 16.5 Motion frame. */
const COUNT_DURATION = 0.6

export type CountUpProps = {
  value: number
  format?: (value: number) => string
  /** Counts from here the first time it scrolls into view, then from the last value. Default 0. */
  from?: number
  /** Seconds. Default 0.6. */
  duration?: number
  still: boolean
  className?: string | undefined
}

/** A number that counts to its value by writing text directly, so it never re-renders per frame. */
export function CountUp({ value, format = String, from = 0, duration = COUNT_DURATION, still, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const last = useRef(from)
  useEffect(() => {
    const node = ref.current
    if (!node || (!inView && !still)) return
    if (still) { node.textContent = format(value); last.current = value; return }
    const controls = animate(last.current, value, { duration, ease: ease.out, onUpdate: (next) => { node.textContent = format(next); last.current = next } })
    return () => controls.stop()
  }, [value, inView, still, duration, format])
  return <span ref={ref} className={className}>{format(value)}</span>
}

const FINDERS = [[0, 0], [14, 0], [0, 14]] as const

export type QrArtProps = {
  /** Seeds the pattern, so the same seed always draws the same code. */
  seed: string
  /** Corner radius of the three finder squares, in grid cells. The inner squares take half. Default 1. */
  finderRadius?: number
  className?: string | undefined
}

/** A stand-in QR pattern on a 21 cell grid, seeded so it never changes between renders. Not a scannable code. */
export function QrArt({ seed, finderRadius = 1, className }: QrArtProps) {
  const cells = useMemo(() => {
    let hash = 7
    for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
    const list: [number, number][] = []
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 21; x++) {
        hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0
        const finder = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)
        if (!finder && hash >>> 31) list.push([x, y])
      }
    }
    return list
  }, [seed])
  return (
    <svg viewBox="0 0 21 21" className={className} aria-hidden="true">
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" rx="0.2" />)}
      {FINDERS.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x + 0.5} y={y + 0.5} width="6" height="6" rx={finderRadius} fill="none" stroke="currentColor" />
          <rect x={x + 2} y={y + 2} width="3" height="3" rx={finderRadius / 2} />
        </g>
      ))}
    </svg>
  )
}
