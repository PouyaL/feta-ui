'use client'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { AudioLinesIcon } from '@fetaui/react/rounded/audio-lines'
import { BulbIcon } from '@fetaui/react/rounded/bulb'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { SparklesIcon } from '@fetaui/react/rounded/sparkles'
import { StopIcon } from '@fetaui/react/rounded/stop'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import styles from './aura-frame.module.css'

const TICK_MS = 80
const GLYPHS = 'μπXOHKλPMW.QN#ZSΣΩ*FAY%&1UL0BTGDEV+@'
/** The glyph block fills 283 by 162 at 12/18 mono: 9 rows of 20 characters. */
const ROWS = 9
const COLUMNS = 20

const hash = (seed: number): number => {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}
const glyphBlock = (seed: number, tick: number): string => Array.from({ length: ROWS }, (_, row) => Array.from({ length: COLUMNS }, (_, i) => (hash(seed + row * 31 + i * 7) < 0.5 ? ' ' : GLYPHS[Math.floor(hash(seed + row + i * 3 + tick) * GLYPHS.length)])).join(' ')).join('\n')

const watch = (node: HTMLSpanElement | null): (() => void) | undefined => (node ? watchOffscreen(node) : undefined)

export type AuraFrameProps = {
  label: string
  placeholder?: string
  state?: 'rest' | 'thinking' | 'listening'
  /** Shown in the field while thinking. */
  statusText?: string
  /** The model chip. Default `Normal`. */
  mode?: string
  onMode?: () => void
  /** Whether DeepThink is on at the start. */
  defaultDeepThink?: boolean
  onAttach?: () => void
  onSubmit?: (value: string) => void
  onStop?: () => void
  onVoice?: () => void
  /** 0 to 1 while listening. It leans the cool glow. */
  voiceLevel?: number
  animated?: boolean
  className?: string
}

/** Warm and cool light leaking from a prompt, with glyphs in the glow, for a louder, brand led composer. */
export function AuraFrame({ label, placeholder = 'Ask anything…', state = 'rest', statusText, mode = 'Normal', onMode, defaultDeepThink = false, onAttach, onSubmit, onStop, onVoice, voiceLevel = 0, animated = true, className }: AuraFrameProps) {
  const still = useStill(animated)
  const warm = useRef<HTMLPreElement>(null)
  const cool = useRef<HTMLPreElement>(null)
  const [value, setValue] = useState('')
  const [deep, setDeep] = useState(defaultDeepThink)
  const busy = state !== 'rest'

  // Glyphs re-roll on a timer, written to the DOM so a tick never re-renders.
  useEffect(() => {
    const paint = (tick: number): void => {
      if (warm.current) warm.current.textContent = glyphBlock(3, tick)
      if (cool.current && tick === 0) cool.current.textContent = glyphBlock(11, 0)
    }
    paint(0)
    if (still || state !== 'thinking') return
    let tick = 0
    const timer = setInterval(() => {
      if (document.hidden || warm.current?.closest('[data-offscreen]')) return
      paint((tick += 1))
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [still, state])

  const submit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (state === 'thinking') onStop?.()
    else onSubmit?.(value)
  }

  return (
    <form className={cx(styles.aura, className)} data-state={state} data-still={still ? '' : undefined} data-loop="" onSubmit={submit} style={{ '--voice': voiceLevel } as CSSProperties}>
      <span ref={watch} aria-hidden="true" className={styles.warm} />
      <span aria-hidden="true" className={styles.cool} />
      <pre ref={warm} aria-hidden="true" className={styles.glyphs} data-side="warm" />
      <pre ref={cool} aria-hidden="true" className={styles.glyphs} data-side="cool" />
      <div className={styles.box}>
        <div className={styles.field}>
          {busy ? <span aria-hidden="true" className={styles.lead}>{state === 'thinking' ? <SparklesIcon /> : <AudioLinesIcon />}</span> : null}
          <input aria-label={label} className={styles.input} placeholder={placeholder} value={busy ? statusText ?? (state === 'thinking' ? 'Thinking' : 'Listening…') : value} readOnly={busy} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className={styles.footer}>
          <IconButton variant="secondary" size="sm" icon={<PlusIcon />} label="Add" animated={animated} onClick={onAttach} />
          <Button variant="secondary" shape="pill" size="sm" animated={animated} leadingIcon={<SparklesIcon />} trailingIcon={<span className={styles.down}><ChevronUpIcon /></span>} onClick={onMode}>{mode}</Button>
          <span className={styles.deep}><Button variant={deep ? 'primary' : 'secondary'} shape="pill" size="sm" animated={animated} aria-pressed={deep} leadingIcon={<BulbIcon />} onClick={() => setDeep(!deep)}>DeepThink</Button></span>
          <span className={styles.spacer} />
          {/* Web shows a Voice pill that turns into a Primary Stop; Mobile shows the same as an icon button. */}
          <span className={styles.voice}>
            {state === 'listening'
              ? <Button variant="primary" shape="pill" size="sm" animated={animated} leadingIcon={<AudioLinesIcon />} onClick={onStop}>Stop</Button>
              : <Button variant="secondary" shape="pill" size="sm" animated={animated} leadingIcon={<AudioLinesIcon />} onClick={onVoice}>Voice</Button>}
          </span>
          <span className={styles.voiceIcon}>
            <IconButton variant={state === 'listening' ? 'primary' : 'secondary'} size="sm" icon={<AudioLinesIcon />} label={state === 'listening' ? 'Stop listening' : 'Voice'} animated={animated} onClick={state === 'listening' ? onStop : onVoice} />
          </span>
          <IconButton type="submit" size="sm" variant="primary" disabled={state === 'rest' && !value} icon={state === 'thinking' ? <StopIcon /> : <ChevronUpIcon />} label={state === 'thinking' ? 'Stop' : 'Send'} animated={animated} />
        </div>
      </div>
    </form>
  )
}
