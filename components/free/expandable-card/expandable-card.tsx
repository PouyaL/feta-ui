'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { ArrowUpRightIcon } from '@fetaui/react/rounded/arrow-up-right'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { Button } from '../button/button'
import { Checkbox } from '../checkbox/checkbox'
import { DisclosurePanel } from '../collapsible/collapsible'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './expandable-card.module.css'

const MARK_SPRING = { type: 'spring', duration: 0.24, bounce: 0.3 } as const
const RING_SIZE = 28
const RING_STROKE = 3
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

export type ExpandableStep = { id: string; label: string; meta?: string }

export type ExpandableCardProps = {
  title: ReactNode
  /** Everything being tracked. The ring and count follow how many are checked. */
  total: number
  /** Steps still open, shown with checkboxes. */
  steps: ExpandableStep[]
  /** Items already done outside `steps`. */
  completed?: number
  heading?: ReactNode
  body?: ReactNode
  completeHeading?: ReactNode
  completeBody?: ReactNode
  /** The action shown once every step is done. */
  actionLabel?: string
  onAction?: () => void
  defaultOpen?: boolean
  animated?: boolean
  className?: string
}

/** A task summary that opens into steps. The ring fills as they are checked, then turns to a mark. */
export function ExpandableCard({ title, total, steps, completed = 0, heading, body, completeHeading = 'Ready to publish', completeBody, actionLabel = 'Publish release', onAction, defaultOpen = false, animated = true, className }: ExpandableCardProps) {
  const still = useStill(animated)
  const id = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [checked, setChecked] = useState<string[]>([])
  const fromStep = useRef(false)
  const done = Math.min(total, completed + checked.length)
  const complete = done >= total

  return (
    <div className={cx(styles.tray, className)} data-open={open ? '' : undefined} data-still={still ? '' : undefined}>
      <button type="button" id={`${id}-t`} className={styles.trigger} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span className={styles.ring}>
          <AnimatePresence initial={false} mode="popLayout">
            {complete ? (
              <motion.span key="mark" className={styles.mark} initial={still ? { opacity: 0 } : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={still ? { duration: 0 } : MARK_SPRING}><Tick02Icon /></motion.span>
            ) : (
              <motion.svg key="ring" aria-hidden="true" width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}>
                <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} className={styles.ringTrack} strokeWidth={RING_STROKE} />
                <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} className={styles.ringArc} strokeWidth={RING_STROKE} strokeDasharray={RING_LENGTH} strokeDashoffset={RING_LENGTH * (1 - done / total)} />
              </motion.svg>
            )}
          </AnimatePresence>
        </span>
        <span className={styles.summary}>
          <span className={styles.title}>{title}</span>
          <span className={styles.meta}>{done} of {total} items complete</span>
        </span>
        <span aria-hidden="true" className={styles.chevron}><ChevronUpIcon /></span>
      </button>
      <DisclosurePanel open={open} still={still} animated={animated} id={id} labelledBy={`${id}-t`}>
        <div className={styles.card}>
          <p className={styles.heading}>{complete ? completeHeading : heading}</p>
          {complete ? (completeBody ? <p className={styles.body}>{completeBody}</p> : null) : body ? <p className={styles.body}>{body}</p> : null}
          {complete ? (
            <motion.div ref={(node) => { if (node && fromStep.current) { fromStep.current = false; node.querySelector('button')?.focus() } }} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }}><Button shape="pill" size="sm" animated={animated} trailingIcon={<ArrowUpRightIcon />} onClick={onAction}>{actionLabel}</Button></motion.div>
          ) : (
            <ul className={styles.steps}>
              {steps.map((step) => (
                <li key={step.id} className={styles.step}>
                  <Checkbox aria-label={step.label} animated={animated} checked={checked.includes(step.id)} onCheckedChange={(on) => { fromStep.current = true; setChecked((list) => (on ? [...list, step.id] : list.filter((id) => id !== step.id))) }} />
                  <span className={styles.stepText}><span className={styles.stepLabel}>{step.label}</span>{step.meta ? <span className={styles.stepMeta}>{step.meta}</span> : null}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DisclosurePanel>
      <span role="status" className={styles.srOnly}>{done} of {total} items complete</span>
    </div>
  )
}
