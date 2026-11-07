'use client'
import { motion } from 'motion/react'
import { useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react'
import { duration, ease } from '../../motion-tokens'
import { useFieldControl } from '../form-kit/form-kit'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './input-otp.module.css'

const PATTERNS = {
  'six-digits': { length: 6, accept: /[0-9]/g, mode: 'numeric', masked: false, split: 3 },
  'four-pin': { length: 4, accept: /[0-9]/g, mode: 'numeric', masked: true, split: 0 },
  alphanumeric: { length: 6, accept: /[0-9a-z]/gi, mode: 'text', masked: false, split: 0 },
} as const

export type InputOTPProps = {
  /** Six digits split 3 and 3, a masked PIN, or letters and digits. Default `six-digits`. */
  pattern?: keyof typeof PATTERNS
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Fires on the last character, typed or pasted. */
  onComplete?: (value: string) => void
  invalid?: boolean
  disabled?: boolean
  id?: string
  'aria-label'?: string
  animated?: boolean
  className?: string
}

/** Separate slots that behave like one input: one real field, with autofill and paste. */
export function InputOTP({ pattern = 'six-digits', value, defaultValue = '', onValueChange, onComplete, invalid, disabled, id, 'aria-label': label = 'One time code', animated = true, className }: InputOTPProps) {
  const still = useStill(animated)
  const field = useFieldControl({ id, invalid, disabled })
  const spec = PATTERNS[pattern]
  const [held, setHeld] = useState(defaultValue)
  const [focused, setFocused] = useState(false)
  const [pasted, setPasted] = useState(false)
  const code = (value ?? held).slice(0, spec.length)
  const active = Math.min(code.length, spec.length - 1)

  function commit(raw: string, fromPaste = false): void {
    const next = (raw.match(spec.accept) ?? []).join('').slice(0, spec.length)
    const clean = pattern === 'alphanumeric' ? next.toUpperCase() : next
    if (clean === code) return
    setPasted(fromPaste)
    setHeld(clean)
    onValueChange?.(clean)
    if (clean.length === spec.length) onComplete?.(clean)
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>): void {
    e.preventDefault()
    commit(e.clipboardData.getData('text'), true)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    // Keep the caret at the end, so typing and Backspace always act on the last slot.
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.preventDefault()
  }

  return (
    <div className={cx(styles.otp, className)} data-still={still ? '' : undefined} data-invalid={field.invalid ? '' : undefined} data-disabled={field.disabled ? '' : undefined}>
      <input
        id={field.id}
        className={styles.entry}
        inputMode={spec.mode}
        autoComplete="one-time-code"
        aria-label={label}
        aria-invalid={field.invalid || undefined}
        aria-describedby={field.describedBy}
        type={spec.masked ? 'password' : 'text'}
        maxLength={spec.length}
        value={code}
        disabled={field.disabled}
        onChange={(e: ChangeEvent<HTMLInputElement>) => commit(e.target.value)}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {Array.from({ length: spec.length }, (_, i) => {
        const char = code[i]
        return (
          <span key={i} className={styles.group} aria-hidden="true">
            {spec.split && i === spec.split ? <span className={styles.separator} /> : null}
            <span className={styles.slot} data-active={focused && i === active ? '' : undefined} data-filled={char ? '' : undefined}>
              {char ? (
                <motion.span
                  key={char}
                  initial={still ? false : { y: -6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: still ? 0 : duration.focus, ease: ease.out, delay: pasted && !still ? i * 0.04 : 0 }}
                >
                  {spec.masked ? <span className={styles.mask} /> : char}
                </motion.span>
              ) : null}
              {focused && i === code.length ? <span className={styles.caret} /> : null}
            </span>
          </span>
        )
      })}
    </div>
  )
}
