'use client'
import type { ReactNode } from 'react'
import { Field } from '../field/field'
import { cx } from '../motion-kit/motion-kit'
import { Select, type SelectOption } from '../select/select'
import styles from './dropdown.module.css'

export type DropdownOption = { value: string; label: string; /** Shown in a 24 px tile. */ emoji?: string; disabled?: boolean }

export type DropdownProps = {
  label: ReactNode
  options: DropdownOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  /** Shown under the field, in danger. */
  error?: ReactNode
  disabled?: boolean
  /** The note beside the label when disabled. */
  lockedLabel?: string
  animated?: boolean
  className?: string
}

/** Picks one option from a short list of one line text or emoji labels. */
export function Dropdown({ label, options, value, defaultValue, onValueChange, placeholder = 'Select', error, disabled = false, lockedLabel = 'Locked', animated = true, className }: DropdownProps) {
  const rows: SelectOption[] = options.map(({ emoji, ...option }) => ({ ...option, ...(emoji ? { icon: <span className={styles.tile} aria-hidden="true">{emoji}</span> } : {}) }))
  return (
    <Field label={label} error={error} disabled={disabled} animated={animated} {...(disabled ? { labelProps: { badge: lockedLabel } } : {})} className={cx(styles.dropdown, className)}>
      <Select options={rows} placeholder={placeholder} animated={animated} {...(value === undefined ? {} : { value })} {...(defaultValue === undefined ? {} : { defaultValue })} {...(onValueChange ? { onValueChange } : {})} />
    </Field>
  )
}
