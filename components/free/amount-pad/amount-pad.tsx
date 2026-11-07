'use client'
import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { ArrowUpIcon } from '@fetaui/react/rounded/arrow-up'
import { Delete02Icon } from '@fetaui/react/rounded/delete-02'
import { delay, duration, ease, spring } from '../../motion-tokens'
import { Button } from '../button/button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './amount-pad.module.css'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'delete'] as const
const MAX_DIGITS = 9
const SHAKE = { x: [0, -10, 9, -6, 4, 0] }

type Phase = 'idle' | 'sending' | 'sent' | 'failed'

export type AmountPadProps = {
  /** Who receives it. */
  to?: string
  /** One or two letters for the avatar. */
  initials?: string
  /** The symbol before the amount. Default `$`. */
  currency?: string
  /** The code in the corner. Defaults to the code for `currency` ($ USD, € EUR, £ GBP, ¥ JPY), else `currency` itself. */
  currencyName?: string
  /** The note under the amount. */
  note?: string
  /** Amounts past this shake and disable Send. */
  limit?: number
  presets?: number[]
  /** Resolve to show Sent, reject to show Try again. */
  onSend?: (amount: number) => void | Promise<void>
  disabled?: boolean
  animated?: boolean
  className?: string
}

const CODES: Record<string, string> = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR', '₩': 'KRW' }

const money = (value: number): string => value.toLocaleString('en-US', { maximumFractionDigits: 2 })

/** A send money keypad. Digits spring in, commas slide into place, and Send carries the amount. */
export function AmountPad({ to = 'Noa Lindqvist', initials = 'NL', currency = '$', currencyName, note = 'Balance $4,210.00', limit = 5000, presets = [20, 50, 100], onSend, disabled = false, animated = true, className }: AmountPadProps) {
  const still = useStill(animated)
  const shake = useAnimationControls()
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const amount = Number(text || 0)
  const over = amount > limit
  const locked = disabled || phase === 'sending' || phase === 'sent'
  const [whole = '', cents] = text.split('.')
  const group = useMemo(() => Number(whole || 0).toLocaleString('en-US'), [whole])
  const chars = text ? [...group, ...(text.includes('.') ? ['.', ...(cents ?? '')] : [])] : ['0']
  const ghost = text.includes('.') ? '00'.slice((cents ?? '').length) : ''

  useEffect(() => {
    if (phase !== 'sent') return
    const timer = setTimeout(() => { setText(''); setPhase('idle') }, delay.reset * 1000)
    return () => clearTimeout(timer)
  }, [phase])

  function refuse(): void {
    if (!still) void shake.start({ ...SHAKE, transition: { duration: duration.shake, ease: ease.out } })
  }

  function press(key: (typeof KEYS)[number]): void {
    if (locked) return
    if (phase === 'failed') setPhase('idle')
    if (key === 'delete') { setText((t) => t.slice(0, -1)); return }
    if (key === '.' && text.includes('.')) return
    const next = key === '.' && !text ? '0.' : text === '0' && key !== '.' ? key : text + key
    const [, decimals] = next.split('.')
    if ((decimals?.length ?? 0) > 2 || next.replace('.', '').length > MAX_DIGITS) { refuse(); return }
    if (Number(next) > limit && !over) refuse()
    setText(next)
  }

  async function send(): Promise<void> {
    setPhase('sending')
    try {
      await onSend?.(amount)
      setPhase('sent')
    } catch {
      setPhase('failed')
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (/^[0-9.]$/.test(e.key)) { e.preventDefault(); press(e.key as (typeof KEYS)[number]) }
    else if (e.key === 'Backspace') { e.preventDefault(); press('delete') }
  }

  const message = over ? `The limit is ${currency}${money(limit)}` : phase === 'failed' ? 'That did not go through' : note
  const label = phase === 'sent' ? 'Sent' : phase === 'sending' ? 'Sending' : phase === 'failed' ? 'Try again' : amount ? `Send ${currency}${money(amount)}` : 'Enter an amount'

  return (
    <div role="group" aria-label={`Send money to ${to}`} tabIndex={0} className={cx(styles.pad, className)} data-still={still ? '' : undefined} onKeyDown={onKeyDown}>
      <div className={styles.header}>
        <span className={styles.avatar} aria-hidden="true">{initials}</span>
        <span className={styles.who}><span className={styles.small}>Send to</span>{to}</span>
        <span className={styles.currency}>{currencyName ?? CODES[currency] ?? currency}</span>
      </div>
      <div className={styles.body}>
        <motion.output animate={shake} className={styles.amount} data-empty={text ? undefined : ''} data-over={over ? '' : undefined} aria-label={`${currency}${money(amount)}`}>
          <span aria-hidden="true" className={styles.chars}>
            <span>{currency}</span>
            <AnimatePresence initial={false} mode="popLayout">
              {chars.map((char, i) => (
                <motion.span
                  key={`${chars.length - i}-${char}`}
                  layout={!still}
                  initial={still ? false : { y: 12, opacity: 0, filter: 'blur(4px)' }}
                  animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                  exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
                  transition={spring.digit}
                >
                  {char}
                </motion.span>
              ))}
            </AnimatePresence>
            {ghost ? <span className={styles.ghost}>{ghost}</span> : null}
          </span>
        </motion.output>
        <p className={styles.note} role="status" data-danger={over || phase === 'failed' ? '' : undefined}>{message}</p>
        <div role="group" aria-label="Presets" className={styles.presets}>
          {presets.map((preset) => (
            <button key={preset} type="button" disabled={locked} aria-pressed={amount === preset} className={styles.chip} onClick={() => setText(String(preset))}>{currency}{preset}</button>
          ))}
        </div>
        <div role="group" aria-label="Keypad" className={styles.keys}>
          {KEYS.map((key) => (
            <motion.button
              key={key}
              type="button"
              disabled={locked}
              aria-label={key === 'delete' ? 'Delete' : key === '.' ? 'Decimal point' : key}
              className={styles.key}
              {...(still || locked ? {} : { whileTap: { scale: 0.96 } })}
              transition={spring.press}
              onClick={() => press(key)}
            >
              {key === 'delete' ? <Delete02Icon /> : key}
            </motion.button>
          ))}
        </div>
        <Button
          size="lg"
          variant={phase === 'failed' ? 'destructive' : 'primary'}
          status={phase === 'sending' ? 'loading' : phase === 'sent' ? 'success' : 'idle'}
          loadingLabel="Sending"
          successLabel="Sent"
          animated={animated}
          disabled={locked && phase !== 'sending' && phase !== 'sent' ? true : !amount || over}
          trailingIcon={phase === 'idle' && amount && !over ? <ArrowUpIcon /> : undefined}
          className={styles.action}
          onClick={() => void send()}
        >
          {label}
        </Button>
      </div>
    </div>
  )
}
