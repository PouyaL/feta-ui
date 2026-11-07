'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '../button/button'
import { InputOTP } from '../input-otp/input-otp'
import { LabelSwap, cx, useStill } from '../motion-kit/motion-kit'
import styles from './otp-form.module.css'

export type OTPFormProps = {
  title?: ReactNode
  description?: ReactNode
  /** Resolve true when the code is right. */
  onVerify: (code: string) => Promise<boolean>
  onResend?: () => void
  /** Seconds before Resend is offered again. Default 60. */
  resendAfter?: number
  /** The line and link under the button. */
  help?: { text: string; action: string; onClick?: () => void }
  errorText?: string
  animated?: boolean
  className?: string
}

type Status = 'idle' | 'verifying' | 'error' | 'success'
const LENGTH = 6

/** A one time code card. Verify waits for all six digits, and a wrong code keeps them to fix. */
export function OTPForm({ title = 'Verify your login', description = 'Enter the code we sent to your email', onVerify, onResend, resendAfter = 60, help, errorText = 'That code did not match', animated = true, className }: OTPFormProps) {
  const still = useStill(animated)
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [wait, setWait] = useState(0)
  const alive = useRef(true)
  const box = useRef<HTMLElement>(null)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  // Checking disables the field, so a wrong code hands focus back for the retry.
  useEffect(() => {
    if (status === 'error') box.current?.querySelector('input')?.focus({ preventScroll: true })
  }, [status])

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((left) => left - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  async function verify(next: string): Promise<void> {
    if (next.length < LENGTH || status === 'verifying') return
    setStatus('verifying')
    const right = await onVerify(next).catch(() => false)
    if (alive.current) setStatus(right ? 'success' : 'error')
  }

  function resend(): void {
    setWait(resendAfter)
    onResend?.()
  }

  const verifying = status === 'verifying'
  const complete = code.length === LENGTH
  const hint = status === 'idle' && wait > 0 ? 'New code sent.' : status === 'error' ? errorText : status === 'success' ? 'Verified' : complete ? 'Code complete' : 'Enter the 6 digit code'
  return (
    <section ref={box} className={cx(styles.card, className)} aria-label="One time code">
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      <InputOTP animated={animated} invalid={status === 'error'} disabled={verifying || status === 'success'} value={code} onValueChange={(next) => { setCode(next); setStatus('idle') }} onComplete={(next) => { void verify(next) }} />
      <div className={styles.row}>
        <p className={styles.message} role="status" data-tone={status}><LabelSwap swapKey={hint} still={still}>{hint}</LabelSwap></p>
        {wait > 0 ? <span className={styles.count} data-keep-motion="">Resend in {Math.floor(wait / 60)}:{String(wait % 60).padStart(2, '0')}</span> : <Button variant="ghost" size="sm" animated={animated} onClick={resend}>Resend code</Button>}
      </div>
      <Button animated={animated} className={styles.verify} disabled={!complete || status === 'success'} status={verifying ? 'loading' : 'idle'} onClick={() => { void verify(code) }}>{verifying ? 'Verifying' : 'Verify'}</Button>
      {help ? <p className={styles.help}>{help.text} <Button variant="ghost" size="sm" animated={animated} onClick={() => help.onClick?.()}>{help.action}</Button></p> : null}
    </section>
  )
}
