'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ArrowUpRightIcon } from '@fetaui/react/rounded/arrow-up-right'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { ease, spring } from '../../motion-tokens'
import { Badge } from '../badge/badge'
import { Button } from '../button/button'
import { Card } from '../card/card'
import { RollingText, cx, useStill } from '../motion-kit/motion-kit'
import styles from './promo-card.module.css'

/** Offer to claimed crossfade: 240 ms. */
const CLAIM_FADE = 0.24

const clock = (seconds: number): string => [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map((part) => String(part).padStart(2, '0')).join(':')

export type PromoState = 'default' | 'ending' | 'claimed'

export type PromoCardProps = {
  /** The product on the tray. */
  brand: ReactNode
  /** The tag beside the brand. Default `Pro`. */
  tag?: string
  /** Shown on the tray. */
  price?: string
  title?: ReactNode
  description?: ReactNode
  /** The quiet line under the description. */
  meta?: ReactNode
  /** The action on `default`. */
  actionLabel?: string
  state?: PromoState
  defaultState?: PromoState
  onStateChange?: (state: PromoState) => void
  /** Seconds left on `ending`. Keep Ending to the last 24 hours. */
  endsIn?: number
  /** The price after the offer ends. */
  laterPrice?: string
  laterLabel?: string
  endingActionLabel?: string
  claimedTitle?: ReactNode
  claimedDescription?: ReactNode
  claimedMeta?: ReactNode
  claimedActionLabel?: string
  /** The tray label on `claimed`. */
  claimedLabel?: string
  /** The main action. On `ending`, the card moves to `claimed` afterwards unless `state` is controlled. */
  onAction?: () => void
  /** The action on `claimed`. */
  onClaimedAction?: () => void
  /** Fires when the countdown reaches zero. The card then returns to `default` unless `state` is controlled. */
  onExpire?: () => void
  /** `false` turns off the arrow, the rolling digits and the crossfade. */
  animated?: boolean
  className?: string
}

/** One offer in a quiet spot: brand on the tray, offer in an inset card and one Primary Pill Button. */
export function PromoCard({
  brand, tag = 'Pro', price, title = 'Limited Offer', description, meta, actionLabel = 'Explore', state, defaultState = 'default', onStateChange,
  endsIn = 0, laterPrice, laterLabel = 'after tonight', endingActionLabel = 'Claim before midnight', claimedTitle, claimedDescription, claimedMeta, claimedActionLabel = 'Open dashboard', claimedLabel = 'Paid',
  onAction, onClaimedAction, onExpire, animated = true, className,
}: PromoCardProps) {
  const still = useStill(animated)
  const titleId = useId()
  const [held, setHeld] = useState(defaultState)
  const current = state ?? held
  const [left, setLeft] = useState(endsIn)
  // A new handler must not restart the countdown.
  const expire = useRef(onExpire)
  expire.current = onExpire
  const change = useRef(onStateChange)
  change.current = onStateChange

  useEffect(() => {
    if (current !== 'ending') return
    const end = Date.now() + endsIn * 1000
    setLeft(endsIn)
    const timer = setInterval(() => {
      const next = Math.max(0, Math.round((end - Date.now()) / 1000))
      setLeft(next)
      if (next === 0) {
        clearInterval(timer)
        expire.current?.()
        // The offer is over, so the countdown and the ending price leave.
        setHeld('default')
        change.current?.('default')
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [current, endsIn])

  function act(): void {
    onAction?.()
    if (current !== 'ending') return
    setHeld('claimed')
    onStateChange?.('claimed')
  }

  const arrow = <span className={styles.arrow}><ArrowUpRightIcon /></span>
  const claimed = current === 'claimed'
  const fade = { initial: still ? false : { opacity: 0 }, animate: { opacity: 1 }, exit: still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }, transition: { duration: CLAIM_FADE, ease: ease.out } } as const

  return (
    <section className={cx(styles.tray, className)} aria-labelledby={titleId} data-state={current} data-still={still ? '' : undefined}>
      <div className={styles.header}>
        <div className={styles.brand}><span className={styles.brandName}>{brand}</span><Badge variant="outline" size="sm" mark={false} animated={animated}>{tag}</Badge></div>
        {current === 'ending'
          ? <p className={styles.timer} role="timer"><span>Ends in </span><RollingText value={clock(left)} still={still} /></p>
          : <p className={styles.price}>{claimed ? claimedLabel : price}</p>}
      </div>
      <Card variant="plain" as="article" bodyClassName={styles.inset} animated={animated}>
        <div className={styles.views}>
          <AnimatePresence initial={false}>
            {claimed ? (
              <motion.div key="claimed" className={styles.view} {...fade}>
                <div className={styles.claimedTitle}>
                  <motion.span className={styles.mark} initial={still ? false : { scale: 0 }} animate={{ scale: 1 }} transition={spring.pop}><CheckIcon size={14} /></motion.span>
                  <h3 id={titleId} className={styles.title}>{claimedTitle}</h3>
                </div>
                <p className={styles.description}>{claimedDescription}</p>
                <p className={styles.meta}>{claimedMeta}</p>
                <Button className={styles.action} variant="secondary" shape="pill" size="lg" trailingIcon={arrow} animated={animated} onClick={onClaimedAction}>{claimedActionLabel}</Button>
              </motion.div>
            ) : (
              <motion.div key="offer" className={styles.view} {...fade}>
                <h3 id={titleId} className={styles.title}>{title}</h3>
                <p className={styles.description}>{description}</p>
                {current === 'ending'
                  ? <p className={styles.meta}><span className={styles.now}>{price}</span> <s>{laterPrice}</s> {laterLabel}</p>
                  : <p className={styles.meta}>{meta}</p>}
                <Button className={styles.action} shape="pill" size="lg" trailingIcon={arrow} animated={animated} onClick={act}>{current === 'ending' ? endingActionLabel : actionLabel}</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </section>
  )
}
