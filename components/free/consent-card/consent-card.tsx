'use client'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { XIcon } from '@fetaui/react/rounded/x'
import { CookieIcon } from '@fetaui/react/rounded/cookie'
import { ease, spring } from '../../motion-tokens'
import { Button } from '../button/button'
import { Card } from '../card/card'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './consent-card.module.css'

/** Consent opens: 240 ms, y 12 to 0. */
const ENTER_DURATION = 0.24
const ENTER_SHIFT = 12
/** Reduced motion keeps a 150 ms fade. */
const FADE_DURATION = 0.15
/** The one line form hides itself after 4 s. */
const HIDE_AFTER_MS = 4000

export type ConsentValue = 'asking' | 'accepted' | 'declined'

export type ConsentCardProps = {
  value?: ConsentValue
  defaultValue?: ConsentValue
  onValueChange?: (value: 'accepted' | 'declined') => void
  /** Fires when it closes, by the close button or after `hideAfter`. */
  onDismiss?: () => void
  title?: ReactNode
  description?: ReactNode
  /** Default Accept. */
  acceptLabel?: string
  /** Default Decline. */
  declineLabel?: string
  /** One line title after accepting. Default Analytics on. */
  acceptedTitle?: ReactNode
  /** One line title after declining. Default Analytics off. */
  declinedTitle?: ReactNode
  /** Under the one line title. */
  note?: ReactNode
  /** Milliseconds before the one line form hides. `0` keeps it. Default 4000. */
  hideAfter?: number
  /** `corner` floats bottom left on Web and docks on Mobile. Default `inline`. */
  placement?: 'inline' | 'corner'
  animated?: boolean
  className?: string
}

/** Asks once whether analytics may run, then folds to a one line confirmation. */
export function ConsentCard({
  value, defaultValue = 'asking', onValueChange, onDismiss, title = 'Cookies', description = 'This site uses analytics to see which pages help. Nothing is sold or shared.',
  acceptLabel = 'Accept', declineLabel = 'Decline', acceptedTitle = 'Analytics on', declinedTitle = 'Analytics off', note = 'Change it any time in Settings',
  hideAfter = HIDE_AFTER_MS, placement = 'inline', animated = true, className,
}: ConsentCardProps) {
  const still = useStill(animated)
  const reduced = Boolean(useReducedMotion()) && animated
  const [held, setHeld] = useState<ConsentValue>(defaultValue)
  const [closed, setClosed] = useState(false)
  const answer = value ?? held
  const asking = answer === 'asking'
  const line = useRef<HTMLDivElement>(null)
  const refocus = useRef(false)

  function answerWith(next: 'accepted' | 'declined'): void {
    refocus.current = true
    setHeld(next)
    onValueChange?.(next)
  }

  function close(): void {
    setClosed(true)
    onDismiss?.()
  }

  // The answered Button is gone, so focus moves to the line that replaced it.
  useEffect(() => {
    if (asking || !refocus.current) return
    refocus.current = false
    line.current?.querySelector('button')?.focus()
  }, [asking])

  useEffect(() => {
    if (asking || closed || !hideAfter) return
    const timer = setTimeout(close, hideAfter)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asking, closed, hideAfter])

  const open = still
    ? (reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: FADE_DURATION } } : { initial: false as const })
    : { initial: { y: ENTER_SHIFT, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: ENTER_SHIFT, opacity: 0 }, transition: { duration: ENTER_DURATION, ease: ease.out } }

  const fold = still
    ? { initial: false as const, animate: { opacity: 1 } }
    : { initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1 }, transition: spring.pop }

  return (
    <AnimatePresence>
      {closed ? null : (
        <motion.section key="consent" aria-label="Consent" data-placement={placement} className={cx(styles.consent, className)} {...open}>
          <AnimatePresence mode="popLayout" initial={false}>
            {asking ? (
              <motion.div key="asking" className={styles.layer} exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, clipPath: 'inset(0 0 60% 0 round 22px)', transition: spring.pop }}>
                <Card
                  bodyClassName={styles.ask}
                  footerClassName={styles.actions}
                  animated={animated}
                  footer={
                    <>
                      <Button variant="secondary" animated={animated} onClick={() => answerWith('declined')}>{declineLabel}</Button>
                      <Button animated={animated} onClick={() => answerWith('accepted')}>{acceptLabel}</Button>
                    </>
                  }
                >
                  <div className={styles.header}>
                    <span className={styles.cookie}><CookieIcon className={styles.glyph} /></span>
                    <h3 className={styles.title}>{title}</h3>
                    <IconButton variant="ghost" size="sm" icon={<XIcon />} label="Close" animated={animated} onClick={close} />
                  </div>
                  <p className={styles.description}>{description}</p>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="answered" ref={line} role="status" className={styles.layer} {...fold}>
                <Card bodyClassName={styles.done} animated={animated}>
                  <div className={styles.line}>
                    <span className={styles.mark} data-answer={answer}>{answer === 'accepted' ? <CheckIcon size={14} /> : <XIcon size={14} />}</span>
                    <div className={styles.lineText}>
                      <p className={styles.lineTitle}>{answer === 'accepted' ? acceptedTitle : declinedTitle}</p>
                      <p className={styles.note}>{note}</p>
                    </div>
                    <IconButton variant="ghost" size="sm" icon={<XIcon />} label="Close" animated={animated} onClick={close} />
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
