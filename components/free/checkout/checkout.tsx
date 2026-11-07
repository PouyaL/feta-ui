'use client'
import { useId, useRef, useState, type ReactNode } from 'react'
import { MinusIcon } from '@fetaui/react/rounded/minus'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { BankIcon } from '@fetaui/react/rounded/bank'
import { WalletIcon } from '@fetaui/react/rounded/wallet'
import { Button } from '../button/button'
import { Checkbox } from '../checkbox/checkbox'
import { Field } from '../field/field'
import { Input } from '../input/input'
import { Radio } from '../radio/radio'
import { Select } from '../select/select'
import { Tabs } from '../tabs/tabs'
import { Panel, Stepper, Tween, cx } from '../data-kit/data-kit'
import styles from './checkout.module.css'

export type CheckoutPlan = { id: string; name: string; monthly: number; pitch: string }
export type CheckoutAddOn = { id: string; name: string; pitch: string; monthly: number }

export type CheckoutBilling = { email: string; name: string; country: string; city: string; postalCode: string }
export type CheckoutCard = { number: string; expiry: string; cvc: string }
/** Everything the order and the form hold when Pay is pressed. */
export type CheckoutOrder = {
  plan: string
  cycle: 'monthly' | 'yearly'
  seats: number
  addOns: string[]
  subtotal: number
  tax: number
  billing: CheckoutBilling
  card: CheckoutCard
}

export type CheckoutProps = {
  plans: CheckoutPlan[]
  addOns: CheckoutAddOn[]
  defaultPlan?: string
  defaultAddOns?: string[]
  defaultSeats?: number
  /** Yearly discount, 0 to 1. */
  yearlyDiscount?: number
  countries?: string[]
  /** Tax rate, 0 to 1. */
  tax?: number
  taxLabel?: string
  /** Resolve when the payment has finished. Gets the total and the whole order. */
  onPay?: (total: number, order: CheckoutOrder) => Promise<void> | void
  /** Wallet pay. Gets the total and the order without card fields. */
  onWalletPay?: (total: number, order: CheckoutOrder) => void
  /** Bank. Gets the total and the order without card fields. */
  onBankPay?: (total: number, order: CheckoutOrder) => void
  onAddCoupon?: () => void
  /** Prefills the billing fields. The sample values show when this is left out. */
  defaultBilling?: Partial<CheckoutBilling>
  /** Adds a Use test card link. Keep it to test mode. Default `true`. */
  testCard?: boolean
  /** The line under Pay before anything happens. */
  note?: ReactNode
  /** Shown under Pay when `onPay` rejects. */
  failedMessage?: ReactNode
  /** Starts in the Processing state. */
  processing?: boolean
  animated?: boolean
  className?: string | undefined
}

const SAMPLE_BILLING: CheckoutBilling = { email: 'emma@northwind.studio', name: 'Emma Collins', country: '', city: 'Berlin', postalCode: '10119' }
const cents = (value: number): number => Math.round(value * 100) / 100
const usd = (value: number): string => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Checkout: express pay, plan, seats, add-ons, billing and card fields, a Pay Button and a live order summary. */
export function Checkout({ plans, addOns, defaultPlan, defaultAddOns = [], defaultSeats = 8, yearlyDiscount = 0.2, countries = ['Germany', 'France', 'Netherlands'], tax = 0.19, taxLabel = 'VAT 19%', onPay, onWalletPay, onBankPay, onAddCoupon, defaultBilling, testCard = true, note = 'Simulated payment. No card is charged.', failedMessage = 'Payment failed. Try again.', processing = false, animated = true, className }: CheckoutProps) {
  const id = useId()
  const [cycle, setCycle] = useState('yearly')
  const [planId, setPlanId] = useState(defaultPlan ?? plans[0]?.id ?? '')
  const [seats, setSeats] = useState(defaultSeats)
  const [extras, setExtras] = useState(defaultAddOns)
  const [busy, setBusy] = useState(processing)
  const [failed, setFailed] = useState(false)
  /** The amount charged, once payment has gone through. */
  const [paid, setPaid] = useState<number | null>(null)
  // A ref as well as state, so a second submit can never get past the guard. Stays set after a successful payment.
  const paying = useRef(processing)
  const [number, setNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [billing, setBilling] = useState<CheckoutBilling>(() => {
    const start = defaultBilling ? { ...SAMPLE_BILLING, email: '', name: '', city: '', postalCode: '', ...defaultBilling } : SAMPLE_BILLING
    return { ...start, country: start.country || countries[0] || '' }
  })
  const bill = (key: keyof CheckoutBilling) => (value: string): void => setBilling((now) => ({ ...now, [key]: value }))
  /** Locks the order while paying and after it is paid, so the total cannot drift from the charge. */
  const locked = busy || paid !== null
  const yearly = cycle === 'yearly'
  const factor = yearly ? 1 - yearlyDiscount : 1
  const months = yearly ? 12 : 1
  const plan = plans.find((item) => item.id === planId)
  // Every line is rounded to cents first, so the summary always adds up to Due today.
  const planTotal = cents((plan?.monthly ?? 0) * factor * seats * months)
  const chosen = addOns.filter((item) => extras.includes(item.id))
  const lineOf = (item: CheckoutAddOn): number => cents(item.monthly * factor * months)
  const subtotal = cents(chosen.reduce((sum, item) => sum + lineOf(item), planTotal))
  const vat = cents(subtotal * tax)
  const due = cents(subtotal + vat)
  const order = (card: CheckoutCard): CheckoutOrder => ({ plan: planId, cycle: yearly ? 'yearly' : 'monthly', seats, addOns: chosen.map((item) => item.id), subtotal, tax: vat, billing, card })

  async function pay(): Promise<void> {
    if (paying.current) return
    paying.current = true
    setBusy(true)
    setFailed(false)
    try {
      await onPay?.(due, order({ number, expiry, cvc }))
      setPaid(due)
    } catch {
      paying.current = false
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel width={860} shell="tray" animated={animated} className={className} label="Checkout">
      <div className={styles.layout}>
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void pay() }} aria-busy={busy}>
          <fieldset className={styles.lock} disabled={locked}>
            <div className={styles.express}>
              <Button shape="pill" type="button" leadingIcon={<WalletIcon size={16} />} disabled={locked} onClick={() => onWalletPay?.(due, order({ number: '', expiry: '', cvc: '' }))} animated={animated}>Wallet pay</Button>
              <Button variant="secondary" shape="pill" type="button" leadingIcon={<BankIcon size={16} />} disabled={locked} onClick={() => onBankPay?.(due, order({ number: '', expiry: '', cvc: '' }))} animated={animated}>Bank</Button>
            </div>
            <p className={styles.divider}><span>Or pay with card</span></p>

            <div className={styles.group}>
              <div className={styles.line}>
                <span className={styles.legend}>Plan</span>
                <Tabs label="Billing period" value={cycle} onValueChange={setCycle} animated={animated} items={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: `Yearly −${Math.round(yearlyDiscount * 100)}%` }]} />
              </div>
              <div className={styles.options} role="radiogroup" aria-label="Plan">
                {plans.map((item) => (
                  <label key={item.id} className={styles.option} data-on={item.id === planId ? '' : undefined}>
                    <span className={styles.optionTop}><span className={styles.optionName}>{item.name}</span><Radio name={`${id}-plan`} checked={item.id === planId} onChange={() => setPlanId(item.id)} animated={animated} /></span>
                    <Tween className={styles.optionPrice} value={item.monthly * factor} format={usd} animated={animated} />
                    <span className={styles.mono}>per seat / mo</span>
                    <span className={styles.pitch}>{item.pitch}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.seats}><span>Seats</span><Stepper label="seats" value={seats} min={1} onChange={setSeats} minusIcon={<MinusIcon size={14} aria-hidden="true" />} plusIcon={<PlusIcon size={14} aria-hidden="true" />} /></div>

            <fieldset className={styles.group}>
              <legend className={styles.legend}>Add-ons</legend>
              <div className={styles.addOns}>
                {addOns.map((item) => (
                  <label key={item.id} className={styles.addOn}>
                    <Checkbox checked={extras.includes(item.id)} onCheckedChange={(on) => setExtras((list) => (on ? [...list, item.id] : list.filter((x) => x !== item.id)))} animated={animated} />
                    <span className={styles.addOnText}><span>{item.name}</span><span className={styles.small}>{item.pitch}</span></span>
                    <span className={styles.addOnPrice}>{usd(item.monthly * factor)} / mo</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.group}>
              <legend className={styles.legend}>Billing details</legend>
              <Field label="Email"><Input type="email" autoComplete="email" value={billing.email} onChange={(e) => bill('email')(e.target.value)} animated={animated} /></Field>
              <Field label="Name on card"><Input autoComplete="cc-name" value={billing.name} onChange={(e) => bill('name')(e.target.value)} animated={animated} /></Field>
              <Field label="Country"><Select options={countries.map((value) => ({ value, label: value }))} value={billing.country} onValueChange={bill('country')} disabled={locked} aria-label="Country" animated={animated} /></Field>
              <div className={styles.two}>
                <Field label="City"><Input autoComplete="address-level2" value={billing.city} onChange={(e) => bill('city')(e.target.value)} animated={animated} /></Field>
                <Field label="Postal code"><Input autoComplete="postal-code" value={billing.postalCode} onChange={(e) => bill('postalCode')(e.target.value)} animated={animated} /></Field>
              </div>
            </fieldset>

            <fieldset className={styles.group}>
              <legend className={styles.legendHidden}>Card</legend>
              <div className={styles.line}><span className={styles.legend} aria-hidden="true">Card</span>{testCard ? <button type="button" className={styles.linkButton} onClick={() => { setNumber('4242 4242 4242 4242'); setExpiry('12/30'); setCvc('123') }}>Use test card</button> : null}</div>
              <Field label="Card number"><Input inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234" value={number} onChange={(e) => setNumber(e.target.value)} animated={animated} /></Field>
              <div className={styles.two}>
                <Field label="Expiry"><Input autoComplete="cc-exp" placeholder="MM/YY" value={expiry} onChange={(e) => setExpiry(e.target.value)} animated={animated} /></Field>
                <Field label="CVC"><Input inputMode="numeric" autoComplete="cc-csc" placeholder="123" value={cvc} onChange={(e) => setCvc(e.target.value)} animated={animated} /></Field>
              </div>
            </fieldset>
          </fieldset>

          <Button type="submit" size="lg" shape="pill" className={cx(styles.pay)} status={busy ? 'loading' : paid === null ? 'idle' : 'success'} loadingLabel="Processing payment" successLabel={`Paid ${usd(paid ?? due)}`} animated={animated}>Pay {usd(due)}</Button>
          <p className={styles.fine} role="status" data-failed={failed ? '' : undefined}>{paid !== null ? 'Payment complete.' : failed ? failedMessage : note}</p>
        </form>

        <aside className={styles.summary} aria-label="Order summary">
          <h3 className={styles.summaryTitle}>Order summary</h3>
          <div className={styles.item}><span className={styles.itemText}><span>{plan?.name} plan</span><span className={styles.small}>{seats} {seats === 1 ? 'seat' : 'seats'} × {usd((plan?.monthly ?? 0) * factor)} × {months} {months === 1 ? 'month' : 'months'}</span></span><Tween value={planTotal} format={usd} animated={animated} /></div>
          {chosen.map((item) => <div key={item.id} className={styles.item}><span className={styles.itemText}><span>{item.name}</span><span className={styles.small}>Billed {yearly ? 'yearly' : 'monthly'}</span></span><Tween value={lineOf(item)} format={usd} animated={animated} /></div>)}
          <Button variant="ghost" size="sm" leadingIcon={<PlusIcon size={14} />} disabled={locked} onClick={onAddCoupon} animated={animated} className={cx(styles.coupon)}>Add coupon</Button>
          <div className={styles.totals}>
            <div className={styles.total}><span>Subtotal</span><Tween value={subtotal} format={usd} animated={animated} /></div>
            <div className={styles.total}><span>{taxLabel}</span><Tween value={vat} format={usd} animated={animated} /></div>
          </div>
          <div className={styles.due}><span>Due today</span><Tween className={styles.dueValue} value={due} format={usd} animated={animated} /></div>
        </aside>
      </div>
    </Panel>
  )
}
