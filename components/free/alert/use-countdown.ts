'use client'
import { useEffect, useRef } from 'react'

/** Runs `onEnd` after `ms` of unpaused time. Pausing keeps what is left. */
export function useCountdown(ms: number | null, paused: boolean, onEnd: () => void): void {
  const end = useRef(onEnd)
  end.current = onEnd
  const left = useRef(ms)
  useEffect(() => { left.current = ms }, [ms])
  useEffect(() => {
    if (left.current === null || paused) return undefined
    const started = performance.now()
    const timer = setTimeout(() => end.current(), left.current)
    return () => {
      clearTimeout(timer)
      if (left.current !== null) left.current -= performance.now() - started
    }
  }, [ms, paused])
}
