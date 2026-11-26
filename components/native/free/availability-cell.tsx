import { useEffect, useMemo } from 'react'
import { Pressable, View, Text, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import { font, press, pressedState, radius, space, useColors, useReduceMotion, type Colors } from '../kit'

export type AvailabilityState = 'booked' | 'one-slot' | 'open'
const LABEL: Record<AvailabilityState, string> = { booked: 'Booked', 'one-slot': 'One slot', open: 'Open' }

export type AvailabilityCellProps = {
  month: string
  /** Default `open`. */
  state?: AvailabilityState
  /** Replaces the state text. */
  note?: string | undefined
  /** Makes the cell a button, for picking a month to book. */
  onSelect?: () => void
  /** Rings the cell as the picked month. */
  selected?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** One month of availability, used six at a time in the Availability Strip. With `onSelect` it presses in and pops when picked. */
export function AvailabilityCell({ month, state = 'open', note, onSelect, selected = false, animated = true, style }: AvailabilityCellProps) {
  const styles = useStyles()
  const reduce = useReduceMotion()
  const still = !animated || reduce
  const scale = useSharedValue(1)
  useEffect(() => {
    if (selected && !still) scale.value = withSequence(withTiming(0.95, { duration: 0 }), withSpring(1, { stiffness: 420, damping: 18 }))
  }, [selected, still, scale])
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const text = note ?? LABEL[state]
  const body = (
    <>
      <Text style={[styles.month, state === 'booked' && styles.quiet, state === 'one-slot' && styles.success]}>{month}</Text>
      <Text style={[styles.state, state === 'booked' && styles.quiet, state === 'one-slot' && styles.success]}>{text}</Text>
    </>
  )
  const look = [styles.cell, styles[`cell_${state}`], selected && styles.selected]
  if (!onSelect) return <View accessible accessibilityLabel={`${month}: ${text}`} style={[look, style]}>{body}</View>
  return (
    <Animated.View style={[motion, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${month}, ${text}`}
        {...pressedState(selected)}
        onPressIn={() => { if (!still) scale.value = withSpring(0.97, press.spring) }}
        onPressOut={() => { if (!still) scale.value = withSpring(1, press.spring) }}
        onPress={onSelect}
        style={look}
      >
        {body}
      </Pressable>
    </Animated.View>
  )
}

const useStyles = () => {
  const colors = useColors()
  return useMemo(() => createStyles(colors), [colors])
}

const text = (size: number, lineHeight: number, weight: TextStyle['fontWeight'] = '400'): TextStyle => ({ fontFamily: font.sans, fontSize: size, lineHeight, fontWeight: weight, letterSpacing: font.tracking(size) })

// As the web and Figma: Booked is a 4% wash, One slot the green cell, Open the surface cell with an 8% ring.
const createStyles = (c: Colors) => StyleSheet.create({
  cell: { gap: space[0.5], paddingHorizontal: space[3], paddingVertical: space[2.5], borderRadius: radius.xl, borderWidth: 1, borderColor: 'transparent' },
  cell_booked: { backgroundColor: c.ink4 },
  // --feta-bg-success-subtle and --feta-status-success-text: opaque, so the mint stays mint on a grey tray.
  'cell_one-slot': { backgroundColor: c.canvas === '#ffffff' ? '#ecfdf5' : '#022c22' },
  cell_open: { backgroundColor: c.surface, borderColor: c.ink8 },
  selected: { borderWidth: 2, borderColor: c.textPrimary },
  month: { ...text(14, 20, '500'), color: c.textPrimary },
  quiet: { color: c.textTertiary },
  success: { color: c.canvas === '#ffffff' ? '#047857' : '#6ee7b7' },
  state: { ...text(12, 16), color: c.textSecondary },
})
