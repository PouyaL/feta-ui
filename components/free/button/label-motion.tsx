'use client'
import { animate } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import styles from './label-motion.module.css'

// Hover draws the label and press waves it, one word at a time, for any control with a text label.
// At rest the label stays plain text. Letters exist only while animating, laid over the hidden text
// at its measured positions, so kerning and width never change.
const LETTER_MS = 520
const STAGGER_MS = 45
const WORD_S = 0.45
const SPREAD = 0.6
const LIFT = 0.11
/** A new word starts drawing as the old one finishes blurring out. */
const SWAP_DELAY_MS = 150

type Overlay = { kind: 'draw' | 'wave'; xs: number[]; baseline: number; start: number; swap: boolean }

/** Vertical offset of one letter while its word waves: up, then down, then flat, left to right. */
function letterOffset(progress: number, position: number, height: number): number {
  const phase = progress * (1 + SPREAD) - position * SPREAD
  if (phase <= 0 || phase >= 1) return 0
  return -height * LIFT * Math.sin(Math.PI * 2 * phase) * Math.sin(Math.PI * phase)
}

/**
 * `text` is null when the label is not plain text; then the handlers do nothing. With `drawOnChange`,
 * a new word draws itself in.
 */
export function useLabelMotion(text: string | null, enabled: boolean, drawOnChange = false): {
  /** Render this in place of the label. */
  label: ReactNode
  /** Spread on the control, or call from your own handlers. */
  handlers: {
    onPointerEnter: (e: PointerEvent<HTMLElement>) => void
    onPointerLeave: () => void
    onPointerDown: (e: PointerEvent<HTMLElement>) => void
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  }
} {
  const maskId = `feta-draw-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const baselineRef = useRef<HTMLElement>(null)
  const lettersRef = useRef<HTMLSpanElement>(null)
  const heightRef = useRef(0)
  const previousText = useRef(text)
  const letters = text === null ? [] : Array.from(text)
  const active = enabled && text !== null

  useEffect(() => { if (!active) setOverlay(null) }, [active])

  // Measured positions belong to the old word, so a new label ends any motion in progress.
  useLayoutEffect(() => {
    if (previousText.current === text) return
    previousText.current = text
    const control = drawOnChange && active ? textRef.current?.closest('button') : null
    const measured = control ? measure() : null
    setOverlay(measured ? { kind: 'draw', start: SWAP_DELAY_MS, swap: true, ...measured } : null)
  }, [text])

  useEffect(() => {
    if (overlay?.kind !== 'draw') return
    const timer = setTimeout(() => setOverlay(null), overlay.start + LETTER_MS + STAGGER_MS * overlay.xs.length)
    return () => clearTimeout(timer)
  }, [overlay])

  useLayoutEffect(() => {
    const wrap = lettersRef.current
    if (overlay?.kind !== 'wave' || !wrap) return
    const words: HTMLElement[][] = [[]]
    for (const part of wrap.querySelectorAll<HTMLElement>('span')) {
      if (part.textContent?.trim()) words.at(-1)?.push(part)
      else if (words.at(-1)?.length) words.push([])
    }
    const height = heightRef.current
    // One word at a time: each word gets its own slice of the timeline, in reading order.
    const controls = animate(0, 1, {
      duration: WORD_S * words.length,
      ease: 'linear',
      onUpdate: (progress) => words.forEach((word, w) => {
        const local = Math.min(1, Math.max(0, progress * words.length - w))
        word.forEach((part, i) => {
          part.style.transform = `translateY(${letterOffset(local, word.length > 1 ? i / (word.length - 1) : 0, height).toFixed(2)}px)`
        })
      }),
      onComplete: () => setOverlay(null),
    })
    return () => controls.stop()
  }, [overlay])

  function measure(): Pick<Overlay, 'xs' | 'baseline'> | null {
    const element = textRef.current
    const node = element?.firstChild
    const box = element?.parentElement
    if (!element || !box || !(node instanceof Text)) return null
    // The browser measures on screen, after every transform: the press scale on the control and any
    // scaled frame around it. The letters are laid out in layout pixels, so divide the whole scale out.
    const width = parseFloat(getComputedStyle(box).width)
    const scale = width > 0 ? box.getBoundingClientRect().width / width || 1 : 1
    const left = element.getBoundingClientRect().left
    const range = document.createRange()
    let index = 0
    const xs = letters.map((letter) => {
      range.setStart(node, index)
      index += letter.length
      range.setEnd(node, index)
      return (range.getBoundingClientRect().left - left) / scale
    })
    return { xs, baseline: baselineRef.current?.offsetTop ?? 0 }
  }

  function start(kind: Overlay['kind'], control: HTMLElement): void {
    if (!active) return
    const measured = measure()
    if (!measured) return
    heightRef.current = control.offsetHeight
    setOverlay({ kind, start: 0, swap: false, ...measured })
  }

  const label = text === null ? null : (
    <span className={styles.root}>
      <span ref={textRef} className={styles.text} data-hidden={overlay ? '' : undefined}>
        {text}
        <i ref={baselineRef} className={styles.baseline} />
      </span>
      {overlay?.kind === 'draw' ? (
        <svg className={styles.ink} aria-hidden="true" width="100%" height="100%">
          {/* The moving stroke only reveals solid ink, so a letter is never hollow or tinted. */}
          <mask id={maskId}>
            <text y={overlay.baseline} xmlSpace="preserve">
              {letters.map((letter, i) => <tspan key={i} className={styles.stroke} x={overlay.xs[i]} style={{ animationDelay: `${overlay.start + i * STAGGER_MS}ms` }}>{letter}</tspan>)}
            </text>
          </mask>
          <text y={overlay.baseline} mask={`url(#${maskId})`} xmlSpace="preserve">
            {letters.map((letter, i) => <tspan key={i} x={overlay.xs[i]}>{letter}</tspan>)}
          </text>
        </svg>
      ) : null}
      {overlay?.kind === 'wave' ? (
        <span ref={lettersRef} className={styles.letters} aria-hidden="true">
          {letters.map((letter, i) => <span key={i} className={styles.letter} style={{ left: overlay.xs[i] }}>{letter}</span>)}
        </span>
      ) : null}
    </span>
  )

  return {
    label,
    handlers: {
      onPointerEnter: (e) => { if (e.pointerType === 'mouse') start('draw', e.currentTarget) },
      onPointerLeave: () => setOverlay((current) => (current?.kind === 'draw' && !current.swap ? null : current)),
      onPointerDown: (e) => start('wave', e.currentTarget),
      onKeyDown: (e) => { if (!e.repeat && (e.key === ' ' || e.key === 'Enter')) start('wave', e.currentTarget) },
    },
  }
}
