'use client'
import { motion } from 'motion/react'
import { useEffect, useId, useState, type ComponentProps, type ReactNode } from 'react'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { InformationCircleIcon } from '@fetaui/react/rounded/information-circle'
import { duration, ease, spring } from '../../motion-tokens'
import { cx, RollingText, useStill } from '../motion-kit/motion-kit'
import styles from './label.module.css'

const HINT_DELAY_MS = 300
/** The focus dot (6) and its gap (6). */
const FOCUS_SHIFT = 12

export type LabelProps = Omit<ComponentProps<'label'>, 'children'> & {
  children: ReactNode
  /** Danger asterisk. Set `required` on the control too. */
  required?: boolean
  /** A tertiary word after the name: Optional, Locked. */
  optional?: string
  /** Opens a tooltip from an info icon, and reads as a description. */
  hint?: string
  /** A 5% chip for New or Beta. */
  badge?: string
  /** A link on the right, like Forgot? */
  action?: { label: string; href?: string; onClick?: () => void }
  /** A mono count on the right. Turns danger past `max`. */
  count?: { value: number; max: number }
  /** Follows the control: a dot grows in while it has focus. */
  focused?: boolean
  invalid?: boolean
  disabled?: boolean
  /** Change this number to shake the row once, on a failed submit. */
  shake?: number
  animated?: boolean
}

/** The name of a control. A click on it focuses the control. */
export function Label({ children, required, optional, hint, badge, action, count, focused, invalid, disabled, shake = 0, animated = true, className, ...rest }: LabelProps) {
  const still = useStill(animated)
  const hintId = useId()
  const [tip, setTip] = useState(false)
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    if (!waiting) return
    const timer = setTimeout(() => setTip(true), HINT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [waiting])

  const over = count ? count.value > count.max : false

  return (
    <motion.div
      key={shake}
      className={cx(styles.row, className)}
      data-invalid={invalid ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-still={still ? '' : undefined}
      {...(shake && !still ? { animate: { x: [0, 3, -3, 0] }, transition: { duration: duration.shake, ease: ease.out } } : {})}
    >
      <motion.span
        className={styles.dot}
        aria-hidden="true"
        initial={false}
        animate={{ scale: focused ? 1 : 0 }}
        transition={still ? { duration: 0 } : spring.pop}
      />
      {/* Focus slides the name and its tags over by the dot and a gap, as a transform. */}
      <motion.span className={styles.lead} initial={false} animate={{ x: focused ? FOCUS_SHIFT : 0 }} transition={still ? { duration: 0 } : spring.pop}>
      <label className={styles.name} {...rest}>
        {children}
        {required ? <span className={styles.asterisk} aria-hidden="true">*</span> : null}
      </label>
      {optional ? <span className={styles.optional}>{optional}</span> : null}
      {badge ? <span className={styles.badge}>{badge}</span> : null}
      {hint ? (
        <span className={styles.hint}>
          <button
            type="button"
            className={styles.hintButton}
            aria-label="More information"
            aria-describedby={hintId}
            onPointerEnter={() => setWaiting(true)}
            onPointerLeave={() => { setWaiting(false); setTip(false) }}
            onFocus={() => setTip(true)}
            onBlur={() => setTip(false)}
          >
            <InformationCircleIcon />
          </button>
          <span id={hintId} role="tooltip" className={styles.tip} data-open={tip ? '' : undefined}>{hint}</span>
        </span>
      ) : null}
      </motion.span>
      {action ? (action.href
        ? <a className={styles.action} href={action.href} onClick={action.onClick}>{action.label}</a>
        : <button type="button" className={styles.action} onClick={action.onClick}>{action.label}</button>) : null}
      {count ? (
        <span className={styles.count} data-over={over ? '' : undefined}>
          <RollingText value={String(count.value)} still={still} />/{count.max}
        </span>
      ) : null}
      {invalid ? <span className={styles.alert} aria-hidden="true"><AlertCircleIcon trigger="none" /></span> : null}
    </motion.div>
  )
}
