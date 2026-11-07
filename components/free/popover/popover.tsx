'use client'
import { motion, type MotionStyle } from 'motion/react'
import { cloneElement, useCallback, useEffect, useId, useRef, useState, type HTMLAttributes, type MouseEvent, type ReactElement, type ReactNode, type Ref } from 'react'
import { duration } from '../../motion-tokens'
import { useLabelMotion } from '../button/label-motion'
import { cx, kit, useStill } from '../motion-kit/motion-kit'
import { Floating, Nub, towardTrigger, type Align, type Side } from './floating'
import styles from './popover.module.css'

const OFFSET = 10
const NUB_INSET = 24
/** Spring 0.3 over the 180 ms open. */
const OPEN = { type: 'spring', duration: duration.open, bounce: 0.3 } as const
const CLOSE = { duration: duration.close, ease: [0.4, 0, 1, 1] } as const

export type PopoverTriggerProps = Omit<HTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** The label. */
  children: ReactNode
  /** Lead icon, 16 px. */
  icon?: ReactNode
  disabled?: boolean
  animated?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** The pill that opens anchored context. Any button can open a Popover; this one has an Open state. */
export function PopoverTrigger({ children, icon, disabled, animated = true, className, onPointerEnter, onPointerLeave, onPointerDown, onKeyDown, ref, ...rest }: PopoverTriggerProps) {
  const still = useStill(animated)
  const label = useLabelMotion(typeof children === 'string' ? children : null, !disabled && !still)
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={cx(kit.control, styles.trigger, className)}
      data-still={still ? '' : undefined}
      {...rest}
      onPointerEnter={(e) => { onPointerEnter?.(e); label.handlers.onPointerEnter(e) }}
      onPointerLeave={(e) => { onPointerLeave?.(e); label.handlers.onPointerLeave() }}
      onPointerDown={(e) => { onPointerDown?.(e); label.handlers.onPointerDown(e) }}
      onKeyDown={(e) => { onKeyDown?.(e); label.handlers.onKeyDown(e) }}
    >
      {icon ? <span className={kit.icon}>{icon}</span> : null}
      <span>{label.label ?? children}</span>
    </button>
  )
}

type TriggerProps = HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }

export type PopoverProps = {
  /** The element that opens it: PopoverTrigger, Button or anything clickable. */
  trigger: ReactElement<TriggerProps>
  /** Bold first line. It also names the panel. */
  title?: ReactNode
  description?: ReactNode
  /** The panel's name when there is no `title`. */
  label?: string
  children?: ReactNode
  /** Actions at the bottom of the card. */
  footer?: ReactNode
  /** Flips when there is no room. Default `bottom`. */
  side?: Side
  /** Which edges line up. Default `center`. */
  align?: Align
  /** Panel width on Web. 280 to 300 in the spec. Mobile is 320. Default `280`. */
  width?: number
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** `false` turns off the open and close motion. */
  animated?: boolean
  className?: string
}

/** Anchored context with a nub. Stays open until an outside click, Esc or the trigger again. */
export function Popover({ trigger, title, description, label, children, footer, side = 'bottom', align = 'center', width = 280, open: controlled, defaultOpen = false, onOpenChange, animated = true, className }: PopoverProps) {
  const still = useStill(animated)
  const id = useId()
  const [inner, setInner] = useState(defaultOpen)
  const open = controlled ?? inner
  const anchor = useRef<HTMLElement | null>(null)
  const panel = useRef<HTMLDivElement | null>(null)

  function set(next: boolean): void {
    setInner(next)
    onOpenChange?.(next)
  }
  const dismiss = useRef(set)
  useEffect(() => { dismiss.current = set })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      dismiss.current(false)
      anchor.current?.focus({ preventScroll: true })
    }
    const onPointer = (e: PointerEvent): void => {
      if (!(e.target instanceof Node)) return
      if (panel.current?.contains(e.target) || anchor.current?.contains(e.target)) return
      dismiss.current(false)
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  // Stable, so a re-render never pulls focus back out of a field. The measuring pass is skipped.
  const attach = useCallback((node: HTMLDivElement | null): void => {
    panel.current = node
    if (node && !node.parentElement?.hasAttribute('aria-hidden')) node.focus({ preventScroll: true })
  }, [])

  const child = trigger.props
  const opener = cloneElement(trigger, {
    ref: (node: HTMLElement | null) => {
      anchor.current = node
      if (typeof child.ref === 'function') child.ref(node)
      else if (child.ref) child.ref.current = node
    },
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
    onClick: (e: MouseEvent<HTMLElement>) => { child.onClick?.(e); set(!open) },
  } as TriggerProps)

  return (
    <>
      {opener}
      <Floating anchor={anchor} open={open} side={side} align={align} offset={OFFSET} nubInset={NUB_INSET} className={styles.host}>
        {(placed) => (
          <motion.div
            key="panel"
            ref={attach}
            id={id}
            role="dialog"
            aria-label={label}
            aria-labelledby={title && !label ? `${id}-title` : undefined}
            aria-describedby={description ? `${id}-description` : undefined}
            tabIndex={-1}
            data-still={still ? '' : undefined}
            className={cx(styles.panel, className)}
            style={{ '--panel-width': `${width}px` } as MotionStyle}
            initial={still ? false : { opacity: 0, scale: 0.96, ...towardTrigger(placed, 6) }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.98, transition: CLOSE }}
            transition={OPEN}
          >
            <div className={styles.body}>
              {title ? <p id={`${id}-title`} className={styles.title}>{title}</p> : null}
              {description ? <p id={`${id}-description`} className={styles.description}>{description}</p> : null}
              {children}
              {footer ? <div className={styles.footer}>{footer}</div> : null}
            </div>
            <Nub />
          </motion.div>
        )}
      </Floating>
    </>
  )
}

