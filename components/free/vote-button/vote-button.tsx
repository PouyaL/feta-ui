'use client'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { motion, type HTMLMotionProps } from 'motion/react'
import { useState, type MouseEvent, type Ref } from 'react'
import { RollingText, cx, pressProps, useStill } from '../motion-kit/motion-kit'
import styles from './vote-button.module.css'

export type VoteButtonProps = Omit<HTMLMotionProps<'button'>, 'children' | 'ref'> & {
  /** The count before this person's vote. */
  count: number
  /** Controlled state. */
  voted?: boolean
  defaultVoted?: boolean
  onVotedChange?: (voted: boolean) => void
  /** What the vote is for, like Vote for dark mode. */
  label: string
  animated?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** A chevron over a count. Voting inverts the tile and rolls the count up by one. */
export function VoteButton({ count, voted, defaultVoted = false, onVotedChange, label, animated = true, disabled, className, onClick, ref, ...rest }: VoteButtonProps) {
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultVoted)
  const on = voted ?? held
  function handle(e: MouseEvent<HTMLButtonElement>): void {
    onClick?.(e)
    if (voted === undefined) setHeld(!on)
    onVotedChange?.(!on)
  }
  return (
    <motion.button
      ref={ref}
      type="button"
      aria-pressed={on}
      aria-label={`${label}, ${count + (on ? 1 : 0)} votes`}
      disabled={disabled}
      data-on={on ? '' : undefined}
      data-still={animated ? undefined : ''}
      className={cx(styles.vote, className)}
      onClick={handle}
      {...pressProps(still, disabled)}
      {...rest}
    >
      <ChevronUpIcon size={16} />
      <span className={styles.count} aria-hidden="true"><RollingText value={String(count + (on ? 1 : 0))} still={still} /></span>
    </motion.button>
  )
}
