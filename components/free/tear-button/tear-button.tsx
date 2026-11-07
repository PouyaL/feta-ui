'use client'
import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRightIcon } from '@fetaui/react/rounded/arrow-right'
import { TicketIcon } from '@fetaui/react/rounded/ticket'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { spring } from '../../motion-tokens'
import { cx, kit, useStill } from '../motion-kit/motion-kit'
import styles from './tear-button.module.css'

const TEAR_AT = 44
const REACH = 72
const SWING = 14
const RESET_MS = 2400

export type TearButtonProps = {
  title?: string
  meta?: string
  tornTitle?: string
  tornMeta?: string
  tone?: 'default' | 'muted' | 'danger'
  icon?: ReactNode
  onTear?: () => void
  disabled?: boolean
  /** `false` fades the stub instead of swinging it. */
  animated?: boolean
  className?: string
}

/** A ticket you confirm by tearing off its stub. Enter tears it from the keyboard. */
export function TearButton({ title = 'Redeem ticket', meta = 'Tear the stub to confirm', tornTitle = 'Ticket redeemed', tornMeta = 'New stub in a moment', tone = 'default', icon, onTear, disabled, animated = true, className }: TearButtonProps) {
  const still = useStill(animated)
  const x = useMotionValue(0)
  const rotate = useTransform(x, [0, REACH], [0, SWING])
  const [torn, setTorn] = useState(false)
  const stub = useRef<HTMLButtonElement>(null)
  const refocus = useRef(false)

  useEffect(() => {
    if (!torn) {
      if (refocus.current) stub.current?.focus({ preventScroll: true })
      refocus.current = false
      return
    }
    const timer = setTimeout(() => { x.set(0); setTorn(false) }, RESET_MS)
    return () => clearTimeout(timer)
  }, [torn, x])

  function tear(): void {
    refocus.current = document.activeElement === stub.current
    setTorn(true)
    onTear?.()
  }

  function onDragEnd(_: unknown, info: PanInfo): void {
    if (x.get() > TEAR_AT || info.velocity.x > 600) tear()
    else if (still) x.set(0)
    else animate(x, 0, spring.tear)
  }

  return (
    <div data-tone={tone} data-torn={torn ? '' : undefined} data-disabled={disabled ? '' : undefined} className={cx(styles.ticket, className)}>
      <div className={styles.body}>
        <span className={styles.badge} aria-hidden="true">{torn ? <Tick02Icon /> : icon ?? <TicketIcon />}</span>
        <span className={styles.text} role="status" aria-live="polite">
          <span className={styles.title}>{torn ? tornTitle : title}</span>
          <span className={kit.meta}>{torn ? tornMeta : meta}</span>
        </span>
      </div>
      {torn ? (
        <motion.span
          className={styles.stub}
          data-fallen=""
          aria-hidden="true"
          initial={{ x: x.get(), rotate: rotate.get(), y: 0, opacity: 1 }}
          animate={still ? { opacity: 0 } : { y: 120, rotate: 38, opacity: 0 }}
          transition={{ duration: still ? 0.12 : 0.5, ease: 'easeIn' }}
        >
          <span className={kit.icon}><ArrowRightIcon /></span>
          Tear
        </motion.span>
      ) : (
        <motion.button
          ref={stub}
          type="button"
          aria-label={title}
          disabled={disabled}
          className={styles.stub}
          style={{ x, rotate }}
          drag={disabled ? false : 'x'}
          dragConstraints={{ left: 0, right: REACH }}
          dragElastic={0.1}
          dragMomentum={false}
          onDragEnd={onDragEnd}
          onClick={(e) => { if (e.detail === 0) tear() }}
        >
          <span className={kit.icon}><ArrowRightIcon /></span>
          Tear
        </motion.button>
      )}
    </div>
  )
}
