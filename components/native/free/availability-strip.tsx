import { useEffect, useMemo, type ReactNode } from 'react'
import { View, Text, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated'
import { font, space, useColors, useReduceMotion, type Colors } from '../kit'
import { AvailabilityCell, type AvailabilityState } from './availability-cell'

export type AvailabilityMonth = { month: string; state: AvailabilityState; note?: string }

export type AvailabilityStripProps = {
  /** Default Availability. */
  label?: string
  /** Default Updated every Monday. */
  note?: string
  /** Six months. */
  months: AvailabilityMonth[]
  /** Makes each month a button. */
  onSelect?: (month: string) => void
  /** The picked month. */
  selected?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Six months of availability under a label, in two columns of three. The months rise in one after another. */
export function AvailabilityStrip({ label = 'Availability', note = 'Updated every Monday', months, onSelect, selected, animated = true, style }: AvailabilityStripProps) {
  const styles = useStyles()
  return (
    <Reveal animated={animated} style={[styles.strip, style]}>
      <View><Text style={styles.name}>{label}</Text><Text style={styles.note}>{note}</Text></View>
      <View style={styles.months}>{months.map((item, i) => <Reveal key={item.month} index={i + 1} stagger={50} rise={6} animated={animated} style={styles.month}><AvailabilityCell {...item} animated={animated} {...(onSelect ? { onSelect: () => onSelect(item.month), selected: selected === item.month } : {})} /></Reveal>)}</View>
    </Reveal>
  )
}

const ENTER_MS = 400
const STAGGER_MS = 100
const RISE_PX = 16
const ENTER_EASE = Easing.bezier(0.25, 0.1, 0.25, 1)

/** Fades and rises 16 px on mount, 100 ms after the one before it. */
function Reveal({ index = 0, stagger = STAGGER_MS, rise: risePx = RISE_PX, animated, style, children }: { index?: number; stagger?: number; rise?: number; animated: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduce = useReduceMotion()
  const still = !animated || reduce
  const shown = useSharedValue(still ? 1 : 0)
  useEffect(() => {
    shown.value = still ? 1 : withDelay(index * stagger, withTiming(1, { duration: ENTER_MS, easing: ENTER_EASE }))
  }, [still, index, stagger, shown])
  const rise = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: (1 - shown.value) * risePx }] }))
  return <Animated.View style={[rise, style]}>{children}</Animated.View>
}

const useStyles = () => {
  const colors = useColors()
  return useMemo(() => createStyles(colors), [colors])
}

const text = (size: number, lineHeight: number, weight: TextStyle['fontWeight'] = '400'): TextStyle => ({ fontFamily: font.sans, fontSize: size, lineHeight, fontWeight: weight, letterSpacing: font.tracking(size) })

const createStyles = (c: Colors) => StyleSheet.create({
  strip: { gap: space[3], alignSelf: 'stretch' },
  name: { ...text(14, 20, '500'), color: c.textPrimary },
  note: { ...text(12, 16), color: c.textTertiary },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  month: { flexBasis: '48%', flexGrow: 1 },
})
