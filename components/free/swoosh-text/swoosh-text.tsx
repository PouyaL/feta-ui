'use client'
import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { cx, useStill } from '../motion-kit/motion-kit'
import { TextShell } from '../text-shell/text-shell'
import styles from './swoosh-text.module.css'

const DEPTH_PX = 8
const SINK_RADIUS = 90
const SINK_MAX_DEG = 8

export type SwooshTextProps = {
  text: string
  styleKind?: 'soft' | 'original'
  animated?: boolean
  className?: string
}

/** Extruded letters lit by the pointer. The light swings the depth, a press sinks the letters nearby. */
export function SwooshText({ text, styleKind = 'soft', animated = true, className }: SwooshTextProps) {
  const still = useStill(animated)
  const root = useRef<HTMLSpanElement>(null)
  const [state, setState] = useState<'rest' | 'light swung' | 'pressed'>('rest')

  function light(e: PointerEvent<HTMLSpanElement>): void {
    const node = root.current
    if (!node || still) return
    const rect = node.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    node.style.setProperty('--dx', (-x).toFixed(3))
    setState((now) => (now === 'pressed' ? now : 'light swung'))
    if (state !== 'pressed') return
    sink(e.clientX)
  }

  function sink(pointer: number): void {
    const node = root.current
    if (!node) return
    for (const letter of node.querySelectorAll<HTMLElement>('[data-letter]')) {
      const rect = letter.getBoundingClientRect()
      const near = Math.max(0, 1 - Math.abs(rect.left + rect.width / 2 - pointer) / SINK_RADIUS)
      letter.style.setProperty('--sink', near.toFixed(3))
      letter.style.setProperty('--tilt', `${(pointer > rect.left ? -1 : 1) * near * SINK_MAX_DEG}deg`)
    }
  }

  function rise(): void {
    for (const letter of root.current?.querySelectorAll<HTMLElement>('[data-letter]') ?? []) { letter.style.setProperty('--sink', '0'); letter.style.setProperty('--tilt', '0deg') }
  }

  function release(): void {
    setState('rest')
    root.current?.style.setProperty('--dx', '1')
    rise()
  }

  const word = (
    <span
      ref={root}
      role="img"
      aria-label={text}
      className={styles.word}
      data-still={still ? '' : undefined}
      style={{ '--depth': `${DEPTH_PX}px` } as CSSProperties}
      onPointerMove={light}
      onPointerDown={(e) => { if (!still) { setState('pressed'); sink(e.clientX) } }}
      onPointerUp={() => { if (!still) { setState('light swung'); rise() } }}
      onPointerLeave={release}
    >
      {Array.from(text).map((char, i) => <span key={i} data-letter="" aria-hidden="true" className={styles.letter}>{char === ' ' ? ' ' : char}</span>)}
    </span>
  )
  if (styleKind === 'original') return <span className={className}>{word}</span>
  return <TextShell name="Swoosh Text" state={state} className={cx(className)}>{word}</TextShell>
}
