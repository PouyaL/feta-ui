'use client'
import { motion } from 'motion/react'
import { useId, useState, type ReactNode } from 'react'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { ease } from '../../motion-tokens'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './collapsible.module.css'

const OPEN_SPRING = { type: 'spring', duration: 0.32, bounce: 0.3 } as const
const CLOSE_S = 0.22
const IN_OUT = [0.65, 0, 0.35, 1] as const
const OUT = ease.out
const CONTENT_DELAY_S = 0.08
const CONTENT_IN_S = 0.2
const CONTENT_OUT_S = 0.12
const REDUCED_FADE_S = 0.12

/** The shared height and fade. Height grows on a spring, content follows a beat later. */
export function DisclosurePanel({ open, still, animated = true, id, labelledBy, className, children }: {
  open: boolean
  still: boolean
  animated?: boolean | undefined
  id?: string | undefined
  labelledBy?: string | undefined
  className?: string | undefined
  children: ReactNode
}) {
  return (
    <motion.div
      id={id}
      role={labelledBy ? 'region' : undefined}
      aria-labelledby={labelledBy}
      aria-hidden={open ? undefined : true}
      inert={!open}
      className={cx(styles.panel, className)}
      initial={false}
      animate={{ height: open ? 'auto' : 0 }}
      transition={still ? { duration: 0 } : open ? OPEN_SPRING : { duration: CLOSE_S, ease: IN_OUT }}
    >
      <motion.div
        initial={false}
        animate={still ? { opacity: open ? 1 : 0 } : { opacity: open ? 1 : 0, y: open ? 0 : -4 }}
        transition={still ? { duration: animated ? REDUCED_FADE_S : 0 } : open ? { duration: CONTENT_IN_S, delay: CONTENT_DELAY_S, ease: OUT } : { duration: CONTENT_OUT_S, ease: IN_OUT }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

export type CollapsibleProps = {
  /** The whole bar is the trigger, not only the chevron. */
  title: ReactNode
  children: ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  animated?: boolean
  className?: string
}

/** A trigger on the Soft tray and an inset card that drops in. */
export function Collapsible({ title, children, open, defaultOpen = false, onOpenChange, disabled = false, animated = true, className }: CollapsibleProps) {
  const still = useStill(animated)
  const id = useId()
  const [held, setHeld] = useState(defaultOpen)
  const current = open ?? held

  function toggle(): void {
    setHeld(!current)
    onOpenChange?.(!current)
  }

  return (
    <div className={cx(styles.tray, className)} data-still={still ? '' : undefined} data-open={current ? '' : undefined}>
      <button type="button" id={`${id}-t`} className={styles.trigger} aria-expanded={current} aria-controls={id} disabled={disabled} onClick={toggle}>
        <span className={styles.title}>{title}</span>
        <span aria-hidden="true" className={styles.chevron}><ChevronUpIcon /></span>
      </button>
      <DisclosurePanel open={current} still={still} animated={animated} id={id} labelledBy={`${id}-t`}>
        <div className={styles.card}>{children}</div>
      </DisclosurePanel>
    </div>
  )
}

/** A label and value row with a hairline between rows, for inside the card. */
export function CollapsibleRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{children}</span>
    </div>
  )
}
