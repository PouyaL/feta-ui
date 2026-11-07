'use client'
import { useEffect, useRef } from 'react'
import { cx, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import { kit, useWindow } from '../data-kit/data-kit'
import styles from './request-log.module.css'

const ROW = 38

export type RequestEntry = { id: string; status: number | null; method: string; path: string; duration: string; time: string }
const stateOf = (status: number | null): 'pending' | 'success' | 'client' | 'server' => (status === null ? 'pending' : status >= 500 ? 'server' : status >= 400 ? 'client' : 'success')
const NAMES = { pending: 'Pending', success: 'Success', client: 'Client error', server: 'Server error' }

/** One request in mono. 2xx success, 4xx warning, 5xx danger, and Pending pulses its dot. */
export function RequestLog({ status, method, path, duration, time, animated = true, className }: Omit<RequestEntry, 'id'> & { animated?: boolean; className?: string | undefined }) {
  const still = useStill(animated)
  const dot = useRef<HTMLSpanElement>(null)
  const state = stateOf(status)
  useEffect(() => (state === 'pending' && dot.current ? watchOffscreen(dot.current) : undefined), [state])
  return (
    <div className={cx(styles.row, kit.row, className)} data-state={state} data-still={still ? '' : undefined} data-loop={state === 'pending' ? '' : undefined}>
      <div className={styles.cells}>
        <span className={styles.status}><span ref={dot} className={styles.dot} data-keep-motion="" role="img" aria-label={NAMES[state]} />{status ?? '···'}</span>
        <span className={styles.method}>{method}</span>
        <span className={styles.path}>{path}</span>
        <span className={styles.duration}>{duration}</span>
        <time className={styles.time}>{time}</time>
      </div>
    </div>
  )
}

/** A live tail of any length: only rows near the viewport render. */
export function RequestLogList({ entries, height = 342, label = 'Requests', animated = true, className }: { entries: RequestEntry[]; height?: number; label?: string; animated?: boolean; className?: string | undefined }) {
  const { first, last, total, onScroll } = useWindow(entries.length, ROW, height)
  return (
    <div className={cx(styles.list, className)} style={{ height }} onScroll={onScroll} role="log" aria-label={label} tabIndex={0}>
      <div style={{ height: total, position: 'relative' }}>
        <div style={{ transform: `translateY(${first * ROW}px)` }}>
          {entries.slice(first, last).map(({ id, ...entry }) => <RequestLog key={id} {...entry} animated={animated} />)}
        </div>
      </div>
    </div>
  )
}
