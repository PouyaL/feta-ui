'use client'
import { useState, type FocusEvent, type FormEvent } from 'react'
import { SendIcon } from '@fetaui/react/rounded/send'
import { SparklesIcon } from '@fetaui/react/rounded/sparkles'
import { StopIcon } from '@fetaui/react/rounded/stop'
import { IconButton } from '../icon-button/icon-button'
import { MetalRing } from '../metal-frame/metal-ring'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './bezel-frame.module.css'

/** Ring strength at rest, and when focused or thinking. */
const REST_STRENGTH = 0.55
/** Bands drift this many times faster while thinking. */
const THINKING_SPEED = 2.5

export type BezelFrameProps = {
  /** The field's accessible name. */
  label: string
  placeholder?: string
  defaultValue?: string
  /** The ring runs faster, send becomes stop, and the field says Thinking. */
  thinking?: boolean
  disabled?: boolean
  onSubmit?: (value: string) => void
  onStop?: () => void
  animated?: boolean
  /** Swells the ring toward a mouse pointer. Default true. */
  bend?: boolean
  className?: string
}

/** A single prompt seated in a bezel ringed in sky chrome, for a hero search. */
export function BezelFrame({ label, placeholder = 'Ask me anything…', defaultValue = '', thinking = false, disabled = false, onSubmit, onStop, animated = true, bend = true, className }: BezelFrameProps) {
  const still = useStill(animated)
  const [value, setValue] = useState(defaultValue)
  const [focused, setFocused] = useState(false)
  const submit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (thinking) onStop?.()
    else if (value.trim()) onSubmit?.(value)
  }
  // Focus moving from the field to send stays inside the form, so it is not a blur.
  const blur = (e: FocusEvent<HTMLFormElement>): void => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
  }
  return (
    <form className={cx(styles.bezel, className)} data-loop="" data-thinking={thinking ? '' : undefined} data-disabled={disabled ? '' : undefined} data-still={still ? '' : undefined} onFocus={() => setFocused(true)} onBlur={blur} onSubmit={submit}>
      <MetalRing tint="sky" still={still || disabled} strength={focused || thinking ? 1 : REST_STRENGTH} speed={thinking ? THINKING_SPEED : 1} bend={bend} className={styles.ring} />
      <div className={styles.field}>
        {thinking ? <span aria-hidden="true" className={styles.lead}><SparklesIcon /></span> : null}
        <input aria-label={label} className={styles.input} value={thinking ? 'Thinking' : value} placeholder={placeholder} readOnly={thinking} disabled={disabled} onChange={(e) => setValue(e.target.value)} />
        <IconButton type="submit" variant={focused && !thinking ? 'primary' : 'ghost'} size="md" icon={thinking ? <StopIcon /> : <SendIcon />} label={thinking ? 'Stop' : 'Send'} animated={animated} disabled={disabled} />
      </div>
    </form>
  )
}
