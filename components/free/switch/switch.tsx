'use client'
import { useId, useState, type ComponentProps, type MouseEvent, type ReactNode, type Ref } from 'react'
import { useFieldControl } from '../form-kit/form-kit'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './switch.module.css'

export type SwitchProps = Omit<ComponentProps<'button'>, 'onChange' | 'ref' | 'role' | 'type' | 'children'> & {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  invalid?: boolean
  animated?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** A toggle for a setting that applies at once. The thumb stretches under the finger and springs across. */
export function Switch({ checked, defaultChecked = false, onCheckedChange, invalid, disabled, id, onClick, animated = true, className, 'aria-describedby': describedBy, ref, ...rest }: SwitchProps) {
  const still = useStill(animated)
  const field = useFieldControl({ id, invalid, disabled, describedBy })
  const [held, setHeld] = useState(defaultChecked)
  const [pressed, setPressed] = useState(false)
  const on = checked ?? held

  function toggle(e: MouseEvent<HTMLButtonElement>): void {
    onClick?.(e)
    setHeld(!on)
    onCheckedChange?.(!on)
  }

  return (
    <button
      {...rest}
      ref={ref}
      id={field.id}
      type="button"
      role="switch"
      aria-checked={on}
      aria-invalid={field.invalid || undefined}
      aria-describedby={field.describedBy}
      disabled={field.disabled}
      data-on={on ? '' : undefined}
      data-invalid={field.invalid ? '' : undefined}
      data-still={still ? '' : undefined}
      className={cx(styles.track, className)}
      onClick={toggle}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      <span className={styles.glint} aria-hidden="true" />
      {/* A CSS transform moves the thumb, so nothing that shifts the switch on the page can replay the spring. */}
      <span className={styles.thumb} data-pressed={pressed && !still && !field.disabled ? '' : undefined}>
        <span className={styles.halo} aria-hidden="true" />
      </span>
    </button>
  )
}

export type SwitchFieldProps = SwitchProps & { label: ReactNode; description?: ReactNode }

/** A settings row. A click anywhere on the row toggles it. */
export function SwitchField({ label, description, className, disabled, 'aria-describedby': describedBy, ...rest }: SwitchFieldProps) {
  const uid = useId()
  // The title names the switch and the description describes it, so a screen reader does not read the description twice.
  const named = rest['aria-label'] || rest['aria-labelledby'] ? {} : { 'aria-labelledby': `${uid}-title` }
  const linked = [describedBy, description ? `${uid}-help` : null].filter(Boolean).join(' ')
  return (
    <label className={cx(styles.row, className)} data-disabled={disabled ? '' : undefined}>
      <span className={styles.text}>
        <span id={`${uid}-title`} className={styles.title}>{label}</span>
        {description ? <span id={`${uid}-help`} className={styles.description}>{description}</span> : null}
      </span>
      <Switch {...rest} {...named} {...(linked ? { 'aria-describedby': linked } : {})} disabled={disabled ?? false} />
    </label>
  )
}
