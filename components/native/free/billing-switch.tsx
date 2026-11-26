import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'
import { RollingText } from './label'
import { segmentThumb } from './toggle-group'

const JUMP = { stiffness: 500, damping: 34, mass: 1 } as const

export type BillingPeriod = 'monthly' | 'yearly'

export type BillingSwitchProps = {
  value?: BillingPeriod
  defaultValue?: BillingPeriod
  onValueChange?: (value: BillingPeriod) => void
  /** The price per month, in each period. */
  prices?: Record<BillingPeriod, number>
  currency?: string
  /** The chip on Yearly. */
  save?: string
  disabled?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const PERIODS: { value: BillingPeriod; label: string }[] = [{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]

/** Monthly and Yearly on a 4% tray. The active pill slides across and the price rolls. */
export function BillingSwitch({ value, defaultValue = 'monthly', onValueChange, prices = { monthly: 24, yearly: 19 }, currency = '$', save = 'Save 20%', disabled = false, animated = true, style }: BillingSwitchProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultValue)
  const current = value ?? held
  const frames = useRef<Partial<Record<BillingPeriod, { x: number; width: number }>>>({})
  const x = useSharedValue(0)
  const width = useSharedValue(0)
  const placed = useRef(false)
  const pill = useAnimatedStyle(() => ({ opacity: width.value ? 1 : 0, transform: [{ translateX: x.value }], width: width.value }))

  function slide(period: BillingPeriod): void {
    const frame = frames.current[period]
    if (!frame) return
    const jump = still || !placed.current
    x.value = jump ? frame.x : withSpring(frame.x, JUMP)
    width.value = jump ? frame.width : withSpring(frame.width, JUMP)
    placed.current = true
  }

  useEffect(() => {
    slide(current)
    // `slide` reads refs and shared values, so only the period and `still` matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, still])

  function choose(next: BillingPeriod): void {
    setHeld(next)
    onValueChange?.(next)
  }

  return (
    <View style={[styles.billing, disabled && styles.disabled, style]}>
      <View accessibilityLabel="Billing period" accessibilityRole="radiogroup" style={styles.tray}>
        <Animated.View style={[styles.pill, pill]} />
        {PERIODS.map((period) => {
          const on = period.value === current
          return (
            <Pressable
              key={period.value}
              accessibilityLabel={period.label}
              accessibilityRole="radio"
              aria-checked={on}
              aria-disabled={disabled}
              disabled={disabled}
              style={styles.option}
              onLayout={(e) => {
                frames.current[period.value] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width }
                if (on) slide(period.value)
              }}
              onPress={() => choose(period.value)}
            >
              <Text style={[styles.text, on && styles.textOn]}>{period.label}</Text>
              {period.value === 'yearly' && save ? <View style={styles.save}><Text style={styles.saveText}>{save}</Text></View> : null}
            </Pressable>
          )
        })}
      </View>
      <View accessibilityLiveRegion="polite" style={styles.price}>
        <Text style={styles.amount}>{currency}</Text>
        <RollingText value={String(prices[current])} still={still} style={styles.amount} />
        <Text style={styles.suffix}> a month</Text>
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  billing: { alignItems: 'center', alignSelf: 'center', gap: space[3], maxWidth: '100%' },
  disabled: { opacity: 0.5 },
  tray: { backgroundColor: c.ink4, borderRadius: radius.full, flexDirection: 'row', gap: space[0.5], padding: space[1] },
  pill: { ...segmentThumb(c), bottom: space[1], left: 0, position: 'absolute', top: space[1] },
  option: { alignItems: 'center', borderRadius: radius.full, flexDirection: 'row', gap: space[1.5], height: 44, paddingHorizontal: space[4] },
  text: type(14, c.textSecondary, '500'),
  textOn: { color: c.textPrimary },
  save: { backgroundColor: c.ink5, borderRadius: radius.full, paddingHorizontal: space[1.5], paddingVertical: space[0.5] },
  saveText: type(12, c.success, '500'),
  price: { alignItems: 'baseline', flexDirection: 'row' },
  amount: type(24, c.textPrimary, '600'),
  suffix: type(14, c.textSecondary),
})
