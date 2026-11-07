'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { CopyIcon } from '@fetaui/react/rounded/copy'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { XIcon } from '@fetaui/react/rounded/x'
import { ReceiptIcon } from '@fetaui/react/rounded/receipt'
import { RefreshCwIcon } from '@fetaui/react/rounded/refresh-cw'
import { delay, ease, spring } from '../../motion-tokens'
import { Avatar, type AvatarPerson } from '../avatar/avatar'
import { Badge, type BadgeTone } from '../badge/badge'
import { Button } from '../button/button'
import { Card } from '../card/card'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Spinner } from '../spinner/spinner'
import styles from './currency-transfer.module.css'

/** Step completes: the line fills down in 300 ms. */
const LINE_DURATION = 0.3

export type TransferStatus = 'processing' | 'completed' | 'failed'
type StepState = 'done' | 'active' | 'failed' | 'waiting'

export type TransferStep = {
  title: string
  meta: string
  /** Shown once this step is done, if the wording changes. */
  doneTitle?: string
  doneMeta?: string
  /** Shown if the transfer fails on this step. */
  failedTitle?: string
  failedMeta?: string
}

export type CurrencyTransferProps = {
  recipient: { name: string; account: string; person?: AvatarPerson; src?: string }
  /** The amount received, formatted. */
  amount: string
  /** The line under the amount. */
  summary: string
  /** Default `processing`. */
  status?: TransferStatus
  steps: TransferStep[]
  /** Steps finished so far. The next one spins, or fails. Defaults to all but the last. */
  done?: number
  reference: string
  /** The line under the reference. */
  note?: string
  /** Fires after the reference is copied. */
  onCopy?: (reference: string) => void
  onReceipt?: () => void
  onRetry?: () => void
  animated?: boolean
  className?: string
}

const BADGE: Record<TransferStatus, [BadgeTone, string]> = { processing: ['info', 'In progress'], completed: ['success', 'Arrived'], failed: ['danger', 'Failed'] }
const SPOKEN: Record<StepState, string> = { done: 'Done', active: 'In progress', failed: 'Failed', waiting: 'Waiting' }

function Mark({ state, still }: { state: StepState; still: boolean }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={state}
        className={styles.mark}
        data-state={state}
        initial={still ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
        transition={still ? { duration: 0 } : spring.stamp}
      >
        {state === 'done' ? <Tick02Icon size={12} /> : state === 'failed' ? <XIcon size={12} /> : state === 'active' ? <Spinner kind="bars" size={12} label={null} animated={!still} /> : null}
      </motion.span>
    </AnimatePresence>
  )
}

/** A money transfer and its steps. Steps tick in sequence and never jump back. */
export function CurrencyTransfer({ recipient, amount, summary, status = 'processing', steps, done, reference, note, onCopy, onReceipt, onRetry, animated = true, className }: CurrencyTransferProps) {
  const still = useStill(animated)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const reached = status === 'completed' ? steps.length : Math.min(done ?? steps.length - 1, steps.length - 1)
  const stateOf = (index: number): StepState => {
    if (index < reached) return 'done'
    if (index > reached) return 'waiting'
    return status === 'failed' ? 'failed' : 'active'
  }
  const [tone, label] = BADGE[status]

  function copy(): void {
    // onCopy and Copied fire only once the clipboard accepts it.
    void navigator.clipboard?.writeText(reference).then(() => {
      onCopy?.(reference)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), delay.reset * 1000)
    }, () => undefined)
  }

  return (
    <Card
      aria-label={`Transfer to ${recipient.name}`}
      className={cx(styles.transfer, className)}
      bodyClassName={styles.body}
      footerClassName={styles.footer}
      animated={animated}
      footer={
        <>
          <div className={styles.reference}>
            <code className={styles.code}>{reference}</code>
            {note ? <span className={styles.note}>{note}</span> : null}
          </div>
          <span className={styles.action}>
            {status === 'completed' ? <Button size="sm" variant="secondary" leadingIcon={<ReceiptIcon />} animated={animated} onClick={onReceipt}>Receipt</Button>
              : status === 'failed' ? <Button size="sm" leadingIcon={<RefreshCwIcon />} animated={animated} onClick={onRetry}>Retry</Button>
              : <IconButton size="sm" variant="ghost" icon={copied ? <CheckIcon /> : <CopyIcon />} label={copied ? 'Copied' : 'Copy reference'} animated={animated} onClick={copy} />}
          </span>
        </>
      }
    >
      <div className={styles.recipient}>
        <Avatar size="lg" animated={animated} {...(recipient.person ? { person: recipient.person } : {})} {...(recipient.src ? { src: recipient.src } : {})} />
        <div className={styles.who}>
          <p className={styles.name}>{recipient.name}</p>
          <p className={styles.meta}>{recipient.account}</p>
        </div>
        <span aria-live="polite"><Badge size="sm" tone={tone} animated={animated}>{label}</Badge></span>
      </div>
      <div className={styles.amount} data-status={status}>
        <p className={styles.value}>{amount}</p>
        <p className={styles.summary}>{summary}</p>
      </div>
      <ol className={styles.timeline}>
        {steps.map((step, index) => {
          const state = stateOf(index)
          const title = state === 'done' ? step.doneTitle ?? step.title : state === 'failed' ? step.failedTitle ?? step.title : step.title
          const meta = state === 'done' ? step.doneMeta ?? step.meta : state === 'failed' ? step.failedMeta ?? step.meta : step.meta
          return (
            <li key={step.title} className={styles.step} data-state={state}>
              <span className={styles.rail}>
                <Mark state={state} still={still} />
                {index < steps.length - 1 ? (
                  <span className={styles.track}>
                    <motion.span className={styles.line} initial={false} animate={{ scaleY: state === 'done' ? 1 : 0 }} transition={still ? { duration: 0 } : { duration: LINE_DURATION, ease: ease.out }} />
                  </span>
                ) : null}
              </span>
              <span className={styles.text}>
                <span className={styles.stepTitle}>{title}<span className={styles.hidden}>: {SPOKEN[state]}</span></span>
                <span className={styles.meta}>{meta}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
