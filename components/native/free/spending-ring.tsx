import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedProps, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Defs, G, Mask } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { Card, type, useStill, useThemed } from './card'
import { Tween } from './usage-meter'

const SIZE = 200
const CENTER = SIZE / 2
/** Inner radius over outer radius. */
const RATIO_REST = 0.78
const RATIO_ON = 0.7
const GAP = 0.05
const TAU = Math.PI * 2
/** Arcs sweep from 12 o'clock on load: 600 ms. */
const SWEEP_MS = 600
const POP = { stiffness: 420, damping: 26 }
const MASK_R = CENTER / 2
const MASK_LENGTH = TAU * MASK_R
const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** Stroke radius and width for a ring of the given inner ratio, keeping the outer edge fixed. */
const strokeFor = (ratio: number): { r: number; width: number } => ({ r: (CENTER * (1 + ratio)) / 2, width: CENTER * (1 - ratio) })

export type SpendingCategory = {
  name: string
  amount: number
  /** Like `Down $42 from September`. */
  delta?: string
}

export type SpendingRingProps = {
  categories: SpendingCategory[]
  title?: ReactNode
  /** Default the sum of the amounts. */
  total?: number
  /** The selected category name. Controlled when set. */
  value?: string
  defaultValue?: string
  onValueChange?: (name: string) => void
  /** Readout and total. */
  format?: (amount: number) => string
  /** Legend values. */
  formatShort?: (amount: number) => string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const dollars = (amount: number): string => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const whole = (amount: number): string => `$${Math.round(amount)}`

function Arc({ on, share, start, still, color }: { on: boolean; share: number; start: number; still: boolean; color: string }) {
  const ratio = useSharedValue(on ? RATIO_ON : RATIO_REST)
  useEffect(() => {
    const target = on ? RATIO_ON : RATIO_REST
    ratio.value = still ? target : withSpring(target, POP)
  }, [on, still, ratio])
  const props = useAnimatedProps(() => {
    const r = (CENTER * (1 + ratio.value)) / 2
    const length = TAU * r
    return { r, strokeWidth: CENTER * (1 - ratio.value), strokeDasharray: [share * length, length] }
  })
  const rest = strokeFor(on ? RATIO_ON : RATIO_REST)
  return <G transform={`rotate(${(start * 360) / TAU} ${CENTER} ${CENTER})`}><AnimatedCircle animatedProps={props} cx={CENTER} cy={CENTER} r={rest.r} fill="none" stroke={color} /></G>
}

/** A monochrome donut. The selected category is ink and thicker, and the rest stay at 10%. */
export function SpendingRing({ categories, title = 'October spending', total, value, defaultValue, onValueChange, format = dollars, formatShort = whole, animated = true, style }: SpendingRingProps) {
  const styles = useThemed(createStyles)
  const c = useColors()
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultValue ?? categories[0]?.name)
  const selected = value ?? held
  const current = categories.find((item) => item.name === selected)
  const sum = categories.reduce((all, item) => all + item.amount, 0)
  const fullTotal = total ?? sum
  const usable = TAU - GAP * categories.length
  const sweep = useSharedValue(still ? 1 : 0)
  useEffect(() => {
    sweep.value = still ? 1 : withTiming(1, { duration: SWEEP_MS, easing: EASE_OUT })
  }, [still, sweep])
  const maskProps = useAnimatedProps(() => ({ strokeDashoffset: MASK_LENGTH * (1 - sweep.value) }))

  function choose(name: string): void {
    setHeld(name)
    onValueChange?.(name)
  }

  let angle = -Math.PI / 2 + GAP / 2
  const arcs = categories.map((item) => {
    const share = (item.amount / sum) * usable
    const arc = { item, share: share / TAU, start: angle }
    angle += share + GAP
    return arc
  })

  return (
    <Card animated={animated} style={style}>
      <View style={styles.header}><Text style={styles.title} accessibilityRole="header">{title}</Text><Text style={styles.title}>{format(fullTotal)}</Text></View>
      <View style={styles.ring}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} accessibilityRole="image" accessibilityLabel={categories.map((item) => `${item.name} ${format(item.amount)}`).join(', ')}>
          <Defs>
            <Mask id="spending-sweep" x={0} y={0} width={SIZE} height={SIZE} maskUnits="userSpaceOnUse">
              <G transform={`rotate(-90 ${CENTER} ${CENTER})`}><AnimatedCircle animatedProps={maskProps} cx={CENTER} cy={CENTER} r={MASK_R} fill="none" stroke="white" strokeWidth={CENTER} strokeDasharray={[MASK_LENGTH, MASK_LENGTH]} /></G>
            </Mask>
          </Defs>
          <G mask="url(#spending-sweep)">
            {arcs.map(({ item, share, start }) => <Arc key={item.name} on={item.name === selected} share={share} start={start} still={still} color={item.name === selected ? c.textPrimary : c.ink10} />)}
          </G>
        </Svg>
        {current ? (
          <View accessibilityLiveRegion="polite" pointerEvents="none" style={styles.readout}>
            <View style={styles.nameRow}><View style={styles.nameDot} /><Text style={styles.small}>{current.name}</Text></View>
            <Tween value={current.amount} format={format} animated={animated} style={styles.amount} />
            <Text style={styles.small}>{Math.round((current.amount / fullTotal) * 100)}% of total</Text>
            {current.delta ? <Text style={styles.delta}>{current.delta}</Text> : null}
          </View>
        ) : null}
      </View>
      <View accessibilityRole="radiogroup" style={styles.legend}>
        {categories.map((item) => {
          const on = item.name === selected
          return (
            <Pressable key={item.name} accessibilityRole="radio" accessibilityLabel={`${item.name}, ${formatShort(item.amount)}`} aria-checked={on} onPress={() => choose(item.name)} style={[styles.item, on && styles.itemOn]}>
              <View style={[styles.dot, on && styles.dotOn]} />
              <Text style={[styles.itemName, on && styles.itemNameOn]} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemValue}>{formatShort(item.amount)}</Text>
            </Pressable>
          )
        })}
      </View>
    </Card>
  )
}

// The web's mobile card: a 14/20 semibold header, a 200 px ring with a dotted name over a 24 px amount, and a
// two column legend whose values read in the title weight.
const createStyles = (c: Colors) => StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  title: { ...type(14, c.textPrimary, '600'), lineHeight: 20 },
  ring: { alignItems: 'center', alignSelf: 'center', height: SIZE, justifyContent: 'center', marginVertical: space[1], width: SIZE },
  readout: { alignItems: 'center', gap: space[0.5], position: 'absolute', width: 128 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: space[1.5] },
  nameDot: { backgroundColor: c.inverse, borderRadius: radius.full, height: 6, width: 6 },
  small: { ...type(12, c.textSecondary), lineHeight: 16, textAlign: 'center' },
  delta: { ...type(12, c.textTertiary), lineHeight: 16, textAlign: 'center' },
  amount: { ...type(24, c.textPrimary, '600'), lineHeight: 32, textAlign: 'center' },
  legend: { columnGap: space[1], flexDirection: 'row', flexWrap: 'wrap', rowGap: space[0.5] },
  item: { alignItems: 'center', borderRadius: radius.field, flexBasis: '48%', flexDirection: 'row', flexGrow: 1, gap: space[2], minHeight: 30, minWidth: 0, paddingHorizontal: space[2], paddingVertical: space[1.5] },
  itemOn: { backgroundColor: c.ink5 },
  dot: { backgroundColor: c.ink10, borderRadius: radius.full, height: 8, width: 8 },
  dotOn: { backgroundColor: c.inverse },
  itemName: { ...type(14, c.textSecondary), flex: 1, lineHeight: 18, minWidth: 0 },
  itemNameOn: { color: c.textPrimary },
  itemValue: { ...type(14, c.textPrimary, '500'), lineHeight: 18 },
})
