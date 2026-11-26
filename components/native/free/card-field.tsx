import { useEffect, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, TextInput, type TextInputInstance, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, LayoutAnimationConfig, ZoomIn, interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors } from '../kit'
import { Button, withInk, SELF } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'

/** Expired: x 0, 4, -4, 0 over 300 ms. */
const SHAKE_STEP = { duration: 100 }
const SHAKE_X = 4
const FADE = { duration: 150, easing: Easing.bezierFn(0.23, 1, 0.32, 1) }
const chipIn = ZoomIn.springify().stiffness(420).damping(26).withInitialValues({ transform: [{ scale: 0.8 }] })
const NUMBER_LENGTH = 16
const NUMBER_TEMPLATE = '0000 0000 0000 0000'
const CVC_LENGTH = 3
const TEST_CARD: CardValue = { number: '4242 4242 4242 4242', expiry: '12 / 28', cvc: '123' }

export type CardValue = { number: string; expiry: string; cvc: string }
export type CardFieldStatus = 'idle' | 'processing' | 'paid'
type Part = 'number' | 'expiry' | 'cvc'

const digits = (value: string): string => value.replace(/\D/g, '')
const formatNumber = (value: string): string => digits(value).slice(0, NUMBER_LENGTH).replace(/(\d{4})(?=\d)/g, '$1 ')
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
  return raw.startsWith('4') ? 'VISA' : raw.startsWith('5') ? 'MC' : raw.startsWith('3') ? 'AMEX' : null
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
  /** Do the payment here. The Button loads until the promise settles. A rejection returns to idle. */
  onPay?: (card: CardValue) => Promise<void> | void
  /** Fires when the payment succeeds. */
  onPaid?: () => void
  /** Controls the Button state. Leave it out to follow `onPay`. */
  status?: CardFieldStatus
  /** A message from the server. */
  error?: ReactNode
  /** Draws the focus ring and helper on one part without focus, for specimens. */
  focusPart?: Part
  renderIcon: RenderIcon
  /** `false` turns off the shake, the chip pop and the ring fade. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Card payment in one field. Pay stays disabled until number, expiry and code are all valid. */
export function CardField({ amount, label = 'Card', defaultValue, testCard = false, onPay, onPaid, status, error, focusPart, renderIcon, animated = true, style }: CardFieldProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [card, setCard] = useState<CardValue>({ number: formatNumber(defaultValue?.number ?? ''), expiry: formatExpiry(defaultValue?.expiry ?? ''), cvc: digits(defaultValue?.cvc ?? '').slice(0, CVC_LENGTH) })
  const [focused, setFocused] = useState<Part | null>(null)
  const [touched, setTouched] = useState(false)
  const [own, setOwn] = useState<CardFieldStatus>('idle')
  const number = useRef<TextInputInstance>(null)
  const expiry = useRef<TextInputInstance>(null)
  const cvc = useRef<TextInputInstance>(null)
  const jump = useRef(false)
  const shake = useSharedValue(0)
  const [now] = useState(() => new Date())

  const state = status ?? own
  const busy = state !== 'idle'
  const active = focused ?? focusPart ?? null
  const numberDone = digits(card.number).length === NUMBER_LENGTH
  const numberValid = numberDone && luhn(card.number)
  const issue = expiryIssue(card.expiry, now)
  const showIssue = issue === 'expired' || (issue === 'month' && touched)
  const badNumber = numberDone && !numberValid
  const complete = numberValid && issue === null && card.cvc.length === CVC_LENGTH
  const invalid = showIssue || badNumber || Boolean(error)
  const brand = brandOf(card.number)
  const collapsed = numberDone && active !== 'number'
  const ringed = Boolean(active) && !invalid

  // Expiry and code mount once the number is complete, so the jump waits for that render.
  useEffect(() => {
    if (!jump.current || !numberDone) return
    jump.current = false
    expiry.current?.focus()
  }, [numberDone])

  useEffect(() => {
    if (!still && issue === 'expired') shake.value = withSequence(withTiming(SHAKE_X, SHAKE_STEP), withTiming(-SHAKE_X, SHAKE_STEP), withTiming(0, SHAKE_STEP))
  }, [issue, shake, still])

  const ring = useSharedValue(0)
  const bad = useSharedValue(0)
  useEffect(() => {
    ring.value = still ? (ringed ? 1 : 0) : withTiming(ringed ? 1 : 0, FADE)
    bad.value = still ? (invalid ? 1 : 0) : withTiming(invalid ? 1 : 0, FADE)
  }, [bad, invalid, ring, ringed, still])

  const fieldStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(ring.value, [0, 1], [colors.ink4, colors.surface]),
    borderColor: bad.value > 0 ? interpolateColor(bad.value, [0, 1], [colors.ink8, colors.danger]) : interpolateColor(ring.value, [0, 1], [colors.ink8, colors.textPrimary]),
    transform: [{ translateX: shake.value }],
  }))

  const helper = error ?? (issue === 'expired' ? 'This card has expired' : showIssue ? 'Enter a valid month' : badNumber ? 'Check the card number' : active === 'cvc' ? `${CVC_LENGTH} digits, on the back of your card` : 'Encrypted end to end')
  const helperIcon = invalid ? 'alert-circle' : active === 'cvc' ? 'info' : 'lock'

  function update(part: Part, raw: string): void {
    const next = part === 'number' ? formatNumber(raw) : part === 'expiry' ? formatExpiry(raw) : digits(raw).slice(0, CVC_LENGTH)
    setCard((current) => ({ ...current, [part]: next }))
    if (part === 'number' && digits(next).length === NUMBER_LENGTH) jump.current = true
    if (part === 'expiry' && digits(next).length === 4) cvc.current?.focus()
  }

  async function pay(): Promise<void> {
    if (!complete || busy) return
    setOwn('processing')
    try {
      await onPay?.(card)
      setOwn('paid')
      onPaid?.()
    } catch {
      setOwn('idle')
    }
  }

  const events = (part: Part) => ({
    onFocus: () => setFocused(part),
    onBlur: () => { setFocused((current) => (current === part ? null : current)); setTouched(true) },
    editable: !busy,
    keyboardType: 'number-pad' as const,
    placeholderTextColor: colors.textTertiary,
  })

  return (
    <View style={[styles.tray, style]}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {testCard ? <Button style={SELF.center} variant="link" size="sm" disabled={busy} animated={animated} onPress={() => setCard(TEST_CARD)}>Use test card</Button> : null}
      </View>
      <View style={styles.body}>
        <Animated.View accessibilityLabel={label} style={[styles.field, fieldStyle]}>
          <View style={styles.brand}>
            <LayoutAnimationConfig skipEntering>
              {brand ? (
                <Animated.View key={brand} {...(still ? {} : { entering: chipIn })} style={styles.chip}><Text style={styles.chipText}>{brand}</Text></Animated.View>
              ) : <View key="icon">{withInk(renderIcon('credit-card', 18), colors.textTertiary)}</View>}
            </LayoutAnimationConfig>
          </View>
          <View style={styles.numberWrap}>
            {collapsed ? null : (
              <Text style={styles.ghost} numberOfLines={1} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text style={styles.ghostTyped}>{card.number}</Text>{card.number ? NUMBER_TEMPLATE.slice(card.number.length) : ''}
              </Text>
            )}
            <TextInput
              ref={number}
              style={styles.input}
              value={collapsed ? digits(card.number).slice(-4) : card.number}
              autoComplete="cc-number"
              textContentType="creditCardNumber"
              placeholder="Card number"
              accessibilityLabel="Card number"
              accessibilityHint={typeof helper === 'string' ? helper : undefined}
              onChangeText={(text) => update('number', text)}
              {...events('number')}
            />
          </View>
          {numberDone ? (
            <>
              <TextInput
                ref={expiry}
                style={[styles.input, styles.expiry, showIssue && styles.expiryBad]}
                value={card.expiry}
                autoComplete="cc-exp"
                placeholder="MM / YY"
                accessibilityLabel="Expiry date"
                accessibilityHint={typeof helper === 'string' ? helper : undefined}
                onChangeText={(text) => update('expiry', text)}
                onKeyPress={(event: { nativeEvent: { key: string } }) => { if (event.nativeEvent.key === 'Backspace' && !card.expiry) number.current?.focus() }}
                {...events('expiry')}
              />
              <TextInput
                ref={cvc}
                style={[styles.input, styles.cvc]}
                value={card.cvc}
                autoComplete="cc-csc"
                placeholder="CVC"
                secureTextEntry
                accessibilityLabel="Security code"
                accessibilityHint={typeof helper === 'string' ? helper : undefined}
                onChangeText={(text) => update('cvc', text)}
                onKeyPress={(event: { nativeEvent: { key: string } }) => { if (event.nativeEvent.key === 'Backspace' && !card.cvc) expiry.current?.focus() }}
                {...events('cvc')}
              />
            </>
          ) : null}
        </Animated.View>
        <View accessibilityLiveRegion="polite" style={styles.helper}>
          {withInk(renderIcon(helperIcon, 13), invalid ? colors.danger : colors.textTertiary)}
          <Text style={[styles.helperText, invalid && styles.helperBad]}>{helper}</Text>
        </View>
        <Button
          style={styles.pay}
          contentStyle={state === 'paid' ? styles.paid : undefined}
          shape="pill"
          size="lg"
          disabled={!complete && !busy}
          status={state === 'processing' ? 'loading' : state === 'paid' ? 'success' : 'idle'}
          loadingLabel="Processing"
          successLabel={`Paid ${amount}`}
          renderIcon={renderIcon}
          animated={animated}
          onPress={() => void pay()}
        >
          {`Pay ${amount}`}
        </Button>
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { backgroundColor: c.ink4, borderRadius: radius.tray, gap: space[1], maxWidth: 384, padding: space[1], width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 40, paddingHorizontal: space[3] },
  label: type(14, c.textPrimary, '500'),
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, gap: space[2.5], padding: space[3.5] },
  field: { alignItems: 'center', borderRadius: radius.control, borderWidth: 1.5, flexDirection: 'row', gap: space[2.5], height: 50, paddingLeft: space[2.5], paddingRight: space[3.5] },
  brand: { alignItems: 'center', flexShrink: 0, height: 22, justifyContent: 'center', width: 34 },
  chip: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, height: 22, justifyContent: 'center', width: 34 },
  chipText: { color: c.textPrimary, fontFamily: font.sans, fontSize: 9, fontWeight: '600', lineHeight: 10 },
  numberWrap: { flex: 1, justifyContent: 'center', minWidth: 0 },
  input: { ...type(16, c.textPrimary, '500'), minHeight: 44, minWidth: 0, padding: 0 },
  // The rest of the number, drawn behind the caret.
  ghost: { ...type(16, c.textQuaternary), left: 0, position: 'absolute', right: 0 },
  ghostTyped: { color: 'transparent', fontWeight: '500' },
  expiry: { flexShrink: 0, fontVariant: ['tabular-nums'], textAlign: 'right', width: 72 },
  expiryBad: { color: c.danger },
  cvc: { flexShrink: 0, fontVariant: ['tabular-nums'], textAlign: 'right', width: 44 },
  helper: { alignItems: 'center', flexDirection: 'row', gap: space[1.5], minHeight: 16, paddingBottom: space[1], paddingHorizontal: space[0.5] },
  helperText: { ...type(12, c.textTertiary), flexShrink: 1 },
  helperBad: { color: c.danger },
  pay: { width: '100%' },
  paid: { backgroundColor: c.success },
})
