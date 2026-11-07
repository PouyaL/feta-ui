'use client'
import { motion, type HTMLMotionProps } from 'motion/react'
import type { MouseEvent, ReactNode, Ref } from 'react'
import { ArrowUpRightIcon } from '@fetaui/react/rounded/arrow-up-right'
import { spring, scalePress } from '../../motion-tokens'
import { cx, kit, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import styles from './metallic-link.module.css'

export type MetallicLinkProps = Omit<HTMLMotionProps<'a'>, 'children' | 'ref'> & {
  kind?: 'default' | 'inverted'
  children?: ReactNode
  /** Greys the link out, drops its href and ignores clicks. */
  disabled?: boolean
  /** `false` stills the turning rim, the silver face and the press scale. */
  animated?: boolean
  ref?: Ref<HTMLAnchorElement>
}

/**
 * A link styled as a pill inside a chrome rim. The rim turns at rest; hover fills the face with moving
 * silver and turns the arrow to point right.
 */
export function MetallicLink({ kind = 'default', children, disabled = false, animated = true, className, ref, href, onClick, tabIndex, ...rest }: MetallicLinkProps) {
  const still = useStill(animated) || disabled
  const block = (e: MouseEvent<HTMLAnchorElement>): void => {
    if (disabled) { e.preventDefault(); return }
    onClick?.(e)
  }
  return (
    <motion.a
      ref={ref}
      href={disabled ? undefined : href}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : tabIndex}
      data-kind={kind}
      data-still={still ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-loop=""
      className={cx(styles.link, className)}
      onClick={block}
      {...(still ? {} : { whileTap: { scale: scalePress }, transition: spring.press })}
      {...rest}
    >
      {/* The rim turns as a rotated layer, which every engine animates; Safari snaps a transitioned gradient angle. */}
      <span aria-hidden="true" ref={still ? undefined : watchOffscreen} className={styles.rim}><span className={styles.rimTurn} /></span>
      <span aria-hidden="true" className={styles.face} />
      <span className={styles.content}>{children}</span>
      <span className={cx(kit.icon, styles.content, styles.arrow)}><ArrowUpRightIcon /></span>
    </motion.a>
  )
}
