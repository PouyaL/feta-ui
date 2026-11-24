import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type, useStill, useThemed } from './card'
import { RollingText } from './label'

const PX_PER_PERCENT = 16
const TOP = 30
const FLICK = 0.25
const RECOMMENDED = 18
const WINDOW_HEIGHT = 84
const SETTLE = { stiffness: 420, damping: 42, mass: 1 } as const

const rubber = (d: number): number => {
  'worklet'
  return (d * 0.35) / (1 + d / 120)
}
const clamp = (value: number, low: number, high: number): number => {
  'worklet'
  return Math.min(high, Math.max(low, value))
}
const money = (value: number): string => value.toFixed(2)

export type TipSelectorProps = {
  /** The bill before the tip. */
  subtotal: number
  /** Who gets the tip. */
  name?: string
  /** A line under the name. */
  note?: string
  currency?: string
  /** Percents shown as chips. */
  presets?: number[]
  defaultPercent?: number
  onPercentChange?: (percent: number) => void
  /** Resolves once the order is paid. */
  onPlaceOrder?: (total: number) => Promise<void>
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A tape measure for tipping. Drag it under a fixed needle, and it rubber bands past the ends. */
export function TipSelector({ subtotal, name = 'Sam', note, currency = '$', presets = [15, 18, 20], defaultPercent = 18, onPercentChange, onPlaceOrder, animated = true, style }: TipSelectorProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [percent, setPercent] = useState(defaultPercent)
  const [dragging, setDragging] = useState(false)
  /** The tip that makes a whole total, once Round up is on. */
  const [roundTip, setRoundTip] = useState<number | null>(null)
  const [status, setStatus] = useState<'idle' | 'placing' | 'paid'>('idle')
  const x = useSharedValue(-defaultPercent * PX_PER_PERCENT)
  const from = useSharedValue(0)
  const near = useSharedValue(defaultPercent)
  const alive = useRef(true)
  const tape = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  const tip = roundTip ?? (subtotal * percent) / 100
  const total = subtotal + tip
  const shownPercent = roundTip === null ? String(percent) : ((roundTip / subtotal) * 100).toFixed(1)
  const line = roundTip !== null ? `Rounds the total to ${currency}${Math.round(total)}` : percent === 0 ? 'No tip' : `${percent}% of ${currency}${money(subtotal)}`
  const ticks = useMemo(() => Array.from({ length: TOP + 1 }, (_, i) => i), [])

  function slideTo(position: number): void {
    x.value = still ? position : withSpring(position, SETTLE)
  }

  function roundUp(): void {
    const next = Math.ceil(total) - subtotal
    const exact = (next / subtotal) * 100
    setRoundTip(next)
    setPercent(clamp(Math.round(exact), 0, TOP))
    slideTo(-exact * PX_PER_PERCENT)
  }

  function choose(next: number): void {
    const value = clamp(Math.round(next), 0, TOP)
    near.value = value
    setRoundTip(null)
    setPercent(value)
    onPercentChange?.(value)
    slideTo(-value * PX_PER_PERCENT)
  }

  function pass(value: number): void {
    setRoundTip(null)
    setPercent(value)
    onPercentChange?.(value)
  }

  const pan = Gesture.Pan()
    .enabled(status === 'idle')
    .activeOffsetX([-4, 4])
    .failOffsetY([-16, 16])
    .onStart((e) => {
      cancelAnimation(x)
      from.value = x.value - e.translationX
      runOnJS(setDragging)(true)
    })
    .onUpdate((e) => {
      const raw = from.value + e.translationX
      const low = -TOP * PX_PER_PERCENT
      const eased = raw > 0 ? rubber(raw) : raw < low ? low - rubber(low - raw) : raw
      x.value = eased
      const next = clamp(Math.round(-eased / PX_PER_PERCENT), 0, TOP)
      if (next !== near.value) {
        near.value = next
        runOnJS(pass)(next)
      }
    })
    .onEnd((e) => runOnJS(choose)(-(x.value + e.velocityX * FLICK * 0.1) / PX_PER_PERCENT))
    .onFinalize(() => runOnJS(setDragging)(false))

  async function place(): Promise<void> {
    setStatus('placing')
    await (onPlaceOrder?.(total) ?? Promise.resolve()).catch(() => undefined)
    if (alive.current) setStatus('paid')
  }

  return (
    <View accessibilityLabel="Add a tip" style={[styles.tray, style]}>
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{name.slice(0, 1)}</Text></View>
          <View>
            <Text style={styles.who}>Tip {name}</Text>
            {note ? <Text style={styles.line}>{note}</Text> : null}
          </View>
        </View>
        <View accessibilityLiveRegion="polite" style={styles.reading}>
          <View style={styles.amountRow}>
            <Text style={styles.amount}>{currency}</Text>
            <RollingText value={money(tip)} still={still} style={styles.amount} />
          </View>
          <Text style={styles.line}>{line}</Text>
        </View>
        <GestureDetector gesture={pan}>
          <View
            accessible
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            accessibilityLabel="Tip percent"
            accessibilityRole="adjustable"
            aria-disabled={status !== 'idle'}
            aria-valuemax={TOP}
            aria-valuemin={0}
            aria-valuenow={percent}
            aria-valuetext={`${percent} percent, ${currency}${money(tip)}`}
            collapsable={false}
            style={styles.window}
            onAccessibilityAction={(e: AccessibilityActionEvent) => { if (status === 'idle') choose(percent + (e.nativeEvent.actionName === 'increment' ? 1 : -1)) }}
          >
            <Animated.View style={[styles.tape, tape]}>
              {ticks.map((i) => (
                <View key={i} style={styles.cell}>
                  <View style={[styles.tick, i % 5 === 0 && styles.tickMajor]} />
                  {i % 5 === 0 || i === RECOMMENDED ? <Text style={styles.tickLabel}>{i}%</Text> : null}
                </View>
              ))}
            </Animated.View>
            <View style={[styles.needle, dragging && styles.needleDragging]} />
            <Svg pointerEvents="none" width="100%" height={WINDOW_HEIGHT} style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id="edges" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={colors.surface} stopOpacity={1} />
                  <Stop offset="0.12" stopColor={colors.surface} stopOpacity={0} />
                  <Stop offset="0.88" stopColor={colors.surface} stopOpacity={0} />
                  <Stop offset="1" stopColor={colors.surface} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height={WINDOW_HEIGHT} fill="url(#edges)" />
            </Svg>
          </View>
        </GestureDetector>
        <View style={styles.chips}>
          {presets.map((preset) => {
            const on = roundTip === null && percent === preset
            return (
              <Pressable key={preset} accessibilityLabel={`${preset}%`} accessibilityRole="button" aria-disabled={status !== 'idle'} aria-selected={on} disabled={status !== 'idle'} style={[styles.chip, on && styles.chipOn, status !== 'idle' && styles.chipOff]} onPress={() => choose(preset)}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{preset}%</Text>
              </Pressable>
            )
          })}
          <Pressable accessibilityLabel="Round up" accessibilityRole="button" aria-disabled={status !== 'idle'} aria-selected={roundTip !== null} disabled={status !== 'idle'} style={[styles.chip, roundTip !== null && styles.chipOn, status !== 'idle' && styles.chipOff]} onPress={roundUp}>
            <Text style={[styles.chipText, roundTip !== null && styles.chipTextOn]}>Round up</Text>
          </Pressable>
        </View>
        <View style={styles.rows}>
          <View style={styles.rowLine}><Text style={styles.rowText}>Subtotal</Text><Text style={styles.rowText}>{currency}{money(subtotal)}</Text></View>
          <View style={styles.rowLine}><Text style={styles.rowText}>{tip > 0 ? `Tip · ${shownPercent}%` : 'Tip'}</Text><Text style={styles.rowText}>{currency}{money(tip)}</Text></View>
          <View style={styles.rowLine}><Text style={styles.rowTotal}>Total</Text><Text style={styles.rowTotal}>{currency}{money(total)}</Text></View>
        </View>
      </View>
      <Button animated={animated} style={styles.place} disabled={status === 'paid'} status={status === 'placing' ? 'loading' : 'idle'} onPress={() => { void place() }}>
        {status === 'paid' ? 'Paid, thank you' : status === 'placing' ? 'Placing order' : `Place order · ${currency}${money(total)}`}
      </Button>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { backgroundColor: c.ink4, borderRadius: radius.tray, gap: space[1], padding: space[1], width: '100%' },
  card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, gap: space[3], padding: space[4] },
  head: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  avatar: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, height: 32, justifyContent: 'center', width: 32 },
  avatarText: type(14, c.textPrimary, '500'),
  who: type(16, c.textPrimary, '500'),
  line: type(12, c.textSecondary),
  reading: { alignItems: 'center', gap: space[0.5] },
  amountRow: { flexDirection: 'row' },
  amount: { ...type(36, c.textPrimary, '600'), lineHeight: 40 },
  window: { borderRadius: radius.xl, height: WINDOW_HEIGHT, overflow: 'hidden' },
  tape: { flexDirection: 'row', height: '100%', left: '50%', position: 'absolute', top: 0 },
  cell: { width: PX_PER_PERCENT },
  tick: { backgroundColor: c.ink10, height: 12, marginTop: space[2], width: 1.5 },
  tickMajor: { backgroundColor: c.textTertiary, height: 22 },
  tickLabel: { ...type(12, c.textTertiary, '400', true), left: -space[5], position: 'absolute', textAlign: 'center', top: 36, width: space[10] },
  needle: { alignSelf: 'center', backgroundColor: c.danger, borderRadius: radius.xs, height: 36, position: 'absolute', top: space[1], width: 2 },
  needleDragging: { height: 44, width: 3 },
  chips: { flexDirection: 'row', gap: space[1.5] },
  chip: { alignItems: 'center', backgroundColor: c.ink4, borderRadius: radius.full, flex: 1, height: 44, justifyContent: 'center', paddingHorizontal: space[1] },
  chipOn: { backgroundColor: c.inverse },
  chipOff: { opacity: 0.5 },
  chipText: type(14, c.textPrimary, '500'),
  chipTextOn: { color: c.textInverse },
  rows: { gap: space[1] },
  rowLine: { flexDirection: 'row', justifyContent: 'space-between' },
  rowText: type(14, c.textSecondary),
  rowTotal: type(14, c.textPrimary, '600'),
  place: { width: '100%' },
})
