'use client'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { ExclamationMarkIcon } from '@fetaui/react/rounded/exclamation-mark'
import { InfoIcon } from '@fetaui/react/rounded/info'
import { SparklesIcon } from '@fetaui/react/rounded/sparkles'
import { XIcon } from '@fetaui/react/rounded/x'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState, type ComponentType, type HTMLAttributes, type ReactNode } from 'react'
import { ease } from '../../motion-tokens'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './alert.module.css'
import { useCountdown } from './use-countdown'
import { useSwipe } from './use-swipe'

export type AlertTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

/** Tone is never colour alone: each one has its own glyph. */
const GLYPH: Record<AlertTone, ComponentType<{ size?: number }>> = {
  neutral: InfoIcon, info: InfoIcon, success: CheckIcon, warning: ExclamationMarkIcon, danger: XIcon, accent: SparklesIcon,
}

const ENTER_S = 0.22
const EXIT_S = 0.12
const BANNER_S = 0.26
const REDUCED_S = 0.12
const BADGE_DELAY_S = 0.06
const BADGE_SPRING = { type: 'spring', stiffness: 500, damping: 26, delay: BADGE_DELAY_S } as const
const TIMER_MS = 6000
const SWIPE_SHARE = 0.3

export type AlertBadgeProps = { tone?: AlertTone; size?: 'sm' | 'md' | 'lg'; animated?: boolean; className?: string | undefined }

/** A solid circle with a white glyph, 20, 24 or 32 px. */
export function AlertBadge({ tone = 'neutral', size = 'md', animated = true, className }: AlertBadgeProps) {
  const still = useStill(animated)
  const Glyph = GLYPH[tone]
  return (
    <motion.span
      aria-hidden="true"
      data-tone={tone}
      data-size={size}
      className={cx(styles.badge, className)}
      initial={still ? false : { scale: 0.6 }}
      animate={{ scale: 1 }}
      transition={still ? { duration: 0 } : BADGE_SPRING}
    >
      <Glyph size={16} />
    </motion.span>
  )
}

export type AlertAction = { label: string; onClick?: () => void; loading?: boolean; disabled?: boolean }

export type AlertProps = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationEnd'> & {
  /** Card is the default, Inline sits in content, Banner runs across the page. */
  variant?: 'card' | 'inline' | 'banner'
  /** Default `neutral`. */
  tone?: AlertTone
  title: ReactNode
  description?: ReactNode
  /** One action. Ignored on Inline. */
  action?: AlertAction
  /** Shows the dismiss button. */
  dismissible?: boolean
  onDismiss?: () => void
  /** Auto dismiss after 6 s, or this many ms. Never applies to Danger or Warning. */
  timer?: boolean | number
  animated?: boolean
}

/** Finds what focus should land on after the alert leaves. */
function nextFocusable(from: HTMLElement): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
  return all.find((node) => !from.contains(node) && Boolean(from.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) ?? null
}

/** A callout that asks for attention without taking over the page. */
export function Alert({ variant = 'card', tone = 'neutral', title, description, action, dismissible = false, onDismiss, timer = false, animated = true, className, ...rest }: AlertProps) {
  const still = useStill(animated)
  const [open, setOpen] = useState(true)
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const paused = hover || focus
  const root = useRef<HTMLDivElement>(null)
  const urgent = tone === 'danger' || tone === 'warning'
  const ms = timer && !urgent ? (typeof timer === 'number' ? timer : TIMER_MS) : null

  function dismiss(): void {
    const inside = root.current?.contains(document.activeElement)
    const next = inside && root.current ? nextFocusable(root.current) : null
    setOpen(false)
    next?.focus()
    onDismiss?.()
  }

  useCountdown(open ? ms : null, paused, dismiss)
  const swipe = useSwipe(variant === 'card', SWIPE_SHARE, still, dismiss)
  const banner = variant === 'banner'
  const enter = still ? { opacity: 0 } : banner ? { y: '-100%' } : { opacity: 0, y: -8, scale: 0.98 }
  const Glyph = GLYPH[tone]

  return (
    <AnimatePresence initial={animated}>
      {open ? (
        <motion.div
          ref={root}
          role={urgent ? 'alert' : 'status'}
          data-variant={variant}
          data-tone={tone}
          className={cx(styles.alert, className)}
          initial={enter}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={still ? { opacity: 0 } : { opacity: 0, scale: 0.98, transition: { duration: EXIT_S, ease: ease.sheen } }}
          transition={{ duration: !animated ? 0 : still ? REDUCED_S : banner ? BANNER_S : ENTER_S, ease: ease['out-soft'] }}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
          onFocusCapture={() => setFocus(true)}
          onBlurCapture={() => setFocus(false)}
          {...(rest as object)}
          {...swipe.props}
        >
          {ms === null ? null : <span data-keep-motion="" data-still={animated ? undefined : ''} data-paused={paused ? '' : undefined} className={styles.timer} style={{ animationDuration: `${ms}ms` }} />}
          {variant === 'card' ? <AlertBadge tone={tone} animated={animated} className={styles.lead} /> : null}
          {variant === 'inline' ? <span className={styles.icon} aria-hidden="true"><Glyph size={16} /></span> : null}
          <div className={styles.text}>
            {banner ? <p className={styles.line}><strong>{title}</strong>{description ? <span> · {description}</span> : null}</p> : (
              <>
                <div className={styles.title}>{title}</div>
                {description ? <div className={styles.description}>{description}</div> : null}
              </>
            )}
          </div>
          {action && variant !== 'inline' ? (
            <div className={styles.action}>
              <Button variant="secondary" size="sm" status={action.loading ? 'loading' : 'idle'} {...(action.disabled ? { disabled: true } : {})} {...(action.onClick ? { onClick: action.onClick } : {})} animated={animated}>{action.label}</Button>
            </div>
          ) : null}
          {dismissible ? <IconButton className={styles.dismiss} variant="ghost" size="sm" icon={<XIcon />} label="Dismiss" onClick={dismiss} animated={animated} /> : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
