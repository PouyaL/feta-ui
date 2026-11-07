'use client'
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { ease, scalePress, spring } from '../../motion-tokens'
import styles from './motion-kit.module.css'

// Shared by the expressive buttons: the label swap, rolling digits, the press and the base styles.
export const kit = styles

export const cx = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(' ')

export { watchOffscreen } from './offscreen'
export { ComponentAnimation, useStill } from './use-still'

/** The shared press: 0.98 on a firm spring, off when still or disabled. */
export const pressProps = (still: boolean, disabled?: boolean, scale: number = scalePress): HTMLMotionProps<'button'> =>
  still || disabled ? {} : { whileTap: { scale }, transition: spring.press }

const SWAP = { y: 8, filter: 'blur(2px)' }

/** Labels rise 8 px with a 2 px blur. When still, they only fade. */
export function LabelSwap({ swapKey, still, children, className }: { swapKey: string; still: boolean; children: ReactNode; className?: string | undefined }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={swapKey}
        className={cx(styles.swap, className)}
        initial={still ? { opacity: 0 } : { opacity: 0, ...SWAP }}
        animate={still ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={still ? { opacity: 0 } : { opacity: 0, y: -8, filter: 'blur(2px)' }}
        transition={{ duration: still ? 0 : 0.2, ease: ease.out }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  )
}

/** Each digit rolls on its own, so only the characters that change move. */
export function RollingText({ value, still }: { value: string; still: boolean }) {
  return (
    <span className={styles.rolling}>
      <span className={styles.srOnly}>{value}</span>
      {Array.from(value).map((char, i) => (
        <span key={i} className={styles.digit} aria-hidden="true">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={char}
              className={styles.swap}
              initial={still ? { opacity: 0 } : { y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={still ? { opacity: 0 } : { y: -10, opacity: 0 }}
              transition={still ? { duration: 0 } : spring.digit}
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}

/** Text that rolls up to a copy of itself while an ancestor with `data-roll-host` is hovered or focused. Screen readers hear it once. */
export function RollText({ children, still = false, className }: { children: string; still?: boolean; className?: string | undefined }) {
  const self = useRef<HTMLSpanElement>(null)
  // A press stops the roll: the text snaps back to rest and stays still until the pointer leaves the host.
  useEffect(() => {
    const host = self.current?.closest<HTMLElement>('[data-roll-host]')
    if (!host || still) return undefined
    const press = (): void => host.setAttribute('data-roll-pressed', '')
    const leave = (): void => host.removeAttribute('data-roll-pressed')
    host.addEventListener('pointerdown', press)
    host.addEventListener('pointerleave', leave)
    host.addEventListener('blur', leave)
    return () => { host.removeEventListener('pointerdown', press); host.removeEventListener('pointerleave', leave); host.removeEventListener('blur', leave); leave() }
  }, [still])
  return (
    <span ref={self} className={cx(styles.roll, className)} data-still={still ? '' : undefined}>
      <span>{children}</span>
      <span aria-hidden="true">{children}</span>
    </span>
  )
}
