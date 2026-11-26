import { useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { radius, space, type Colors } from '../kit'
import { Button, SELF } from './button'
import { Panel, type RenderIcon, type, useThemed } from './card'
import { Checkbox } from './checkbox'
import { Field } from './field'
import { IconButton } from './icon-button'
import { Input } from './input'
import { Radio } from './radio'
import { Select } from './select'
import { Tabs } from './tabs'
import { Tween } from './usage-meter'

export type CheckoutPlan = { id: string; name: string; monthly: number; pitch: string }
export type CheckoutAddOn = { id: string; name: string; pitch: string; monthly: number }

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
  renderIcon: RenderIcon
  /** Prefills the billing fields. The sample values show when this is left out. */
  defaultBilling?: { email?: string; name?: string; city?: string; postalCode?: string }
  onAddCoupon?: () => void
  /** Resolve when the payment has finished. */
  onPay?: (total: number) => Promise<void> | void
  /** Starts in the Processing state. */
  processing?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const usd = (value: number): string => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Checkout: express pay, plan, seats, add-ons, billing and card fields, a Pay Button and a live order summary. */
export function Checkout({ plans, addOns, defaultPlan, defaultAddOns = [], defaultSeats = 8, yearlyDiscount = 0.2, countries = ['Germany', 'France', 'Netherlands'], tax = 0.19, taxLabel = 'VAT 19%', renderIcon, defaultBilling, onAddCoupon, onPay, processing = false, animated = true, style }: CheckoutProps) {
  const styles = useThemed(createStyles)
  const [cycle, setCycle] = useState('yearly')
  const [planId, setPlanId] = useState(defaultPlan ?? plans[0]?.id ?? '')
  const [seats, setSeats] = useState(defaultSeats)
  const [extras, setExtras] = useState(defaultAddOns)
  const [busy, setBusy] = useState(processing)
  const [country, setCountry] = useState(countries[0] ?? '')
  // The web's sample billing, so the form reads filled in.
  const [email, setEmail] = useState(defaultBilling?.email ?? 'emma@northwind.example')
  const [name, setName] = useState(defaultBilling?.name ?? 'Emma Collins')
  const [city, setCity] = useState(defaultBilling?.city ?? 'Berlin')
  const [postal, setPostal] = useState(defaultBilling?.postalCode ?? '10119')
  const [number, setNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const yearly = cycle === 'yearly'
  const factor = yearly ? 1 - yearlyDiscount : 1
  const months = yearly ? 12 : 1
  const plan = plans.find((item) => item.id === planId)
  const planTotal = (plan?.monthly ?? 0) * factor * seats * months
  const chosen = addOns.filter((item) => extras.includes(item.id))
  const subtotal = chosen.reduce((sum, item) => sum + item.monthly * factor * months, planTotal)
  const vat = subtotal * tax
  const due = subtotal + vat

  async function pay(): Promise<void> {
    setBusy(true)
    await onPay?.(due)
    setBusy(false)
  }

  const money = (value: number, big = false) => <Tween value={value} format={usd} animated={animated} style={big ? styles.dueValue : styles.amount} />
  const plural = (count: number, word: string): string => `${count} ${count === 1 ? word : `${word}s`}`

  // The web's mobile order: the summary card first, then the form straight on the tray, then Pay.
  return (
    <Panel shell="tray" animated={animated} label="Checkout" style={[styles.tray, style]}>
      <View accessibilityLabel="Order summary" style={styles.summary}>
        <Text style={styles.summaryTitle} accessibilityRole="header">Order summary</Text>
        <View style={styles.item}><View style={styles.text}><Text style={styles.label}>{plan?.name} plan</Text><Text style={styles.tertiary}>{plural(seats, 'seat')} × {usd((plan?.monthly ?? 0) * factor)} × {plural(months, 'month')}</Text></View>{money(planTotal)}</View>
        {chosen.map((item) => <View key={item.id} style={styles.item}><View style={styles.text}><Text style={styles.label}>{item.name}</Text><Text style={styles.tertiary}>Billed {yearly ? 'yearly' : 'monthly'}</Text></View>{money(item.monthly * factor * months)}</View>)}
        <Button variant="ghost" size="sm" leadingIcon={renderIcon('plus', 14)} animated={animated} disabled={busy} {...(onAddCoupon ? { onPress: onAddCoupon } : {})}>Add coupon</Button>
        <View style={styles.totals}>
          <View style={styles.line}><Text style={styles.small}>Subtotal</Text><Tween value={subtotal} format={usd} animated={animated} style={styles.small} /></View>
          <View style={styles.line}><Text style={styles.small}>{taxLabel}</Text><Tween value={vat} format={usd} animated={animated} style={styles.small} /></View>
        </View>
        <View style={styles.due}><Text style={styles.label}>Due today</Text>{money(due, true)}</View>
      </View>

      <View style={styles.form} aria-busy={busy}>
        <View style={styles.row}>
          <Button shape="pill" leadingIcon={renderIcon('wallet', 16)} animated={animated} style={styles.half}>Wallet pay</Button>
          <Button variant="secondary" shape="pill" leadingIcon={renderIcon('bank', 16)} animated={animated} style={styles.half}>Bank</Button>
        </View>
        <View style={styles.divider}><View style={styles.rule} /><Text style={styles.small}>Or pay with card</Text><View style={styles.rule} /></View>
        <View style={styles.group}>
          <View style={styles.line}>
            <Text style={styles.legend}>Plan</Text>
            <Tabs label="Billing period" value={cycle} onValueChange={setCycle} animated={animated} items={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: `Yearly −${Math.round(yearlyDiscount * 100)}%` }]} />
          </View>
          <View accessibilityRole="radiogroup" style={styles.options}>
            {plans.map((item) => {
              const on = item.id === planId
              return (
                <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={`${item.name}, ${usd(item.monthly * factor)} per seat a month. ${item.pitch}`} aria-checked={on} onPress={() => setPlanId(item.id)} style={[styles.option, on && styles.on]}>
                  <View style={styles.line}><Text style={styles.optionName}>{item.name}</Text><Radio decorative checked={on} animated={animated} /></View>
                  <Tween value={item.monthly * factor} format={usd} animated={animated} style={styles.label} />
                  <Text style={styles.mono}>per seat / mo</Text>
                  <Text numberOfLines={1} style={[styles.small, on && styles.pitchOn]}>{item.pitch}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>
        <View style={styles.seatsRow}>
          <Text style={styles.label}>Seats</Text>
          <View accessibilityLabel="seats" style={styles.stepper}>
            <IconButton variant="outline" size="sm" label="Decrease seats" disabled={seats <= 1} icon={renderIcon('minus', 14)} onPress={() => setSeats(seats - 1)} animated={animated} style={[styles.step, SELF.center]} />
            <Text accessibilityLiveRegion="polite" style={styles.seats}>{seats}</Text>
            <IconButton variant="outline" size="sm" label="Increase seats" disabled={seats >= 999} icon={renderIcon('plus', 14)} onPress={() => setSeats(seats + 1)} animated={animated} style={[styles.step, SELF.center]} />
          </View>
        </View>
        <View style={styles.group}>
          <Text style={styles.legend}>Add-ons</Text>
          <View style={styles.addOns}>
            {addOns.map((item) => (
              <View key={item.id} style={styles.addOn}>
                <Checkbox accessibilityLabel={item.name} checked={extras.includes(item.id)} onCheckedChange={(on) => setExtras((list) => (on ? [...list, item.id] : list.filter((x) => x !== item.id)))} animated={animated} />
                <View style={styles.text}><Text style={styles.label}>{item.name}</Text><Text style={styles.tertiary}>{item.pitch}</Text></View>
                <Text style={styles.small}>{usd(item.monthly * factor)} / mo</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.group}>
          <Text style={styles.legend}>Billing details</Text>
          <Field label="Email"><Input autoComplete="email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} animated={animated} /></Field>
          <Field label="Name on card"><Input autoComplete="cc-name" value={name} onChangeText={setName} animated={animated} /></Field>
          <Field label="Country"><Select options={countries.map((value) => ({ value, label: value }))} value={country} onValueChange={setCountry} accessibilityLabel="Country" animated={animated} /></Field>
          <View style={styles.row}>
            <View style={styles.text}><Field label="City"><Input value={city} onChangeText={setCity} animated={animated} /></Field></View>
            <View style={styles.text}><Field label="Postal code"><Input autoComplete="postal-code" value={postal} onChangeText={setPostal} animated={animated} /></Field></View>
          </View>
        </View>
        <View style={styles.group}>
          <View style={styles.line}><Text style={styles.legend}>Card</Text><Button style={SELF.center} variant="link" size="sm" animated={animated} onPress={() => { setNumber('4242 4242 4242 4242'); setExpiry('12/30'); setCvc('123') }}>Use test card</Button></View>
          <Field label="Card number"><Input keyboardType="number-pad" autoComplete="cc-number" placeholder="1234 1234 1234 1234" value={number} onChangeText={setNumber} animated={animated} /></Field>
          <View style={styles.row}>
            <View style={styles.text}><Field label="Expiry"><Input autoComplete="cc-exp" placeholder="MM/YY" value={expiry} onChangeText={setExpiry} animated={animated} /></Field></View>
            <View style={styles.text}><Field label="CVC"><Input keyboardType="number-pad" autoComplete="cc-csc" placeholder="123" value={cvc} onChangeText={setCvc} animated={animated} /></Field></View>
          </View>
        </View>
        <View style={styles.pay}>
          <Button size="lg" shape="pill" status={busy ? 'loading' : 'idle'} loadingLabel="Processing payment" animated={animated} style={styles.payButton} onPress={() => void pay()}>Pay {usd(due)}</Button>
          <Text style={styles.fine}>Simulated payment. No card is charged.</Text>
        </View>
      </View>
    </Panel>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { borderRadius: radius.tray, padding: space[5] },
  summary: { backgroundColor: c.surface, borderRadius: radius.card, gap: space[3], marginBottom: space[5], padding: space[4] },
  summaryTitle: { ...type(18, c.textPrimary, '500'), lineHeight: 24 },
  item: { alignItems: 'flex-start', borderBottomColor: c.ink5, borderBottomWidth: 1, flexDirection: 'row', gap: space[3], justifyContent: 'space-between', paddingBottom: space[3] },
  totals: { borderTopColor: c.ink5, borderTopWidth: 1, gap: space[2], paddingTop: space[3] },
  due: { alignItems: 'baseline', borderTopColor: c.ink5, borderTopWidth: 1, flexDirection: 'row', gap: space[3], justifyContent: 'space-between', paddingTop: space[3] },
  form: { gap: space[4] },
  row: { flexDirection: 'row', gap: space[2] },
  half: { flex: 1 },
  divider: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
  rule: { backgroundColor: c.ink8, flex: 1, height: 1 },
  group: { gap: space[2.5] },
  legend: { ...type(16, c.textPrimary, '500'), lineHeight: 22 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  // Two columns, as the web grid under 420 px.
  option: { backgroundColor: c.surface, borderColor: 'transparent', borderRadius: radius.control, borderWidth: 2, gap: space[0.5], minWidth: 0, padding: space[3] - 2, width: '48.5%' },
  on: { borderColor: c.textPrimary },
  optionName: { ...type(18, c.textPrimary, '500'), lineHeight: 24 },
  mono: { ...type(10, c.textTertiary, '400', true), lineHeight: 12 },
  pitchOn: { color: c.success },
  line: { alignItems: 'center', flexDirection: 'row', gap: space[3], justifyContent: 'space-between' },
  label: { ...type(16, c.textPrimary, '500'), lineHeight: 22 },
  small: { ...type(12, c.textSecondary), lineHeight: 16 },
  tertiary: { ...type(12, c.textTertiary), lineHeight: 16 },
  text: { flex: 1, minWidth: 0 },
  amount: { ...type(16, c.textPrimary, '500'), lineHeight: 22 },
  seatsRow: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.control, flexDirection: 'row', justifyContent: 'space-between', padding: space[1.5], paddingLeft: space[3] },
  stepper: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, flexDirection: 'row', gap: space[1], padding: space[0.5] },
  step: { backgroundColor: c.surface, borderRadius: radius.full },
  seats: { ...type(16, c.textPrimary, '500'), minWidth: 32, textAlign: 'center' },
  addOns: { backgroundColor: c.surface, borderRadius: radius.control },
  addOn: { alignItems: 'center', flexDirection: 'row', gap: space[3], minHeight: 52, paddingHorizontal: space[3], paddingVertical: space[1.5] },
  dueValue: { ...type(28, c.textPrimary, '600'), lineHeight: 34 },
  pay: { gap: space[4] },
  payButton: { alignSelf: 'stretch' },
  fine: { ...type(12, c.textTertiary), textAlign: 'center' },
})
