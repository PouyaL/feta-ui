'use client'
import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { duration, ease } from '../../motion-tokens'
import { Button, type ButtonProps } from '../button/button'
import { DropdownMenu, type MenuEntry } from '../dropdown-menu/dropdown-menu'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './split-button.module.css'

// The root presses as one shape in CSS, so each Button's own press scale is replaced with nothing.
const NO_PRESS = {}

export type SplitButtonProps = {
  /** Default `secondary`. Primary is for the one main action in a view. */
  variant?: 'secondary' | 'outline' | 'primary'
  /** Default `md`: 28, 36, 44 on Web and 36, 44, 52 on Mobile, like Button. */
  size?: ButtonProps['size']
  /** Outer corners: `soft` keeps the Button radius, `pill` is full. Inner corners are square. */
  shape?: ButtonProps['shape']
  /** The main action's text. */
  label: string
  leadingIcon?: ReactNode
  /** The main action. */
  onClick?: () => void
  /** The chevron's accessible name. Default "More options". */
  menuLabel?: string
  /** The menu behind the chevron, in Dropdown Menu's entries model. */
  entries: MenuEntry[]
  /** Which edge of the whole control the menu lines up with. Default `end`, under the chevron. */
  align?: 'start' | 'end'
  /** Async state of the main action, as on Button. The width holds while it is not `idle`. */
  status?: ButtonProps['status']
  loadingLabel?: ReactNode
  successLabel?: ReactNode
  /** Fires when the 1.6 s success hold ends: set `status` back to `idle` here. */
  onSuccessEnd?: () => void
  /** Disables both segments. */
  disabled?: boolean
  /** `false` turns off the press scale, the label motion, the chevron turn and the menu scale. */
  animated?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

/** A main action and a chevron that opens a menu of related ones, joined into one control by a 1 px divider. */
export function SplitButton({
  variant = 'secondary', size = 'md', shape = 'soft', label, leadingIcon, onClick, menuLabel = 'More options', entries, align = 'end',
  status = 'idle', loadingLabel, successLabel, onSuccessEnd, disabled = false, animated = true, open, onOpenChange, className,
}: SplitButtonProps) {
  const still = useStill(animated)
  const [held, setHeld] = useState(false)
  const shown = open ?? held
  const set = (next: boolean): void => { setHeld(next); onOpenChange?.(next) }

  return (
    <div
      role="group"
      aria-label={label}
      className={cx(styles.root, className)}
      data-variant={variant}
      data-size={size}
      data-shape={shape}
      data-disabled={disabled ? '' : undefined}
      data-still={still ? '' : undefined}
    >
      <DropdownMenu
        entries={entries}
        label={menuLabel}
        align={align}
        open={shown}
        onOpenChange={set}
        animated={animated}
        className={cx(styles.menu)}
        trigger={(trigger) => (
          <>
            <Button
              variant={variant}
              size={size}
              shape={shape}
              status={status}
              loadingLabel={loadingLabel}
              successLabel={successLabel}
              {...(onSuccessEnd ? { onSuccessEnd } : {})}
              leadingIcon={leadingIcon}
              disabled={disabled}
              animated={animated}
              className={cx(styles.segment, styles.main)}
              whileTap={NO_PRESS}
              onClick={() => {
                if (shown) set(false)
                onClick?.()
              }}
            >
              {label}
            </Button>
            <Button
              {...trigger}
              variant={variant}
              size={size}
              shape={shape}
              disabled={disabled}
              animated={animated}
              aria-label={menuLabel}
              className={cx(styles.segment, styles.chevron)}
              whileTap={NO_PRESS}
              leadingIcon={
                <motion.span
                  className={styles.turn}
                  initial={false}
                  animate={{ rotate: shown ? 0 : 180 }}
                  transition={{ duration: still ? 0 : duration.lift, ease: ease.out }}
                >
                  <ChevronUpIcon />
                </motion.span>
              }
            />
          </>
        )}
      />
    </div>
  )
}
