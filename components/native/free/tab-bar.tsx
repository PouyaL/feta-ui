import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeInLeft, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { withInk } from './button'
import { type, useStill, useThemed } from './card'
import { soft } from './popover'

const LABEL_MS = 120
const LABEL_X = -6
const PILL_LABELED = { width: 52, height: 28 }
const SPRING = { stiffness: 420, damping: 34 }

const SLOT_MOVE = LinearTransition.springify().stiffness(SPRING.stiffness).damping(SPRING.damping)
const LABEL_IN = FadeInLeft.springify().stiffness(SPRING.stiffness).damping(SPRING.damping).withInitialValues({ transform: [{ translateX: LABEL_X }] })
const LABEL_OUT = FadeOut.duration(LABEL_MS)

export type TabBarItem = { value: string; label: string; icon: ReactNode; /** Read out with the label, and shown as a dot. */ badge?: string }

export type TabBarProps = {
  items: TabBarItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** `labeled` is the classic bar. `floating` is a dock whose active tab grows an ink pill. */
  appearance?: 'labeled' | 'floating'
  'aria-label'?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Three to five top destinations, as a labeled bar or a floating dock. */
export function TabBar({ items, value, defaultValue, onValueChange, appearance = 'labeled', 'aria-label': label = 'Main', animated = true, style }: TabBarProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultValue ?? items[0]?.value)
  const current = value ?? held
  const floating = appearance === 'floating'
  const placed = useRef(false)
  const boxes = useRef<Record<string, { x: number; width: number }>>({})
  const pillX = useSharedValue(0)
  const pillWidth = useSharedValue(floating ? 0 : PILL_LABELED.width)

  function choose(next: string): void {
    setHeld(next)
    onValueChange?.(next)
  }

  const placePill = useCallback((): void => {
    const box = current === undefined ? undefined : boxes.current[current]
    if (!box) return
    const { x, width } = box
    const toX = floating ? x : x + width / 2 - PILL_LABELED.width / 2
    const toWidth = floating ? width : PILL_LABELED.width
    const glides = !still && placed.current
    pillX.value = glides ? withSpring(toX, SPRING) : toX
    pillWidth.value = glides ? withSpring(toWidth, SPRING) : toWidth
    placed.current = true
  }, [current, floating, pillWidth, pillX, still])

  useEffect(placePill, [placePill])

  // Slots report where they land, so the pill rides the same spring as the dock around it.
  function onSlot(name: string, e: LayoutChangeEvent): void {
    const { x, width } = e.nativeEvent.layout
    boxes.current[name] = { x, width }
    if (name === current) placePill()
  }

  const pill = useAnimatedStyle(() => ({ width: pillWidth.value, transform: [{ translateX: pillX.value }] }))

  return (
    <View role="tablist" accessibilityLabel={label} style={[floating ? styles.floating : styles.labeled, style]}>
      <View style={styles.list}>
        <Animated.View pointerEvents="none" style={[styles.pill, floating ? styles.pillFloating : styles.pillLabeled, pill]} />
        {items.map((item) => {
          const on = item.value === current
          return (
            <Animated.View key={item.value} {...(floating && !still ? { layout: SLOT_MOVE } : {})} onLayout={(e: LayoutChangeEvent) => onSlot(item.value, e)} style={floating ? null : styles.slot}>
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel={item.badge ? `${item.label}, ${item.badge}` : item.label}
                aria-selected={on}
                onPress={() => choose(item.value)}
                style={[floating ? styles.tabFloating : styles.tabLabeled, floating && on && styles.tabFloatingOn]}
              >
                <View style={styles.icon}>{withInk(item.icon, on ? (floating ? colors.textInverse : colors.textPrimary) : colors.textSecondary)}{item.badge ? <View style={styles.badge} /> : null}</View>
                {floating ? (
                  on ? <Animated.Text {...(still ? {} : { entering: LABEL_IN, exiting: LABEL_OUT })} numberOfLines={1} style={styles.floatingLabel}>{item.label}</Animated.Text> : null
                ) : <Text numberOfLines={1} style={[styles.label, on && styles.labelOn]}>{item.label}</Text>}
              </Pressable>
            </Animated.View>
          )
        })}
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  labeled: { backgroundColor: c.surface, borderTopColor: c.ink8, borderTopWidth: 1, maxWidth: '100%', paddingBottom: space[7], paddingTop: space[1.5], width: '100%' },
  floating: { ...soft(c), alignSelf: 'center', backgroundColor: c.muted, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1, padding: space[1.5] },
  list: { flexDirection: 'row', justifyContent: 'space-around' },
  slot: { flex: 1 },
  pill: { left: 0, position: 'absolute', top: 0 },
  pillLabeled: { backgroundColor: c.ink5, borderRadius: radius.full, height: PILL_LABELED.height, top: space[1] },
  pillFloating: { backgroundColor: c.inverse, borderRadius: radius.full, bottom: 0 },
  tabLabeled: { alignItems: 'center', borderRadius: radius.xl, gap: space[0.5], justifyContent: 'center', minHeight: 48, paddingVertical: space[1] },
  tabFloating: { alignItems: 'center', borderRadius: radius.full, flexDirection: 'row', gap: space[1.5], height: 44, justifyContent: 'center', minWidth: 44 },
  tabFloatingOn: { paddingHorizontal: space[3.5] },
  icon: { alignItems: 'center', flexShrink: 0, height: 28, justifyContent: 'center' },
  badge: { backgroundColor: c.danger, borderRadius: radius.full, height: 8, position: 'absolute', right: -4, top: 2, width: 8 },
  label: { ...type(10, c.textSecondary), lineHeight: 12 },
  labelOn: { color: c.textPrimary },
  floatingLabel: { ...type(14, c.textInverse, '500'), lineHeight: 20 },
})
