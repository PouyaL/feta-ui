'use client'
import { motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ChangeEvent, type ComponentProps, type ReactNode, type Ref } from 'react'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { spring } from '../../motion-tokens'
import { form } from '../form-kit/form-kit'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './radio.module.css'

export type RadioProps = Omit<ComponentProps<'input'>, 'type' | 'size' | 'ref'> & { invalid?: boolean; animated?: boolean; ref?: Ref<HTMLInputElement> }

/** A native radio that feels alive: hover breathes, press squeezes and sends a ripple. */
export function Radio({ invalid, disabled, checked, defaultChecked, animated = true, className, ref, ...rest }: RadioProps) {
  const still = useStill(animated)
  const inner = useRef<HTMLInputElement | null>(null)
  const [ripple, setRipple] = useState(0)
  const [held, setHeld] = useState(Boolean(defaultChecked))
  const on = checked ?? held

  // Picking another radio unchecks this one with no change event on it, so listen for the group.
  useEffect(() => {
    if (checked !== undefined) return
    const sync = (): void => setHeld(Boolean(inner.current?.checked))
    document.addEventListener('change', sync)
    return () => document.removeEventListener('change', sync)
  }, [checked])

  return (
    <span className={cx(styles.radio, className)} data-on={on ? '' : undefined} data-invalid={invalid ? '' : undefined} data-disabled={disabled ? '' : undefined} data-still={still ? '' : undefined}>
      <span className={styles.pulse} aria-hidden="true" />
      {ripple ? <span key={ripple} className={styles.ripple} aria-hidden="true" /> : null}
      <input
        {...rest}
        ref={(node) => {
          inner.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        type="radio"
        {...(checked === undefined ? { defaultChecked: Boolean(defaultChecked) } : { checked })}
        disabled={disabled ?? false}
        aria-invalid={invalid || undefined}
        className={styles.input}
        onPointerDown={() => { if (!disabled && !still) setRipple((n) => n + 1) }}
      />
      <span className={styles.control} aria-hidden="true">
        <motion.span className={styles.dot} initial={false} animate={{ scale: on ? 1 : 0 }} transition={still ? { duration: 0 } : spring.pop} />
      </span>
    </span>
  )
}

export type RadioOption = { value: string; label: ReactNode; description?: ReactNode; icon?: ReactNode; meta?: ReactNode; disabled?: boolean }

export type RadioGroupProps = {
  /** The legend. */
  label: ReactNode
  options: RadioOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** `card` makes the whole card the target. Default `list`. */
  variant?: 'list' | 'card'
  error?: ReactNode
  disabled?: boolean
  name?: string
  animated?: boolean
  className?: string
}

/** Pick exactly one. Arrow keys move and select; Tab enters on the checked item. */
export function RadioGroup({ label, options, value, defaultValue, onValueChange, variant = 'list', error, disabled, name, animated = true, className }: RadioGroupProps) {
  const still = useStill(animated)
  const id = useId()
  const [held, setHeld] = useState(defaultValue)
  const current = value ?? held
  const group = name ?? id
  const legend = `${id}-legend`
  const invalid = Boolean(error)

  function choose(e: ChangeEvent<HTMLInputElement>): void {
    setHeld(e.target.value)
    onValueChange?.(e.target.value)
  }

  return (
    <div role="radiogroup" aria-labelledby={legend} aria-invalid={invalid || undefined} className={cx(styles.group, className)}>
      <div id={legend} className={styles.legend}>{label}</div>
      <div className={styles.body} data-variant={variant}>
        {options.map((option) => {
          const on = option.value === current
          const off = disabled || option.disabled
          return (
            <label key={option.value} className={styles.option} data-variant={variant} data-on={on ? '' : undefined} data-disabled={off ? '' : undefined} data-still={still ? '' : undefined}>
              {variant === 'list' ? <Radio name={group} value={option.value} checked={on} disabled={off ?? false} invalid={invalid} animated={animated} onChange={choose} /> : null}
              {option.icon ? <span className={styles.icon}>{option.icon}</span> : null}
              <span className={styles.text}>
                <span className={styles.title}>{option.label}</span>
                {option.description ? <span className={styles.description}>{option.description}</span> : null}
              </span>
              {option.meta ? <span className={styles.meta}>{option.meta}</span> : null}
              {variant === 'card' ? <Radio name={group} value={option.value} checked={on} disabled={off ?? false} invalid={invalid} animated={animated} onChange={choose} /> : null}
            </label>
          )
        })}
      </div>
      {error ? <span role="alert" className={cx(form.message, styles.error)}><AlertCircleIcon trigger="none" /> {error}</span> : null}
    </div>
  )
}
