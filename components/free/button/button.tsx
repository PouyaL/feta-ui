'use client'
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react'
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type Ref } from 'react'
import { LoaderIcon } from '@fetaui/react/rounded/loader'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { delay, duration, ease, scalePress, spring } from '../../motion-tokens'
import styles from './button.module.css'
import { useStill } from '../motion-kit/use-still'
import { useLabelMotion } from './label-motion'

export type ButtonProps = Omit<HTMLMotionProps<'button'>, 'children' | 'ref'> & {
  /** One Primary per view. Default `primary`. */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
  /** Default `md`: 28, 36, 44 on Web and 36, 44, 52 on Mobile. */
  size?: 'sm' | 'md' | 'lg'
  /** `pill` is for marketing and hero actions. Default `soft`. */
  shape?: 'soft' | 'pill'
  /** Async state. The width stays locked while it is not `idle`. */
  status?: 'idle' | 'loading' | 'success'
  /** Label shown while loading. Defaults to the children. */
  loadingLabel?: ReactNode
  /** Label shown on success. Defaults to the children. */
  successLabel?: ReactNode
  /** Fires when the success hold ends (1.6 s): set `status` back to `idle` here. */
  onSuccessEnd?: () => void
  /** One-shot actions without their own state: a click runs `onClick`, shows `loading` (when given) for `loadingMs`, then `success` for 1.6 s. Ignored while `status` is passed. */
  feedback?: { loading?: ReactNode; success: ReactNode; loadingMs?: number }
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  /** A key hint such as `⌘K`. Web only. */
  shortcut?: string
  /** Renders a real link with the same look, so opening in a new tab works. */
  href?: string
  /** `false` turns off the press scale, the label motion and the spinner. */
  animated?: boolean
  children?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'primary', size = 'md', shape = 'soft', status: statusProp, loadingLabel, successLabel, onSuccessEnd, feedback,
  leadingIcon, trailingIcon, shortcut, href, animated = true, children, className, style, disabled, onClick, onPointerEnter, onPointerLeave, onPointerDown, onKeyDown, type = 'button', ref, ...rest
}: ButtonProps) {
  const inner = useRef<HTMLButtonElement>(null)
  const width = useRef<number>(0)
  const still = useStill(animated)
  // Self-run feedback for one-shot actions; a passed `status` always wins.
  const [auto, setAuto] = useState<'idle' | 'loading' | 'success'>('idle')
  const feedbackOn = feedback !== undefined && statusProp === undefined
  const status = statusProp ?? (feedbackOn ? auto : 'idle')
  const busy = status !== 'idle'
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(loadTimer.current), [])
  const inert = busy || Boolean(href && disabled)
  useImperativeHandle(ref, () => inner.current as HTMLButtonElement, [])

  // Measured at rest, so the async states never move the layout around the button.
  useLayoutEffect(() => {
    if (!busy && inner.current) width.current = inner.current.offsetWidth
  })

  // Held in a ref, so an inline callback does not restart the hold on each parent render.
  const successEnd = useRef(onSuccessEnd)
  successEnd.current = onSuccessEnd
  useEffect(() => {
    if (status !== 'success') return
    const timer = setTimeout(() => { successEnd.current?.(); setAuto('idle') }, delay.reset * 1000)
    return () => clearTimeout(timer)
  }, [status])

  const motionLabel = useLabelMotion(status === 'idle' && typeof children === 'string' ? children : null, !disabled && !still)

  const label = status === 'loading' ? (loadingLabel ?? (feedbackOn ? feedback?.loading : undefined) ?? children) : status === 'success' ? (successLabel ?? (feedbackOn ? feedback?.success : undefined) ?? children) : children
  const press = (e: MouseEvent<HTMLButtonElement>): void => {
    onClick?.(e)
    if (!feedbackOn || e.defaultPrevented) return
    const wait = feedback?.loadingMs ?? (feedback?.loading ? 700 : 0)
    if (wait <= 0) { setAuto('success'); return }
    setAuto('loading')
    loadTimer.current = setTimeout(() => setAuto('success'), wait)
  }
  const lead =
    status === 'loading' ? <span className={styles.spin}><LoaderIcon trigger="none" /></span>
    : status === 'success' ? <motion.span className={styles.tick} initial={still ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={spring.settle}><Tick02Icon trigger="inView" speed={2} /></motion.span>
    : leadingIcon

  // One element type for Motion: a link only swaps the tag and its own attributes.
  const Control = (href ? motion.a : motion.button) as typeof motion.button

  return (
    <Control
      ref={inner}
      {...(href ? (disabled ? { role: 'link' } : { href }) : { type, disabled })}
      aria-busy={status === 'loading' || undefined}
      aria-disabled={inert || undefined}
      data-variant={variant}
      data-size={size}
      data-shape={shape}
      data-status={status}
      data-still={still ? '' : undefined}
      className={[styles.button, className].filter(Boolean).join(' ')}
      style={{ ...style, ...(busy && width.current ? { minWidth: width.current } : {}) }}
      onClick={inert ? (e: MouseEvent<HTMLButtonElement>) => e.preventDefault() : feedbackOn ? press : onClick}
      onPointerEnter={(e: PointerEvent<HTMLButtonElement>) => {
        onPointerEnter?.(e)
        motionLabel.handlers.onPointerEnter(e)
      }}
      onPointerLeave={(e: PointerEvent<HTMLButtonElement>) => {
        onPointerLeave?.(e)
        motionLabel.handlers.onPointerLeave()
      }}
      onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
        onPointerDown?.(e)
        motionLabel.handlers.onPointerDown(e)
      }}
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(e)
        motionLabel.handlers.onKeyDown(e)
      }}
      {...(still || disabled || busy ? {} : { whileTap: { scale: scalePress } })}
      transition={spring.press}
      {...rest}
    >
      {lead ? <span className={styles.icon}>{lead}</span> : null}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status}
          className={styles.label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: still ? 0 : duration.base, ease: ease['out-soft'] }}
        >
          {motionLabel.label ?? label}
        </motion.span>
      </AnimatePresence>
      {shortcut && !busy ? <kbd className={styles.kbd}>{shortcut}</kbd> : null}
      {trailingIcon && !busy ? <span className={styles.icon}>{trailingIcon}</span> : null}
    </Control>
  )
}
