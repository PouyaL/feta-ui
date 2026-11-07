'use client'
import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { useEffect, useId, useRef, useState, type ClipboardEvent, type ReactNode } from 'react'
import { CreditCardIcon } from '@fetaui/react/rounded/credit-card'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { InfoIcon } from '@fetaui/react/rounded/info'
import { LockIcon } from '@fetaui/react/rounded/lock'
import { spring } from '../../motion-tokens'
import { Button } from '../button/button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './card-field.module.css'

/** Expired: x 0, 4, -4, 0 over 300 ms. */
const SHAKE = { x: [0, 4, -4, 0], transition: { duration: 0.3 } }
const NUMBER_TEMPLATE = '0000 0000 0000 0000'
const AMEX_TEMPLATE = '0000 000000 00000'
const TEST_CARD: CardValue = { number: '4242 4242 4242 4242', expiry: '12 / 28', cvc: '123' }

export type CardValue = { number: string; expiry: string; cvc: string }
export type CardFieldStatus = 'idle' | 'processing' | 'paid'
type Part = 'number' | 'expiry' | 'cvc'

const digits = (value: string): string => value.replace(/\D/g, '')
const isAmex = (value: string): boolean => /^3[47]/.test(digits(value))
const numberLength = (value: string): number => (isAmex(value) ? 15 : 16)
const cvcLength = (number: string): number => (isAmex(number) ? 4 : 3)
function formatNumber(value: string): string {
  const raw = digits(value).slice(0, numberLength(value))
  return isAmex(raw) ? [raw.slice(0, 4), raw.slice(4, 10), raw.slice(10)].filter(Boolean).join(' ') : raw.replace(/(\d{4})(?=\d)/g, '$1 ')
}
function formatExpiry(value: string): string {
  const raw = digits(value).slice(0, 4)
  return raw.length > 2 ? `${raw.slice(0, 2)} / ${raw.slice(2)}` : raw
}
/** The Luhn check, so a mistyped number is caught before the request. */
function luhn(value: string): boolean {
  const list = Array.from(digits(value)).reverse().map(Number)
  return list.reduce((sum, digit, index) => sum + (index % 2 ? (digit * 2 > 9 ? digit * 2 - 9 : digit * 2) : digit), 0) % 10 === 0
}
function brandOf(value: string): string | null {
  const raw = digits(value)
  if (raw.length < 4) return null
  return raw.startsWith('4') ? 'VISA' : raw.startsWith('5') ? 'MC' : isAmex(raw) ? 'AMEX' : null
}
function expiryIssue(value: string, now: Date): 'incomplete' | 'month' | 'expired' | null {
  const raw = digits(value)
  if (raw.length < 4) return 'incomplete'
  const month = Number(raw.slice(0, 2))
  if (month < 1 || month > 12) return 'month'
  return new Date(2000 + Number(raw.slice(2)), month, 1) <= now ? 'expired' : null
}

export type CardFieldProps = {
  /** The amount, shown as `Pay $48.00`. */
  amount: string
  label?: string
  defaultValue?: Partial<CardValue>
  /** Add a Use test card link. Keep it to test mode. */
  testCard?: boolean
  /** Do the payment here. The Button loads until the promise settles. A rejection returns to idle and shows `failedMessage`. */
  onPay?: (card: CardValue) => Promise<void> | void
  /** Fires when the payment succeeds. */
  onPaid?: () => void
  /** Controls the Button state. Leave it out to follow `onPay`. */
  status?: CardFieldStatus
  /** A message from the server. Wins over `failedMessage`. */
  error?: ReactNode
  /** Shown when `onPay` rejects, until the card is edited or paid again. */
  failedMessage?: ReactNode
  /** Draws the focus ring and helper on one part without focus, for specimens. */
  focusPart?: Part
  /** `false` turns off the shake, the chip pop and the ring fade. */
  animated?: boolean
  className?: string
}

/** Card payment in one field. Pay stays disabled until number, expiry and code are all valid. */
export function CardField({ amount, label = 'Card', defaultValue, testCard = false, onPay, onPaid, status, error, failedMessage = 'Payment failed. Try again.', focusPart, animated = true, className }: CardFieldProps) {
  const still = useStill(animated)
  const id = useId()
  const [card, setCard] = useState<CardValue>({ number: formatNumber(defaultValue?.number ?? ''), expiry: formatExpiry(defaultValue?.expiry ?? ''), cvc: digits(defaultValue?.cvc ?? '').slice(0, cvcLength(defaultValue?.number ?? '')) })
  const [focused, setFocused] = useState<Part | null>(null)
  const [touched, setTouched] = useState(false)
  const [own, setOwn] = useState<CardFieldStatus>('idle')
  const [failed, setFailed] = useState(false)
  const number = useRef<HTMLInputElement>(null)
  const expiry = useRef<HTMLInputElement>(null)
  const cvc = useRef<HTMLInputElement>(null)
  const jump = useRef(false)
  const controls = useAnimationControls()
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => setNow(new Date()), [])

  const state = status ?? own
  const busy = state !== 'idle'
  const active = focused ?? focusPart ?? null
  const amex = isAmex(card.number)
  const codeLength = cvcLength(card.number)
  const numberDone = digits(card.number).length === numberLength(card.number)
  const numberValid = numberDone && luhn(card.number)
  const issue = now ? expiryIssue(card.expiry, now) : 'incomplete'
  const showIssue = issue === 'expired' || (issue === 'month' && touched)
  const badNumber = numberDone && !numberValid
  const complete = numberValid && issue === null && card.cvc.length === codeLength
  const message = error ?? (failed ? failedMessage : null)
  const invalid = showIssue || badNumber || Boolean(message)
  const brand = brandOf(card.number)
  const collapsed = numberDone && active !== 'number'

  // Expiry and code mount once the number is complete, so the jump waits for that render.
  useEffect(() => {
    if (!jump.current || !numberDone) return
    jump.current = false
    expiry.current?.focus()
  }, [numberDone])

  useEffect(() => {
    if (!still && issue === 'expired') void controls.start(SHAKE)
  }, [issue, still, controls])

  const helper = message ?? (issue === 'expired' ? 'This card has expired' : showIssue ? 'Enter a valid month' : badNumber ? 'Check the card number' : active === 'cvc' ? `${codeLength} digits, on the ${amex ? 'front' : 'back'} of your card` : 'Encrypted end to end')

  function update(part: Part, raw: string): void {
    setFailed(false)
    const next = part === 'number' ? formatNumber(raw) : part === 'expiry' ? formatExpiry(raw) : digits(raw).slice(0, codeLength)
    setCard((current) => (part === 'number' ? { ...current, number: next, cvc: current.cvc.slice(0, cvcLength(next)) } : { ...current, [part]: next }))
    if (part === 'number' && digits(next).length === numberLength(next)) jump.current = true
    if (part === 'expiry' && digits(next).length === 4) cvc.current?.focus()
  }

  function pasteNumber(event: ClipboardEvent<HTMLInputElement>): void {
    event.preventDefault()
    update('number', event.clipboardData.getData('text'))
  }

  async function pay(): Promise<void> {
    if (!complete || busy) return
    setOwn('processing')
    setFailed(false)
    try {
      await onPay?.(card)
      setOwn('paid')
      onPaid?.()
    } catch {
      setOwn('idle')
      setFailed(true)
    }
  }

  const events = (part: Part) => ({
    onFocus: () => setFocused(part),
    onBlur: () => { setFocused((current) => (current === part ? null : current)); setTouched(true) },
    disabled: busy,
  })

  return (
    <div className={cx(styles.tray, className)} data-still={still ? '' : undefined} data-status={state}>
      <div className={styles.header}>
        <p className={styles.label} id={`${id}-label`}>{label}</p>
        {testCard ? <Button className={styles.test} variant="link" size="sm" disabled={busy} animated={animated} onClick={() => { setCard(TEST_CARD); setFailed(false) }}>Use test card</Button> : null}
      </div>
      <div className={styles.body}>
        <motion.div className={styles.field} role="group" aria-labelledby={`${id}-label`} animate={controls} data-focus={active && !invalid ? '' : undefined} data-invalid={invalid ? '' : undefined}>
          <span className={styles.brand} data-chip={brand ? '' : undefined}>
            <AnimatePresence mode="popLayout" initial={false}>
              {brand ? (
                <motion.span key={brand} className={styles.chip} initial={still ? false : { scale: 0.8 }} animate={{ scale: 1 }} transition={spring.pop}>{brand}</motion.span>
              ) : <span key="icon" className={styles.icon}><CreditCardIcon size={18} /></span>}
            </AnimatePresence>
          </span>
          <span className={styles.numberWrap} data-collapsed={collapsed ? '' : undefined}>
            <span className={styles.ghost} aria-hidden="true"><span className={styles.ghostTyped}>{card.number}</span>{card.number ? (amex ? AMEX_TEMPLATE : NUMBER_TEMPLATE).slice(card.number.length) : ''}</span>
            <input
              ref={number}
              id={`${id}-number`}
              className={styles.input}
              value={collapsed ? digits(card.number).slice(-4) : card.number}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="Card number"
              aria-label="Card number"
              aria-invalid={badNumber || undefined}
              aria-describedby={`${id}-helper`}
              onChange={(event) => update('number', event.target.value)}
              onPaste={pasteNumber}
              {...events('number')}
            />
          </span>
          {numberDone ? (
            <>
              <input
                ref={expiry}
                id={`${id}-expiry`}
                className={cx(styles.input, styles.expiry)}
                value={card.expiry}
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM / YY"
                aria-label="Expiry date"
                aria-invalid={showIssue || undefined}
                aria-describedby={`${id}-helper`}
                data-invalid={showIssue ? '' : undefined}
                onChange={(event) => update('expiry', event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Backspace' && !card.expiry) number.current?.focus() }}
                {...events('expiry')}
              />
              <input
                ref={cvc}
                id={`${id}-cvc`}
                className={cx(styles.input, styles.cvc)}
                value={card.cvc}
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="CVC"
                aria-label="Security code"
                aria-describedby={`${id}-helper`}
                onChange={(event) => update('cvc', event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Backspace' && !card.cvc) expiry.current?.focus() }}
                {...events('cvc')}
              />
            </>
          ) : null}
        </motion.div>
        <p id={`${id}-helper`} className={styles.helper} role="status" data-invalid={invalid ? '' : undefined}>
          {invalid ? <AlertCircleIcon size={13} /> : active === 'cvc' ? <InfoIcon size={13} /> : <LockIcon size={13} />}
          <span>{helper}</span>
        </p>
        <Button
          className={styles.pay}
          shape="pill"
          size="lg"
          disabled={!complete && !busy}
          status={state === 'processing' ? 'loading' : state === 'paid' ? 'success' : 'idle'}
          loadingLabel="Processing"
          successLabel={`Paid ${amount}`}
          animated={animated}
          onClick={() => void pay()}
        >
          {`Pay ${amount}`}
        </Button>
      </div>
    </div>
  )
}
