'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import { InfoIcon } from '@fetaui/react/rounded/info'
import { Button } from '../button/button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Radio } from '../radio/radio'
import { Textarea } from '../textarea/textarea'
import { EASE_STANDARD, ROW_S, Tag, enter, kit } from '../product-kit/product-kit'
import styles from './cancel-flow.module.css'

export type CancelReason = { value: string; label: string; description: string }

export type CancelFlowProps = {
  plan: string
  /** `Halcyon Studio · 8 seats · $96 a month`. */
  summary: string
  renews: string
  reasons: CancelReason[]
  /** The offer step's words. */
  offer: { title: string; body: string; price: string; detail: string; tag: string; pause?: string; accept: string }
  /** The words on the last step. */
  confirm?: { title: string; body: string; action: string }
  noteHint?: string
  notePlaceholder?: string
  noteLimit?: number
  onAccept?: (reason: string | undefined) => void
  /** A rejection stays on the confirm step and shows `failedMessage`. */
  onCancel?: (reason: string | undefined, note: string) => void | Promise<void>
  /** Shown on the confirm step when `onCancel` rejects. */
  failedMessage?: string
  /** The step to start on. For previews and resumed flows. */
  defaultStep?: 0 | 1 | 2
  defaultReason?: string
  animated?: boolean
  className?: string
}

const STEPS = ['Reason', 'Offer', 'Confirm']

/** A three step cancellation: a reason, a retention offer, then a final confirm. */
export function CancelFlow({ plan, summary, renews, reasons, offer, confirm = { title: 'Cancel your plan?', body: 'You keep access until the end of this billing period. Nothing is deleted.', action: 'Cancel plan' }, noteHint, notePlaceholder, noteLimit = 500, onAccept, onCancel, failedMessage = 'Could not cancel your plan. Try again.', defaultStep = 0, defaultReason, animated = true, className }: CancelFlowProps) {
  const still = useStill(animated)
  const uid = useId()
  const [step, setStep] = useState<number>(defaultStep)
  const [reason, setReason] = useState(defaultReason)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'working' | 'kept' | 'cancelled'>('idle')
  const [failed, setFailed] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)

  useEffect(() => {
    if (moved.current) heading.current?.focus({ preventScroll: true })
    moved.current = false
  }, [step, status])

  function goTo(next: number): void {
    moved.current = true
    setFailed(false)
    setStep(next)
  }

  async function finish(): Promise<void> {
    if (status === 'working') return
    setStatus('working')
    setFailed(false)
    try {
      await onCancel?.(reason, note)
      moved.current = true
      setStatus('cancelled')
    } catch {
      setStatus('idle')
      setFailed(true)
    }
  }

  const key = status === 'kept' || status === 'cancelled' ? status : String(step)
  const swap = { initial: still ? false as const : { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }, transition: { duration: still ? 0 : ROW_S, ease: EASE_STANDARD } }

  return (
    <motion.section {...enter(still)} className={cx(kit.tray, styles.tray, className)} aria-label="Cancel plan">
      <div className={cx(kit.body, styles.body)}>
        <header className={styles.header}>
          <div className={styles.plan}>
            <h2 className={kit.title}>{plan}</h2>
            <p className={kit.sub}>{summary}</p>
          </div>
          <Tag dot animated={animated}>{renews}</Tag>
        </header>

        <ol className={styles.steps}>
          {STEPS.map((name, i) => <li key={name} className={styles.stepItem} data-state={i === step ? 'now' : i < step ? 'done' : 'next'} aria-current={i === step ? 'step' : undefined}><span className={styles.stepBar} />{name}</li>)}
        </ol>

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={key} className={styles.view} {...swap}>
            {status === 'kept' ? (
              <>
                <h3 ref={heading} tabIndex={-1} className={styles.title}>Your plan stays</h3>
                <p className={styles.lead}>{offer.price} starts on your next invoice.</p>
              </>
            ) : status === 'cancelled' ? (
              <>
                <h3 ref={heading} tabIndex={-1} className={styles.title}>Your plan is cancelled</h3>
                <p className={styles.lead}>We have sent a confirmation by email.</p>
              </>
            ) : step === 0 ? (
              <>
                <h3 ref={heading} tabIndex={-1} id={`${uid}-why`} className={styles.title}>Why are you cancelling?</h3>
                <p className={styles.lead}>Your answer shapes what we suggest next. Nothing changes until you confirm on the last step.</p>
                <div role="radiogroup" aria-labelledby={`${uid}-why`} className={styles.reasons}>
                  {reasons.map((entry) => (
                    <label key={entry.value} className={styles.reason} data-on={reason === entry.value ? '' : undefined}>
                      <span className={styles.reasonText}><span className={styles.reasonLabel}>{entry.label}</span><span className={kit.sub}>{entry.description}</span></span>
                      <Radio name={`${uid}-reason`} value={entry.value} checked={reason === entry.value} animated={animated} onChange={() => setReason(entry.value)} />
                    </label>
                  ))}
                </div>
                <div className={styles.note}>
                  <label htmlFor={`${uid}-note`} className={styles.noteLabel}>Add a note <span className={kit.tertiary}>Optional</span></label>
                  <Textarea id={`${uid}-note`} rows={4} limit={noteLimit} value={note} animated={animated} {...(notePlaceholder ? { placeholder: notePlaceholder } : {})} {...(noteHint ? { 'aria-description': noteHint } : {})} onChange={(e) => setNote(e.target.value)} />
                  {noteHint ? <p className={styles.noteHint}>{noteHint}</p> : null}
                </div>
              </>
            ) : step === 1 ? (
              <>
                <h3 ref={heading} tabIndex={-1} className={styles.title}>{offer.title}</h3>
                <p className={styles.lead}>{offer.body}</p>
                <div className={styles.offer}>
                  <div><p className={styles.price}>{offer.price}</p><p className={kit.sub}>{offer.detail}</p></div>
                  <Tag tone="success" dot animated={animated}>{offer.tag}</Tag>
                </div>
                {offer.pause ? <p className={styles.pause}><InfoIcon size={14} />{offer.pause}</p> : null}
              </>
            ) : (
              <>
                <h3 ref={heading} tabIndex={-1} className={styles.title}>{confirm.title}</h3>
                <p className={styles.lead}>{confirm.body}</p>
                {failed ? <p className={styles.failed} role="alert">{failedMessage}</p> : null}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {status === 'kept' || status === 'cancelled' ? null : (
          <footer className={styles.footer}>
            {step === 0 ? <span /> : <Button variant="ghost" shape="pill" animated={animated} disabled={status === 'working'} onClick={() => (step === 1 ? goTo(2) : goTo(1))}>{step === 1 ? 'Cancel anyway' : 'Back'}</Button>}
            {step === 0 ? <Button shape="pill" animated={animated} disabled={!reason} onClick={() => goTo(1)}>Continue</Button> : null}
            {step === 1 ? <Button shape="pill" animated={animated} onClick={() => { moved.current = true; onAccept?.(reason); setStatus('kept') }}>{offer.accept}</Button> : null}
            {step === 2 ? <Button variant="destructive" shape="pill" animated={animated} status={status === 'working' ? 'loading' : 'idle'} onClick={() => { void finish() }}>{confirm.action}</Button> : null}
          </footer>
        )}
      </div>
    </motion.section>
  )
}
