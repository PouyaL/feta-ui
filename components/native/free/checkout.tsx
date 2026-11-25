import { useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { radius, space, type Colors } from '../kit'
import { Button } from './button'
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
  /** Resolve when the payment has finished. */
  onPay?: (total: number) => Promise<void> | void
  /** Starts in the Processing state. */
  processing?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const usd = (value: number): string => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Checkout: express pay, plan, seats, add-ons, billing and card fields, a Pay Button and a live order summary. */
export function Checkout({ plans, addOns, defaultPlan, defaultAddOns = [], defaultSeats = 8, yearlyDiscount = 0.2, countries = ['Germany', 'France', 'Netherlands'], tax = 0.19, taxLabel = 'VAT 19%', renderIcon, onPay, processing = false, animated = true, style }: CheckoutProps) {
  const styles = useThemed(createStyles)
  const [cycle, setCycle] = useState('yearly')
  const [planId, setPlanId] = useState(defaultPlan ?? plans[0]?.id ?? '')
  const [seats, setSeats] = useState(defaultSeats)
  const [extras, setExtras] = useState(defaultAddOns)
  const [busy, setBusy] = useState(processing)
  const [country, setCountry] = useState(countries[0] ?? '')
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

  return (
    <Panel shell="tray" animated={animated} label="Checkout" style={style}>
      <View style={styles.form} aria-busy={busy}>
        <View style={styles.row}>
          <Button shape="pill" leadingIcon={renderIcon('wallet', 16)} animated={animated}>Wallet pay</Button>
          <Button variant="secondary" shape="pill" leadingIcon={renderIcon('bank', 16)} animated={animated}>Bank</Button>
        </View>
        <Text style={styles.divider}>Or pay with card</Text>
        <View style={styles.group}>
          <Text style={styles.legend}>Plan</Text>
          <Tabs label="Billing period" value={cycle} onValueChange={setCycle} animated={animated} items={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: `Yearly −${Math.round(yearlyDiscount * 100)}%` }]} />
          <View accessibilityRole="radiogroup" style={styles.group}>
            {plans.map((item) => {
              const on = item.id === planId
              return (
                <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={`${item.name}, ${usd(item.monthly * factor)} per seat a month. ${item.pitch}`} aria-checked={on} onPress={() => setPlanId(item.id)} style={[styles.option, on && styles.on]}>
                  <View style={styles.line}><Text style={styles.name}>{item.name}</Text><Radio decorative checked={on} animated={animated} /></View>
                  {money(item.monthly * factor)}
                  <Text style={styles.small}>per seat / mo · {item.pitch}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>
        <View style={styles.line}>
          <Text style={styles.name}>Seats</Text>
          <View accessibilityLabel="seats" style={styles.stepper}>
            <IconButton variant="ghost" size="sm" label="Decrease seats" disabled={seats <= 1} icon={renderIcon('minus', 14)} onPress={() => setSeats(seats - 1)} animated={animated} />
            <Text accessibilityLiveRegion="polite" style={styles.seats}>{seats}</Text>
            <IconButton variant="ghost" size="sm" label="Increase seats" disabled={seats >= 999} icon={renderIcon('plus', 14)} onPress={() => setSeats(seats + 1)} animated={animated} />
          </View>
        </View>
        <View style={styles.group}>
          <Text style={styles.legend}>Add-ons</Text>
          {addOns.map((item) => (
            <View key={item.id} style={styles.addOn}>
              <Checkbox accessibilityLabel={item.name} checked={extras.includes(item.id)} onCheckedChange={(on) => setExtras((list) => (on ? [...list, item.id] : list.filter((x) => x !== item.id)))} animated={animated} />
              <View style={styles.text}><Text style={styles.name}>{item.name}</Text><Text style={styles.small}>{item.pitch}</Text></View>
              <Text style={styles.small}>${item.monthly} / mo</Text>
            </View>
          ))}
        </View>
        <View style={styles.group}>
          <Text style={styles.legend}>Billing details</Text>
          <Field label="Email"><Input autoComplete="email" keyboardType="email-address" autoCapitalize="none" animated={animated} /></Field>
          <Field label="Name on card"><Input autoComplete="cc-name" animated={animated} /></Field>
          <Field label="Country"><Select options={countries.map((value) => ({ value, label: value }))} value={country} onValueChange={setCountry} accessibilityLabel="Country" animated={animated} /></Field>
          <View style={styles.row}>
            <View style={styles.text}><Field label="City"><Input animated={animated} /></Field></View>
            <View style={styles.text}><Field label="Postal code"><Input autoComplete="postal-code" animated={animated} /></Field></View>
          </View>
        </View>
        <View style={styles.group}>
          <View style={styles.line}><Text style={styles.legend}>Card</Text><Button variant="link" size="sm" animated={animated} onPress={() => { setNumber('4242 4242 4242 4242'); setExpiry('12/30'); setCvc('123') }}>Use test card</Button></View>
          <Field label="Card number"><Input keyboardType="number-pad" autoComplete="cc-number" placeholder="1234 1234 1234 1234" value={number} onChangeText={setNumber} animated={animated} /></Field>
          <View style={styles.row}>
            <View style={styles.text}><Field label="Expiry"><Input autoComplete="cc-exp" placeholder="MM/YY" value={expiry} onChangeText={setExpiry} animated={animated} /></Field></View>
            <View style={styles.text}><Field label="CVC"><Input keyboardType="number-pad" autoComplete="cc-csc" placeholder="123" value={cvc} onChangeText={setCvc} animated={animated} /></Field></View>
          </View>
        </View>
      </View>
      <View accessibilityLabel="Order summary" style={styles.summary}>
        <Text style={styles.name} accessibilityRole="header">Order summary</Text>
        <View style={styles.line}><View style={styles.text}><Text style={styles.name}>{plan?.name} plan</Text><Text style={styles.small}>{seats} seats × {usd((plan?.monthly ?? 0) * factor)} × {months} months</Text></View>{money(planTotal)}</View>
        {chosen.map((item) => <View key={item.id} style={styles.line}><View style={styles.text}><Text style={styles.name}>{item.name}</Text><Text style={styles.small}>Billed {yearly ? 'yearly' : 'monthly'}</Text></View>{money(item.monthly * factor * months)}</View>)}
        <View style={styles.line}><Text style={styles.small}>Subtotal</Text>{money(subtotal)}</View>
        <View style={styles.line}><Text style={styles.small}>{taxLabel}</Text>{money(vat)}</View>
        <View style={styles.line}><Text style={styles.name}>Due today</Text>{money(due, true)}</View>
      </View>
      <View style={styles.pay}>
        <Button size="lg" shape="pill" status={busy ? 'loading' : 'idle'} loadingLabel="Processing payment" animated={animated} onPress={() => void pay()}>Pay {usd(due)}</Button>
        <Text style={styles.fine}>Simulated payment. No card is charged.</Text>
      </View>
    </Panel>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  form: { backgroundColor: c.surface, borderRadius: radius.card, gap: space[5], padding: space[4] },
  row: { flexDirection: 'row', gap: space[2] },
  divider: { ...type(12, c.textTertiary), textAlign: 'center' },
  group: { gap: space[2] },
  legend: type(14, c.textPrimary, '600'),
  option: { borderColor: c.ink8, borderRadius: radius.control, borderWidth: 1, gap: space[1], padding: space[3] },
  on: { borderColor: c.textPrimary },
  line: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  name: type(14, c.textPrimary, '500'),
  small: type(12, c.textSecondary),
  text: { flex: 1, gap: space[0.5] },
  amount: type(14, c.textPrimary, '500'),
  stepper: { alignItems: 'center', flexDirection: 'row', gap: space[1] },
  seats: { ...type(14, c.textPrimary, '500', true), minWidth: 32, textAlign: 'center' },
  addOn: { alignItems: 'center', flexDirection: 'row', gap: space[3], minHeight: 44 },
  summary: { gap: space[3], padding: space[4] },
  dueValue: type(20, c.textPrimary, '500'),
  pay: { gap: space[2], paddingBottom: space[3], paddingHorizontal: space[3] },
  fine: { ...type(12, c.textTertiary), textAlign: 'center' },
})
