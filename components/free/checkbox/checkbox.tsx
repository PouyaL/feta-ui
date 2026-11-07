'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ChangeEvent, type ComponentProps, type ReactNode, type Ref } from 'react'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { duration, ease, spring } from '../../motion-tokens'
import { form, useFieldControl } from '../form-kit/form-kit'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './checkbox.module.css'

const STAGGER_MS = 30

export type CheckboxProps = Omit<ComponentProps<'input'>, 'type' | 'size' | 'ref' | 'checked' | 'defaultChecked'> & {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** For parents of a list: some children are checked. */
  indeterminate?: boolean
  invalid?: boolean
  /** Delays the check, so a group can ripple. */
  drawDelay?: number
  animated?: boolean
  ref?: Ref<HTMLInputElement>
}

/** A native checkbox: the box gives under the finger, fills from the centre and draws its check. */
export function Checkbox({ checked, defaultChecked = false, onCheckedChange, indeterminate = false, invalid, drawDelay = 0, id, disabled, required, onChange, animated = true, className, 'aria-describedby': describedBy, ref, ...rest }: CheckboxProps) {
  const still = useStill(animated)
  const field = useFieldControl({ id, invalid, disabled, required, describedBy })
  const inner = useRef<HTMLInputElement | null>(null)
  const [held, setHeld] = useState(defaultChecked)
  const on = checked ?? held
  const filled = on || indeterminate

  useEffect(() => {
    if (inner.current) inner.current.indeterminate = indeterminate
  }, [indeterminate])

  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    onChange?.(e)
    setHeld(e.target.checked)
    onCheckedChange?.(e.target.checked)
  }

  const draw = still ? { duration: 0 } : { duration: duration.draw, ease: ease.out, delay: drawDelay + 0.06 }

  return (
    <span className={cx(styles.box, className)} data-filled={filled ? '' : undefined} data-invalid={field.invalid ? '' : undefined} data-disabled={field.disabled ? '' : undefined} data-still={still ? '' : undefined}>
      <input
        {...rest}
        {...field.a11y}
        ref={(node) => {
          inner.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        type="checkbox"
        id={field.id}
        checked={on}
        disabled={field.disabled}
        required={field.required}
        aria-describedby={field.describedBy}
        onChange={handleChange}
        className={styles.input}
      />
      <motion.span
        className={styles.fill}
        aria-hidden="true"
        initial={false}
        animate={{ scale: filled ? 1 : 0.6, opacity: filled ? 1 : 0 }}
        transition={still ? { duration: 0 } : filled ? { ...spring.pop, delay: drawDelay } : { duration: duration.focus }}
      />
      <svg className={styles.glyph} viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <AnimatePresence initial={false}>
          {indeterminate ? (
            <motion.path key="minus" d="M3 7h8" initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} exit={{ opacity: 0 }} transition={draw} />
          ) : on ? (
            <motion.path key="check" d="M2.5 7.5 5.6 10.4 11.5 3.8" initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={draw} />
          ) : null}
        </AnimatePresence>
      </svg>
    </span>
  )
}

export type CheckboxFieldProps = CheckboxProps & {
  label: ReactNode
  description?: ReactNode
  error?: ReactNode
}

/** A checkbox with a label and description. The whole row is the hit area. */
export function CheckboxField({ label, description, error, invalid, className, animated = true, 'aria-describedby': describedBy, ...rest }: CheckboxFieldProps) {
  const still = useStill(animated)
  const id = useId()
  const help = `${id}-help`
  const fail = `${id}-error`
  const linked = [describedBy, description ? help : null, error ? fail : null].filter(Boolean).join(' ')
  return (
    <div className={cx(styles.field, className)} data-disabled={rest.disabled ? '' : undefined}>
      <label className={styles.row}>
        <Checkbox {...rest} animated={animated} invalid={invalid ?? Boolean(error)} {...(linked ? { 'aria-describedby': linked } : {})} />
        <span className={styles.text}>
          <span className={styles.title}>{label}</span>
          {description ? <span id={help} className={styles.description}>{description}</span> : null}
        </span>
      </label>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.span key="error" id={fail} role="alert" className={cx(form.message, styles.error)} initial={still ? false : { y: 4, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: still ? 0 : duration.message, ease: ease.out }}>
            <AlertCircleIcon trigger="none" /> {error}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export type CheckboxCardProps = Omit<CheckboxProps, 'title'> & { title: ReactNode; description?: ReactNode; icon?: ReactNode }

/** A whole card that toggles. */
export function CheckboxCard({ title, description, icon, className, checked, defaultChecked = false, onCheckedChange, animated = true, disabled, ...rest }: CheckboxCardProps) {
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultChecked)
  const on = checked ?? held
  return (
    <label className={cx(styles.card, className)} data-on={on ? '' : undefined} data-disabled={disabled ? '' : undefined} data-still={still ? '' : undefined}>
      {icon ? <span className={styles.tile}>{icon}</span> : null}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
      <Checkbox {...rest} animated={animated} disabled={disabled ?? false} checked={on} onCheckedChange={(next) => { setHeld(next); onCheckedChange?.(next) }} />
    </label>
  )
}

export type CheckboxGroupProps = {
  /** The parent's label. */
  label: string
  items: { value: string; label: string; disabled?: boolean }[]
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
  error?: ReactNode
  animated?: boolean
  className?: string
}

/** A list with a parent checkbox. Some children checked puts the parent in Indeterminate. */
export function CheckboxGroup({ label, items, value, defaultValue = [], onValueChange, error, animated = true, className }: CheckboxGroupProps) {
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultValue)
  const chosen = value ?? held
  const enabled = items.filter((item) => !item.disabled)
  const count = enabled.filter((item) => chosen.includes(item.value)).length
  const all = enabled.length > 0 && count === enabled.length
  const locked = chosen.filter((v) => items.some((item) => item.disabled && item.value === v))
  // The stagger is for the parent's ripple. A single click draws straight away.
  const [ripple, setRipple] = useState(false)

  function set(next: string[]): void {
    setHeld(next)
    onValueChange?.(next)
  }

  return (
    <div role="group" aria-label={label} className={cx(styles.group, className)} data-invalid={error ? '' : undefined}>
      <div className={styles.parent}>
        <CheckboxField label={label} animated={animated} checked={all} indeterminate={count > 0 && !all} invalid={Boolean(error)} onCheckedChange={() => { setRipple(true); set(all ? locked : [...locked, ...enabled.map((item) => item.value)]) }} />
        <span className={styles.count}>{count} of {enabled.length}</span>
      </div>
      <ul className={styles.list}>
        {items.map((item, i) => {
          const on = chosen.includes(item.value)
          return (
            <li key={item.value} className={styles.item} data-on={on ? '' : undefined}>
              <CheckboxField
                label={item.label}
                animated={animated}
                checked={on}
                invalid={Boolean(error)}
                disabled={item.disabled ?? false}
                drawDelay={still || !ripple ? 0 : (i * STAGGER_MS) / 1000}
                onCheckedChange={(next) => { setRipple(false); set(next ? [...chosen, item.value] : chosen.filter((v) => v !== item.value)) }}
              />
            </li>
          )
        })}
      </ul>
      {error ? <span role="alert" className={cx(form.message, styles.groupError)}><AlertCircleIcon trigger="none" /> {error}</span> : null}
    </div>
  )
}
