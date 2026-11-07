'use client'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { XIcon } from '@fetaui/react/rounded/x'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useRef, useState, type HTMLAttributes } from 'react'
import { Button } from '../button/button'
import { Input } from '../input/input'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Toggle } from '../toggle/toggle'
import styles from './feedback-prompt.module.css'

const UPDATE_S = 0.24
const STANDARD = [0.25, 0.1, 0.25, 1] as const

export type FeedbackPromptValue = { helpful: boolean; reasons: string[]; note: string }
type Stage = 'default' | 'positive' | 'negative' | 'sent'

export type FeedbackPromptProps = Omit<HTMLAttributes<HTMLElement>, 'onSubmit'> & {
  /** Default `Was this helpful?`. */
  question?: string
  reasons?: string[]
  /** Default `Thanks, your feedback helps us improve this page.`. */
  thanks?: string
  /** Opens on a stage, for previews. */
  defaultStage?: Stage
  onSubmit?: (value: FeedbackPromptValue) => void
  animated?: boolean
}

/** A yes or no question. Yes opens a note, No adds reason chips, and sending says thanks. */
export function FeedbackPrompt({ question = 'Was this helpful?', reasons = ['Inaccurate', 'Hard to follow', 'Missing steps', 'Outdated'], thanks = 'Thanks, your feedback helps us improve this page.', defaultStage = 'default', onSubmit, animated = true, className, ...rest }: FeedbackPromptProps) {
  const still = useStill(animated)
  const id = useId()
  const [stage, setStage] = useState<Stage>(defaultStage)
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState('')
  const justSent = useRef(false)
  const reveal = still ? {} : { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 }, transition: { duration: UPDATE_S, ease: STANDARD } }

  function send(): void {
    onSubmit?.({ helpful: stage === 'positive', reasons: stage === 'negative' ? picked : [], note })
    justSent.current = true
    setStage('sent')
  }

  return (
    <section aria-labelledby={id} data-still={animated ? undefined : ''} className={cx(styles.prompt, className)} {...rest}>
      <AnimatePresence initial={false} mode="popLayout">
        {stage === 'sent' ? (
          <motion.p key="sent" ref={(node) => { if (node && justSent.current) { justSent.current = false; node.focus({ preventScroll: true }) } }} tabIndex={-1} role="status" className={styles.sent} {...reveal}><CheckIcon size={16} /><span id={id}>{thanks}</span></motion.p>
        ) : (
          <motion.div key="form" className={styles.form} exit={{ opacity: 0, transition: { duration: still ? 0 : 0.12 } }}>
            <div className={styles.head}>
              <h3 id={id} className={styles.question}>{question}</h3>
              <div className={styles.choices}>
                <Button size="sm" variant={stage === 'positive' ? 'primary' : 'secondary'} leadingIcon={<CheckIcon />} aria-pressed={stage === 'positive'} animated={animated} onClick={() => setStage('positive')}>Yes</Button>
                <Button size="sm" variant={stage === 'negative' ? 'primary' : 'secondary'} leadingIcon={<XIcon />} aria-pressed={stage === 'negative'} animated={animated} onClick={() => setStage('negative')}>No</Button>
              </div>
            </div>
            {stage === 'negative' ? (
              <motion.div className={styles.chips} role="group" aria-label="What went wrong" {...reveal}>
                {reasons.map((reason) => (
                  <Toggle key={reason} appearance="outline" animated={animated} pressed={picked.includes(reason)} onPressedChange={(on) => setPicked((all) => (on ? [...all, reason] : all.filter((r) => r !== reason)))}>{reason}</Toggle>
                ))}
              </motion.div>
            ) : null}
            {stage === 'default' ? null : (
              <motion.div key={stage} className={styles.note} {...reveal}>
                <Input aria-label="Note" placeholder={stage === 'positive' ? 'What worked well? (optional)' : 'Tell us more (optional)'} value={note} onChange={(e) => setNote(e.target.value)} animated={animated} />
                <Button size="sm" animated={animated} onClick={send}>Send feedback</Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
