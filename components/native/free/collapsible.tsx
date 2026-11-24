import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { type RenderIcon, type, useStill, useThemed } from './card'

const OPEN_SPRING = { duration: 320, dampingRatio: 0.7 } as const
const CLOSE_MS = 220
const CONTENT_DELAY_MS = 80
const CONTENT_IN_MS = 200
const CONTENT_OUT_MS = 120
const CHEVRON_MS = 200
const REDUCED_FADE_MS = 120
const IN_OUT = Easing.bezier(0.65, 0, 0.35, 1)
const OUT = Easing.bezier(0.23, 1, 0.32, 1)

export type DisclosurePanelProps = {
  open: boolean
  still: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

/** The shared height and fade. Height grows on a spring, content follows a beat later. */
export function DisclosurePanel({ open, still, animated = true, style, children }: DisclosurePanelProps) {
  const [measured, setMeasured] = useState(0)
  const height = useSharedValue(0)
  const fraction = useSharedValue(open ? 1 : 0)
  const content = useSharedValue(open ? 1 : 0)

  useEffect(() => {
    height.value = measured
  }, [measured, height])

  useEffect(() => {
    const to = open ? 1 : 0
    if (still) {
      fraction.value = to
      content.value = withTiming(to, { duration: animated ? REDUCED_FADE_MS : 0 })
      return
    }
    fraction.value = open ? withSpring(1, OPEN_SPRING) : withTiming(0, { duration: CLOSE_MS, easing: IN_OUT })
    content.value = open
      ? withDelay(CONTENT_DELAY_MS, withTiming(1, { duration: CONTENT_IN_MS, easing: OUT }))
      : withTiming(0, { duration: CONTENT_OUT_MS, easing: IN_OUT })
  }, [open, still, animated, fraction, content])

  const moves = !still
  const shell = useAnimatedStyle(() => ({ height: height.value * fraction.value }))
  const inner = useAnimatedStyle(() => ({ opacity: content.value, transform: [{ translateY: moves ? (content.value - 1) * 4 : 0 }] }))

  return (
    <Animated.View
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      pointerEvents={open ? 'auto' : 'none'}
      style={[panelStyles.panel, shell, style]}
    >
      <Animated.View onLayout={(e) => setMeasured(e.nativeEvent.layout.height)} style={[panelStyles.measure, inner]}>{children}</Animated.View>
    </Animated.View>
  )
}

export type CollapsibleProps = {
  /** The whole bar is the trigger, not only the chevron. */
  title: ReactNode
  children: ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  /** Spoken name, when `title` is not a string. */
  accessibilityLabel?: string
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A trigger on the Soft tray and an inset card that drops in. */
export function Collapsible({ title, children, open, defaultOpen = false, onOpenChange, disabled = false, accessibilityLabel, renderIcon, animated = true, style }: CollapsibleProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultOpen)
  const current = open ?? held
  const turn = useSharedValue(current ? 0 : 180)
  useEffect(() => {
    turn.value = still ? (current ? 0 : 180) : withTiming(current ? 0 : 180, { duration: CHEVRON_MS, easing: OUT })
  }, [current, still, turn])
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))

  function toggle(): void {
    setHeld(!current)
    onOpenChange?.(!current)
  }

  return (
    <View style={[styles.tray, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (typeof title === 'string' ? title : undefined)}
        aria-expanded={current}
        aria-disabled={disabled}
        disabled={disabled}
        onPress={toggle}
        style={({ pressed }) => [styles.trigger, pressed ? styles.triggerPressed : null]}
      >
        {typeof title === 'string' ? <Text style={[styles.title, disabled ? styles.titleDisabled : null]} numberOfLines={1}>{title}</Text> : title}
        <Animated.View style={[styles.chevron, chevron]}>{renderIcon('chevron-up', 16)}</Animated.View>
      </Pressable>
      <DisclosurePanel open={current} still={still} animated={animated}>
        <View style={styles.card}>{children}</View>
      </DisclosurePanel>
    </View>
  )
}

/** A label and value row with a hairline between rows, for inside the card. */
export function CollapsibleRow({ label, children, first = false }: { label: ReactNode; children: ReactNode; first?: boolean }) {
  const styles = useThemed(makeStyles)
  const row = useMemo(() => [styles.row, first ? null : styles.rowRule], [styles, first])
  return (
    <View style={row}>
      {typeof label === 'string' ? <Text style={styles.rowLabel}>{label}</Text> : label}
      {typeof children === 'string' ? <Text style={styles.rowValue}>{children}</Text> : children}
    </View>
  )
}

const panelStyles = StyleSheet.create({
  panel: { overflow: 'hidden' },
  measure: { position: 'absolute', top: 0, left: 0, right: 0 },
})

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], width: '100%', height: 44, paddingLeft: space[3], paddingRight: space[2], borderRadius: radius.card },
  triggerPressed: { backgroundColor: c.ink4 },
  title: { ...type(16, c.textPrimary, '500'), flexShrink: 1, lineHeight: 22 },
  titleDisabled: { color: c.textQuaternary },
  chevron: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36 },
  card: { gap: space[1.5], marginTop: space[1], padding: space[4], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space[3], paddingVertical: space[2] },
  rowRule: { borderTopWidth: 1, borderTopColor: c.ink5 },
  rowLabel: { ...type(15, c.textSecondary), lineHeight: 22 },
  rowValue: { ...type(15, c.textPrimary), flexShrink: 1, lineHeight: 22, textAlign: 'right' },
})
