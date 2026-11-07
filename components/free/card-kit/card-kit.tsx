'use client'
import { animate, useInView } from 'motion/react'
import { useEffect, useRef } from 'react'
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
