'use client'
import { useEffect, useRef, useState } from 'react'
import { cx, useStill } from '../motion-kit/motion-kit'
import { TextShell } from '../text-shell/text-shell'
import styles from './glitch-text.module.css'

const BURST_MS = 420

export type GlitchTextProps = {
  text: string
  /** Soft puts it in the shell. Default `soft`. */
  styleKind?: 'soft' | 'original'
  /** `status` is a small label beside a value. A new value bursts once. */
  size?: 'display' | 'status'
  /** Mono label for `status`. */
  label?: string
  strength?: 'normal' | 'strong'
  /** Hold the burst, for specimens. */
  burst?: boolean
  animated?: boolean
  className?: string
}

/** Red and cyan slices tear the word for a moment on hover, or when the value changes. */
export function GlitchText({ text, styleKind = 'soft', size = 'display', label, strength = 'normal', burst, animated = true, className }: GlitchTextProps) {
  const still = useStill(animated)
  const [on, setOn] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const last = useRef(text)
  useEffect(() => () => clearTimeout(timer.current), [])

  function fire(): void {
    if (still) return
    setOn(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOn(false), BURST_MS)
  }

  useEffect(() => {
    if (last.current === text) return
    last.current = text
    fire()
  }, [text])

  const bursting = !still && (burst ?? on)
  const word = (
    <span className={styles.line} data-size={size}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <span className={styles.glitch} data-on={bursting ? '' : undefined} data-strength={strength} data-text={text} onPointerEnter={fire} aria-live={size === 'status' ? 'polite' : undefined}>{text}</span>
    </span>
  )
  if (styleKind === 'original') return <span className={className}>{word}</span>
  return <TextShell name="Glitch Text" state={bursting ? (size === 'status' ? 'status change' : strength === 'strong' ? 'burst strong' : 'burst') : size === 'status' ? 'status rest' : 'rest'} className={cx(className)}>{word}</TextShell>
}
