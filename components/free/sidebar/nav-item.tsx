'use client'
import { motion } from 'motion/react'
import { useId, type MouseEvent, type ReactNode } from 'react'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { ease, scalePress, spring } from '../../motion-tokens'
import { useLabelMotion } from '../button/label-motion'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './sidebar.module.css'

const GROUP_S = 0.2

export type NavItemProps = {
  label: string
  /** `sub` sits on a rail under a parent. `trigger` is a pill that opens a menu. */
  kind?: 'item' | 'sub' | 'trigger'
  icon?: ReactNode
  count?: number | string | undefined
  /** Shows a chevron, turned when `open`. */
  chevron?: boolean
  open?: boolean
  active?: boolean
  disabled?: boolean
  href?: string | undefined
  /** Id of what the button opens, while it is open. */
  controls?: string | undefined
  /** Drops the label: the 64 wide rail. */
  rail?: boolean
  /** Shared by the items of one list, so the active surface glides between them. */
  group?: string
  animated?: boolean
  onClick?: (e: MouseEvent<HTMLElement>) => void
  className?: string
}

/** The shared navigation row. A link, or a button when it toggles something. */
export function NavItem({ label, kind = 'item', icon, count, chevron = false, open = false, active = false, disabled = false, href, controls, rail = false, group, animated = true, onClick, className }: NavItemProps) {
  const still = useStill(animated)
  const fallback = useId()
  const text = useLabelMotion(label, !still && !disabled)
  const body = (
    <>
      {active ? <motion.span {...(still ? {} : { layoutId: `${group ?? fallback}-active` })} className={styles.surface} style={{ borderRadius: 12 }} transition={spring.slide} /> : null}
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      {rail ? null : <span className={styles.label}>{text.label}</span>}
      {count === undefined ? null : <span className={styles.count} data-rail={rail ? '' : undefined}>{count}</span>}
      {chevron && !rail ? <motion.span className={styles.chevron} initial={false} animate={{ rotate: open ? 0 : 180 }} transition={{ duration: still ? 0 : GROUP_S, ease: ease.out }}><ChevronUpIcon /></motion.span> : null}
    </>
  )
  const shared = {
    className: cx(styles.item, className),
    'data-kind': kind,
    'data-active': active ? '' : undefined,
    'data-open': open ? '' : undefined,
    'data-rail': rail ? '' : undefined,
    'data-still': still ? '' : undefined,
    'aria-label': rail ? label : undefined,
    onClick,
    onPointerEnter: text.handlers.onPointerEnter,
    onPointerLeave: text.handlers.onPointerLeave,
    onPointerDown: text.handlers.onPointerDown,
    ...(still || disabled ? {} : { whileTap: { scale: scalePress } }),
    transition: spring.press,
  }
  if (href !== undefined && !disabled) return <motion.a {...shared} href={href} aria-current={active ? 'page' : undefined}>{body}</motion.a>
  return <motion.button {...shared} type="button" disabled={disabled} aria-current={active ? 'page' : undefined} aria-expanded={chevron ? open : undefined} aria-controls={controls}>{body}</motion.button>
}
