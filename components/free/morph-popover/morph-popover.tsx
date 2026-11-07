'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChatFeedbackIcon } from '@fetaui/react/rounded/chat-feedback'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { XIcon } from '@fetaui/react/rounded/x'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { cx, kit, useStill } from '../motion-kit/motion-kit'
import styles from './morph-popover.module.css'

const MORPH = { type: 'spring', duration: 0.42, bounce: 0.14 } as const

export type MorphPopoverProps = {
  label?: string
  placeholder?: string
  /** Sends the note. The form shows a loader until the promise settles. */
  onSend?: (text: string) => Promise<void> | void
  disabled?: boolean
  /** `false` swaps pill and form without the morph. */
  animated?: boolean
  className?: string
  icon?: ReactNode
}

type State = 'idle' | 'open' | 'sending' | 'sent'

/** A feedback pill that grows into its own form. */
export function MorphPopover({ label = 'Feedback', placeholder = 'What would make this better?', onSend, disabled, animated = true, className, icon }: MorphPopoverProps) {
  const still = useStill(animated)
  const id = useId()
  const [state, setState] = useState<State>('idle')
  const [text, setText] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)
  const pill = useRef<HTMLButtonElement>(null)
  const reopened = useRef(false)
  const tray = useRef<HTMLDivElement>(null)
  const request = useRef(0)
  const glyph = icon ?? <ChatFeedbackIcon />
  const transition = still ? { duration: 0 } : MORPH

  useEffect(() => {
    if (state === 'open') field.current?.focus({ preventScroll: true })
    // The form is gone, so Close takes the focus and Esc keeps working.
    if (state === 'sent') tray.current?.querySelector('button')?.focus({ preventScroll: true })
    if (state === 'idle' && reopened.current) { reopened.current = false; pill.current?.focus({ preventScroll: true }) }
  }, [state])

  function close(): void {
    reopened.current = true
    request.current += 1
    setState('idle')
    setText('')
  }

  async function send(): Promise<void> {
    if (!text.trim() || state !== 'open') return
    const mine = ++request.current
    setState('sending')
    try {
      await onSend?.(text)
      if (mine === request.current) setState('sent')
    } catch {
      if (mine === request.current) setState('open')
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>): void {
    if (e.key === 'Escape') close()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send() }
  }

  if (state === 'idle') {
    return (
      <motion.button
        ref={pill}
        type="button"
        {...(still ? {} : { layoutId: id })}
        disabled={disabled}
        aria-expanded={false}
        className={cx(kit.control, kit.surface, styles.pill, className)}
        style={{ borderRadius: 18 }}
        transition={transition}
        onClick={() => setState('open')}
      >
        <motion.span layout="position" className={kit.trayTitle}><span className={kit.icon}>{glyph}</span>{label}</motion.span>
      </motion.button>
    )
  }

  return (
    <motion.div ref={tray} {...(still ? {} : { layoutId: id })} role="dialog" aria-label={label} className={cx(kit.tray, styles.tray, className)} style={{ borderRadius: 22 }} transition={transition} onKeyDown={onKeyDown}>
      <div className={cx(kit.trayHeader, styles.header)}>
        <span className={kit.trayTitle}><span className={kit.icon}>{glyph}</span>{label}</span>
        <IconButton variant="ghost" size="sm" label="Close" animated={animated} icon={<XIcon />} onClick={close} />
      </div>
      <motion.div className={cx(kit.card, styles.body)} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: still ? 0 : 0.08 }}>
        <AnimatePresence mode="popLayout" initial={false}>
          {state === 'sent' ? (
            <motion.div key="sent" role="status" className={styles.sent} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <span className={styles.badge}><Tick02Icon /></span>
              <span className={styles.sentTitle}>Thanks for the feedback</span>
              <span className={kit.meta}>We read every note.</span>
            </motion.div>
          ) : (
            <motion.div key="form" exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              <textarea ref={field} aria-label={placeholder} placeholder={placeholder} value={text} disabled={state === 'sending'} className={styles.field} onChange={(e) => setText(e.target.value)} />
              <div className={styles.footer}>
                <span className={styles.hint}><kbd className={styles.kbd}>⌘↵</kbd>to send</span>
                <Button size="sm" shape="pill" animated={animated} disabled={!text.trim()} status={state === 'sending' ? 'loading' : 'idle'} loadingLabel="Sending" onClick={() => void send()}>Send</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
