'use client'
import { motion } from 'motion/react'
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { spring } from '../../motion-tokens'
import { useStill } from '../motion-kit/use-still'
import { Toggle } from '../toggle/toggle'
import { rovingTarget } from './roving'
import styles from './toggle-group.module.css'

export type ToggleGroupItem = {
  value: string
  /** Visible text. Leave it out for an icon only toggle and pass `ariaLabel`. */
  label?: string
  icon?: ReactNode
  ariaLabel?: string
  disabled?: boolean
}

type Shared = {
  /** The group's accessible name. */
  label: string
  items: ToggleGroupItem[]
  /** `segment` lifts onto a tray; `outline` spaces Outline toggles 4 apart. Default `segment`. */
  appearance?: 'segment' | 'outline'
  orientation?: 'horizontal' | 'vertical'
  disabled?: boolean
  /** `false` turns off the press scale and the sliding lift. */
  animated?: boolean
  className?: string
}

export type ToggleGroupProps = Shared & (
  | { type: 'single'; value?: string | null; defaultValue?: string | null; onValueChange?: (value: string) => void }
  | { type: 'multiple'; value?: string[]; defaultValue?: string[]; onValueChange?: (value: string[]) => void }
)

/** Toggles in a group. Single choice keeps one on; multiple choice allows none. */
export function ToggleGroup(props: ToggleGroupProps) {
  const { label, items, appearance = 'segment', orientation = 'horizontal', disabled, animated = true, className } = props
  const still = useStill(animated)
  const id = useId()
  const [heldOne, setHeldOne] = useState(props.type === 'single' ? props.defaultValue ?? null : null)
  const [heldMany, setHeldMany] = useState(props.type === 'multiple' ? props.defaultValue ?? [] : [])
  const [focused, setFocused] = useState<string | null>(null)

  const single = props.type === 'single'
  const selected: string[] = props.type === 'single'
    ? [props.value === undefined ? heldOne : props.value].filter((v): v is string => v !== null)
    : props.value ?? heldMany
  const enabled = items.filter((item) => !item.disabled)
  const stop = [focused, ...selected, enabled[0]?.value].find((value) => enabled.some((item) => item.value === value))
  const slides = single && appearance === 'segment' && !still

  function choose(value: string): void {
    if (props.type === 'single') {
      setHeldOne(value)
      props.onValueChange?.(value)
    } else {
      const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
      setHeldMany(next)
      props.onValueChange?.(next)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>): void {
    const next = rovingTarget(e)
    if (!next) return
    e.preventDefault()
    next.focus()
    // Single choice follows focus, as a radio group does.
    if (single) next.click()
  }

  return (
    <div
      role={single ? 'radiogroup' : 'toolbar'}
      aria-label={label}
      aria-orientation={single ? undefined : orientation}
      data-roving-group=""
      data-appearance={appearance}
      data-orientation={orientation}
      className={[styles.group, className].filter(Boolean).join(' ')}
    >
      {items.map((item) => {
        const on = selected.includes(item.value)
        return (
          <Toggle
            key={item.value}
            appearance={appearance}
            icon={item.icon}
            pressed={on}
            animated={animated}
            disabled={disabled || item.disabled}
            aria-label={item.ariaLabel}
            role={single ? 'radio' : undefined}
            tabIndex={item.value === stop ? 0 : -1}
            data-roving=""
            data-slides={slides ? '' : undefined}
            underlay={slides && on ? <motion.span layoutId={`${id}-lift`} className={styles.lift} transition={spring.toggle} /> : null}
            onPressedChange={() => { if (!single || !on) choose(item.value) }}
            onFocus={() => setFocused(item.value)}
            onKeyDown={onKeyDown}
          >
            {item.label}
          </Toggle>
        )
      })}
    </div>
  )
}

/** Floating surface for groups of toggles, split by `ToggleToolbarSeparator`. */
export function ToggleToolbar({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div role="group" aria-label={label} className={[styles.toolbar, className].filter(Boolean).join(' ')}>{children}</div>
}

export const ToggleToolbarSeparator = () => <span aria-hidden="true" className={styles.separator} />
