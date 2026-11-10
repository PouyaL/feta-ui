'use client'
import { useRef, useState } from 'react'
import { LoaderIcon } from '@fetaui/react/rounded/loader'
import { SearchIcon } from '@fetaui/react/rounded/search'
import { XIcon } from '@fetaui/react/rounded/x'
import { form } from '../form-kit/form-kit'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './search-styles'
import { useFocusShortcut } from './use-focus-shortcut'

export type SearchFieldProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  /** Swaps the search icon for a spinner. */
  loading?: boolean
  /** Shows ⌘ K at rest and focuses the field on that key. With several fields on a page, the newest visible one takes it. */
  shortcut?: boolean
  disabled?: boolean
  'aria-label'?: string
  animated?: boolean
  className?: string
}

/** A search pill. Rest shows the shortcut; focus shows esc; typing shows a clear button. */
export function SearchField({ value, defaultValue = '', onValueChange, placeholder = 'Search', loading, shortcut = true, disabled, 'aria-label': label = 'Search', animated = true, className }: SearchFieldProps) {
  const still = useStill(animated)
  const input = useRef<HTMLInputElement>(null)
  const [held, setHeld] = useState(defaultValue)
  const [focused, setFocused] = useState(false)
  const text = value ?? held
  const set = (next: string): void => { setHeld(next); onValueChange?.(next) }

  useFocusShortcut(input, shortcut)

  return (
    <div className={cx(form.pill, styles.field, className)} data-disabled={disabled ? '' : undefined} data-still={still ? '' : undefined}>
      <span className={form.quiet}>{loading ? <span className={styles.spin}><LoaderIcon trigger="none" /></span> : <SearchIcon trigger="none" />}</span>
      <input
        ref={input}
        type="search"
        role="searchbox"
        aria-label={label}
        className={cx(form.entry, styles.entry)}
        placeholder={placeholder}
        disabled={disabled ?? false}
        value={text}
        onChange={(e) => set(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') { set(''); input.current?.blur() } }}
      />
      {text ? <IconButton variant="ghost" size="sm" animated={animated} label="Clear" disabled={disabled ?? false} icon={<XIcon trigger="none" />} className={styles.clear} onClick={() => { set(''); input.current?.focus() }} /> : null}
      {!text && shortcut ? <kbd className={styles.kbd}>{focused ? 'esc' : '⌘ K'}</kbd> : null}
    </div>
  )
}
