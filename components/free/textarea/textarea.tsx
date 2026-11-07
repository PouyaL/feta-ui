'use client'
import { useState, type ChangeEvent, type ComponentProps, type Ref } from 'react'
import { form, useFieldControl } from '../form-kit/form-kit'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './textarea.module.css'

const NEAR_LIMIT = 0.9

export type TextareaProps = Omit<ComponentProps<'textarea'>, 'ref'> & {
  invalid?: boolean
  /** Shows a mono count. It turns warning at 90% and danger past the limit. */
  limit?: number
  animated?: boolean
  ref?: Ref<HTMLTextAreaElement>
}

/** Multi line text with an optional character count. */
export function Textarea({ invalid, limit, id, disabled, required, value, defaultValue, onChange, animated = true, className, 'aria-describedby': describedBy, ref, ...rest }: TextareaProps) {
  const still = useStill(animated)
  const field = useFieldControl({ id, invalid, disabled, required, describedBy })
  const [typed, setTyped] = useState(String(value ?? defaultValue ?? '').length)
  const length = value === undefined ? typed : String(value).length
  const near = limit ? length >= limit * NEAR_LIMIT : false
  const over = limit ? length > limit : false

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>): void {
    setTyped(e.target.value.length)
    onChange?.(e)
  }

  return (
    <span className={cx(styles.box, className)} data-invalid={field.invalid || over ? '' : undefined} data-disabled={field.disabled ? '' : undefined} data-still={still ? '' : undefined}>
      <textarea
        {...rest}
        {...field.a11y}
        ref={ref}
        id={field.id}
        disabled={field.disabled}
        required={field.required}
        aria-describedby={field.describedBy}
        {...(value === undefined ? {} : { value })}
        {...(defaultValue === undefined ? {} : { defaultValue })}
        onChange={handleChange}
        className={cx(form.entry, styles.entry)}
      />
      {limit ? (
        <span className={styles.count} data-near={near ? '' : undefined} data-over={over ? '' : undefined}>
          {length}/{limit}
          {near ? <span className={form.srOnly} role="status">{over ? 'Over the limit' : `${limit - length} characters left`}</span> : null}
        </span>
      ) : null}
    </span>
  )
}
