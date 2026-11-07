'use client'
import { ExclamationMarkIcon } from '@fetaui/react/rounded/exclamation-mark'
import { ArrowUpRightIcon } from '@fetaui/react/rounded/arrow-up-right'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { InfoIcon } from '@fetaui/react/rounded/info'
import { SparklesIcon } from '@fetaui/react/rounded/sparkles'
import { XIcon } from '@fetaui/react/rounded/x'
import { AnimatePresence, motion } from 'motion/react'
import { type ComponentType, type HTMLAttributes, type ReactNode, type Ref } from 'react'
import { spring } from '../../motion-tokens'
import { RollingText, cx, kit, useStill } from '../motion-kit/motion-kit'
import { Spinner } from '../spinner/spinner'
import styles from './badge.module.css'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

type Glyph = ComponentType<{ size?: number }>

/** Each tone has its own glyph, so tone is never shown by colour alone. */
const TONE_GLYPH: Record<BadgeTone, Glyph> = {
  neutral: InfoIcon, info: InfoIcon, success: CheckIcon, warning: ExclamationMarkIcon, danger: XIcon, accent: SparklesIcon,
}

const COUNT_FADE = 0.15
/** Bounce 0.25 over 600 ms, from the Badge Motion frame. */
const STATE_SPRING = { type: 'spring', duration: 0.6, bounce: 0.25 } as const

export type BadgeProps = Omit<HTMLAttributes<HTMLElement>, 'ref'> & {
  /** Sets the mark colour. The pill stays ink. Default `neutral`. */
  tone?: BadgeTone
  /** Default `soft`. */
  variant?: 'soft' | 'outline' | 'inverse' | 'ghost'
  /** Default `md`. */
  size?: 'sm' | 'md' | 'lg'
  /** `false` hides the mark for a plain category. */
  mark?: boolean
  /** Replaces the tone glyph inside the mark. */
  icon?: ReactNode
  /** Makes the badge a link, with the trailing arrow. */
  href?: string
  /** `false` turns off the fade in and tone crossfade. */
  animated?: boolean
  ref?: Ref<HTMLElement>
}

/** A short label that names a status or a category. Links when given `href`. */
export function Badge({ tone = 'neutral', variant = 'soft', size = 'md', mark = true, icon, href, animated = true, className, children, ref, ...rest }: BadgeProps) {
  const Default = TONE_GLYPH[tone]
  const props = {
    'data-tone': tone, 'data-variant': variant, 'data-size': size,
    'data-mark': mark ? '' : undefined,
    'data-still': animated ? undefined : '',
    className: cx(styles.badge, className),
    ...rest,
  }
  const content = (
    <>
      {mark ? <span className={styles.mark}>{icon ?? <Default size={12} />}</span> : null}
      <span className={styles.label}>{children}</span>
      {href ? <span className={styles.trailing}><ArrowUpRightIcon size={12} /></span> : null}
    </>
  )
  return href
    ? <a ref={ref as Ref<HTMLAnchorElement>} href={href} {...props}>{content}</a>
    : <span ref={ref as Ref<HTMLSpanElement>} {...props}>{content}</span>
}

export type BadgeCountProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /** Hides at zero. Leave it out for a dot. */
  value?: number
  /** Above this it reads `99+`. */
  max?: number
  /** Default `neutral`. Danger only when it is urgent. */
  tone?: 'neutral' | 'danger'
  /** Default `md`. */
  size?: 'sm' | 'md'
  /** The accessible name, like `3 unread messages`. */
  label: string
  animated?: boolean
}

/** Marks what is new. Digits roll in place, and it pops in and out. */
export function BadgeCount({ value, max = 99, tone = 'neutral', size = 'md', label, animated = true, className, ...rest }: BadgeCountProps) {
  const still = useStill(animated)
  const dot = value === undefined
  const shown = dot || value > 0
  const text = dot ? '' : value > max ? `${max}+` : String(value)
  return (
    <AnimatePresence initial={false}>
      {shown ? (
        <motion.span
          key="count"
          role="img"
          aria-label={label}
          data-tone={tone}
          data-size={size}
          data-dot={dot ? '' : undefined}
          className={cx(styles.count, className)}
          {...(still ? {} : { initial: { scale: 0 }, animate: { scale: 1 }, exit: { scale: 0, opacity: 0, transition: { duration: COUNT_FADE } }, transition: spring.pop })}
          {...(rest as object)}
        >
          {dot ? null : <span aria-hidden="true"><RollingText value={text} still={still} /></span>}
        </motion.span>
      ) : null}
    </AnimatePresence>
  )
}

/** Sits a Badge Count on the corner of an Icon Button or Avatar. */
export function BadgeAnchor({ badge, children }: { badge: ReactNode; children: ReactNode }) {
  return <span className={styles.anchor}>{children}<span className={styles.anchored}>{badge}</span></span>
}

export type BadgeStateKind = 'success' | 'loading' | 'error' | 'warning' | 'info' | 'action'

const STATE_GLYPH: Record<Exclude<BadgeStateKind, 'loading'>, Glyph> = {
  success: CheckIcon, error: XIcon, warning: ExclamationMarkIcon, info: InfoIcon, action: SparklesIcon,
}

const STATE_NAME: Record<BadgeStateKind, string> = {
  success: 'Success', loading: 'Loading', error: 'Error', warning: 'Warning', info: 'Info', action: 'Action',
}

export type BadgeStateProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  state: BadgeStateKind
  /** Default `md`. */
  size?: 'sm' | 'md' | 'lg'
  /** Overrides the spoken state. Pass `null` when text beside it says the same. */
  label?: string | null
  animated?: boolean
}

/** A solid status circle. The glyph swaps on a soft spring while the fill crossfades. */
export function BadgeState({ state, size = 'md', label, animated = true, className, ...rest }: BadgeStateProps) {
  const still = useStill(animated)
  const Glyph = state === 'loading' ? null : STATE_GLYPH[state]
  const name = label === undefined ? STATE_NAME[state] : label
  return (
    <span data-state={state} data-size={size} data-still={animated ? undefined : ''} className={cx(styles.state, className)} {...rest}>
      {name === null ? null : <span className={kit.srOnly}>{name}</span>}
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={state}
          aria-hidden="true"
          className={styles.stateGlyph}
          initial={still ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: 'blur(4px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0 }}
          transition={still ? { duration: animated ? 0.12 : 0 } : STATE_SPRING}
        >
          {Glyph ? <Glyph size={14} /> : <Spinner label={null} size={size === "lg" ? 18 : size === "md" ? 14 : 12} animated={animated} className={styles.stateSpinner} />}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
