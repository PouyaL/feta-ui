'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { XIcon } from '@fetaui/react/rounded/x'
import { Button } from '../button/button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Select } from '../select/select'
import { EASE_STANDARD, ROW_S, enter } from '../product-kit/product-kit'
import styles from './invite-field.module.css'

export const isEmail = (text: string): boolean => /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/.test(text)
export const splitEmails = (text: string): string[] => text.split(/[\s,;]+/).map((part) => part.trim()).filter(Boolean)

export type InviteFieldProps = {
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (emails: string[]) => void
  roles?: string[]
  defaultRole?: string
  label?: string
  placeholder?: string
  help?: string
  sendLabel?: (count: number) => string
  onSend?: (emails: string[], role: string) => void
  animated?: boolean
  className?: string
}

/** A wrapping box of email chips, a role Select and Send. Send waits until every address is valid. */
export function InviteField({ value, defaultValue = [], onValueChange, roles = ['Admin', 'Member', 'Viewer'], defaultRole = 'Member', label = 'Invite by email', placeholder = 'name@company.com, separated by commas', help = 'Invites expire after 7 days', sendLabel = (count) => (count === 0 ? 'Send invites' : count > 1 ? `Send ${count} invites` : 'Send invite'), onSend, animated = true, className }: InviteFieldProps) {
  const still = useStill(animated)
  const uid = useId()
  const input = useRef<HTMLInputElement>(null)
  const [held, setHeld] = useState(defaultValue)
  const [text, setText] = useState('')
  const [role, setRole] = useState(defaultRole)
  const emails = value ?? held
  const bad = emails.filter((email) => !isEmail(email))
  const state = bad.length ? 'error' : emails.length ? 'filled' : 'empty'

  function commit(next: string[]): void {
    setHeld(next)
    onValueChange?.(next)
  }

  function add(raw: string): void {
    const fresh = [...new Set(splitEmails(raw))].filter((email) => !emails.includes(email))
    if (fresh.length) commit([...emails, ...fresh])
    setText('')
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if ((e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === 'Tab') && text.trim()) {
      e.preventDefault()
      add(text)
    } else if (e.key === 'Enter') e.preventDefault()
    else if (e.key === 'Backspace' && !text && emails.length) commit(emails.slice(0, -1))
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>): void {
    // Only a list or a whole address becomes chips. Anything else is part of what is being typed.
    const { selectionStart, selectionEnd } = e.currentTarget
    const merged = `${text.slice(0, selectionStart ?? text.length)}${e.clipboardData.getData('text')}${text.slice(selectionEnd ?? text.length)}`.trim()
    if (!/[\s,;]/.test(merged) && !isEmail(merged)) return
    e.preventDefault()
    add(merged)
  }

  return (
    <motion.section {...enter(still)} className={cx(styles.field, className)} aria-labelledby={`${uid}-label`} data-state={state}>
      <label id={`${uid}-label`} htmlFor={`${uid}-input`} className={styles.label}>{label}</label>
      <div className={styles.box} onClick={(e) => { if (e.target === e.currentTarget) input.current?.focus() }}>
        <AnimatePresence initial={false} mode="popLayout">
          {emails.map((email) => {
            const wrong = !isEmail(email)
            return (
              <motion.span key={email} className={styles.chip} data-wrong={wrong ? '' : undefined} initial={still ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.96 }} transition={{ duration: still ? 0 : ROW_S, ease: EASE_STANDARD }}>
                {email}
                <button type="button" className={styles.remove} aria-label={`Remove ${email}`} onClick={() => { commit(emails.filter((entry) => entry !== email)); input.current?.focus() }}><XIcon size={12} /></button>
              </motion.span>
            )
          })}
        </AnimatePresence>
        <input
          ref={input}
          id={`${uid}-input`}
          className={styles.input}
          value={text}
          aria-invalid={bad.length ? true : undefined}
          aria-describedby={`${uid}-help`}
          inputMode="email"
          autoComplete="off"
          placeholder={emails.length ? 'Add more' : placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => { if (text.trim()) add(text) }}
        />
      </div>
      <p id={`${uid}-help`} role="status" className={styles.help}>{bad.length ? `${bad.join(', ')} ${bad.length > 1 ? 'are' : 'is'} not a valid email` : emails.length ? `${emails.length} ${emails.length === 1 ? 'person' : 'people'} will join as ${role}` : help}</p>
      <div className={styles.actions}>
        <Select aria-label="Role" options={roles.map((entry) => ({ value: entry, label: entry }))} value={role} onValueChange={setRole} animated={animated} className={cx(styles.role)} />
        <Button shape="pill" className={styles.send} animated={animated} disabled={emails.length === 0 || bad.length > 0} feedback={{ loading: 'Sending', success: emails.length > 1 ? 'Invites sent' : 'Invite sent' }} onClick={() => onSend?.(emails, role)}>{sendLabel(emails.length)}</Button>
      </div>
    </motion.section>
  )
}
