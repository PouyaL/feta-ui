'use client'
import { useId, useState } from 'react'
import { cx, kit, useStill } from '../motion-kit/motion-kit'
import styles from './color-selector.module.css'

export type ColorOption = { value: string; label: string; color: string; disabled?: boolean | undefined }

export const DEFAULT_COLORS: ColorOption[] = [
  { value: 'graphite', label: 'Graphite', color: 'var(--feta-text-strong)' },
  { value: 'sky', label: 'Sky', color: 'var(--feta-gradient-sky-to)' },
  { value: 'emerald', label: 'Emerald', color: 'var(--feta-gradient-emerald-to)' },
  { value: 'violet', label: 'Violet', color: 'var(--feta-gradient-violet-to)' },
  { value: 'orange', label: 'Orange', color: 'var(--feta-gradient-orange-to)' },
  { value: 'amber', label: 'Amber', color: 'var(--feta-gradient-amber-to)' },
]

export type ColorSelectorProps = {
  legend?: string
  options?: ColorOption[]
  value?: string | undefined
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  /** `false` shows the ring without it growing. */
  animated?: boolean
  className?: string
}

/** A single choice among color swatches, on a native radio group. */
export function ColorSelector({ legend = 'Color', options = DEFAULT_COLORS, value, defaultValue, onValueChange, disabled, animated = true, className }: ColorSelectorProps) {
  const still = useStill(animated)
  const name = useId()
  const [held, setHeld] = useState(defaultValue ?? options[0]?.value)
  const current = value ?? held
  const chosen = options.find((option) => option.value === current)

  return (
    <div role="radiogroup" aria-labelledby={`${name}-legend`} aria-disabled={disabled || undefined} data-still={still ? '' : undefined} className={cx(kit.tray, styles.tray, className)}>
      <div className={kit.trayHeader}>
        <span id={`${name}-legend`}>{legend}</span>
        <span className={kit.meta}>{chosen?.label}</span>
      </div>
      <div className={cx(kit.card, styles.body)}>
        {options.map((option) => (
          <label key={option.value} className={styles.swatch} style={{ color: option.color }}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === current}
              disabled={disabled || option.disabled}
              aria-label={option.label}
              className={styles.input}
              onChange={() => { setHeld(option.value); onValueChange?.(option.value) }}
            />
            <span className={styles.ring} aria-hidden="true" />
            <span className={styles.well} aria-hidden="true"><span className={styles.dot} /></span>
          </label>
        ))}
      </div>
    </div>
  )
}
