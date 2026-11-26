import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type LayoutRectangle, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig, LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { radius, softElevation, space, toggleState, useColors, type Colors } from '../kit'
import { EASE_OUT_SOFT, HEIGHT, ICON_SIZE, PressScale, TARGET, usePressScale, withInk, type Spring } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { TOGGLE_SPRING } from './toggle'

const SLIDE: Spring = { stiffness: 420, damping: 34, mass: 1 }
const SWAP_MS = 200
const WIDTH_MS = 260
const DONE_HOLD_MS = 1600
const SEGMENT_SLOP = { top: (TARGET - HEIGHT.sm) / 2, bottom: (TARGET - HEIGHT.sm) / 2 }
const RESIZE = LinearTransition.duration(WIDTH_MS).easing(EASE_OUT_SOFT)

/**
 * Slides one lift behind whichever item is chosen. Spread `measure(key)` on each item's wrapper as
 * `onLayout`. Stands in for Motion's shared layout: frames are measured, so items may differ in size.
 */
export function useSlidingLift(current: string | null | undefined, spring: Spring, still: boolean) {
  const frames = useRef(new Map<string, LayoutRectangle>())
  const placed = useRef(false)
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const width = useSharedValue(0)
  const height = useSharedValue(0)

  const place = useCallback((key: string | null | undefined) => {
    const frame = key ? frames.current.get(key) : undefined
    if (!frame) return
    const jump = still || !placed.current
    placed.current = true
    x.value = jump ? frame.x : withSpring(frame.x, spring)
    y.value = jump ? frame.y : withSpring(frame.y, spring)
    width.value = jump ? frame.width : withSpring(frame.width, spring)
    height.value = jump ? frame.height : withSpring(frame.height, spring)
  }, [still, spring, x, y, width, height])

  useEffect(() => { place(current) }, [current, place])

  const measure = (key: string) => (event: LayoutChangeEvent): void => {
    frames.current.set(key, event.nativeEvent.layout)
    if (key === current) place(key)
  }

  const liftStyle = useAnimatedStyle(() => ({ height: height.value, transform: [{ translateX: x.value }, { translateY: y.value }], width: width.value }))
  return { liftStyle, measure }
}

type Shared = {
  /** The group's accessible name. */
  label: string
  /** `false` turns off the press scale, the sliding card and the label motion. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

export type SegmentedGroupProps = Shared & {
  kind: 'segmented'
  options: { value: string; label: string; disabled?: boolean }[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

export type AttachedItem = {
  label?: string
  /** Shown for 1.6 s after a press, in past tense: Download becomes Downloaded. */
  doneLabel?: string
  icon?: ReactNode
  ariaLabel?: string
  onPress?: () => void
  disabled?: boolean
}

export type AttachedGroupProps = Shared & {
  kind: 'attached'
  items: AttachedItem[]
}

export type SplitGroupProps = Shared & {
  kind: 'split'
  /** The main action's text. */
  action: string
  icon?: ReactNode
  onAction?: () => void
  menuLabel: string
  onMenu?: () => void
  /** Draws `arrow-down` on the menu button. */
  renderIcon: RenderIcon
  disabled?: boolean
}

export type ToolbarGroupProps = Shared & {
  kind: 'toolbar'
  /** `'separator'` draws a hairline between tools. */
  items: ({ label: string; icon: ReactNode; pressed: boolean; onPressedChange: (pressed: boolean) => void; disabled?: boolean } | 'separator')[]
}

export type ButtonGroupProps = SegmentedGroupProps | AttachedGroupProps | SplitGroupProps | ToolbarGroupProps

function Segmented({ label, options, value, defaultValue, onValueChange, still, style }: SegmentedGroupProps & { still: boolean }) {
  const styles = useThemed(createStyles)
  const [held, setHeld] = useState(defaultValue ?? options[0]?.value)
  const current = value ?? held
  const { liftStyle, measure } = useSlidingLift(current, SLIDE, still)

  function choose(next: string): void {
    setHeld(next)
    onValueChange?.(next)
  }

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.tray, style]}>
      <Animated.View pointerEvents="none" style={[styles.card, liftStyle]} />
      {options.map((option) => {
        const on = option.value === current
        const off = Boolean(option.disabled)
        return (
          <View key={option.value} onLayout={measure(option.value)}>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              aria-checked={on}
              aria-disabled={off}
              disabled={off}
              hitSlop={SEGMENT_SLOP}
              style={styles.segment}
              onPress={() => choose(option.value)}
            >
              <Text numberOfLines={1} style={[styles.segmentText, on && styles.textOn, off && styles.textOff]}>{option.label}</Text>
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}

function Toolbar({ label, items, still, style }: ToolbarGroupProps & { still: boolean }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  return (
    <View accessibilityRole="toolbar" accessibilityLabel={label} style={[styles.tray, style]}>
      {items.map((item, index) => (item === 'separator' ? <View key={index} style={styles.toolDivider} /> : (
        <PressScale
          key={item.label}
          {...toggleState(item.pressed)}
          accessibilityLabel={item.label}
          aria-disabled={Boolean(item.disabled)}
          still={still}
          scale={0.96}
          spring={TOGGLE_SPRING}
          disabled={item.disabled}
          hitSlop={SEGMENT_SLOP}
          contentStyle={[styles.tool, item.pressed && styles.toolOn]}
          onPress={() => item.onPressedChange(!item.pressed)}
        >
          {withInk(item.icon, item.disabled ? colors.textQuaternary : item.pressed ? colors.textPrimary : colors.textSecondary)}
        </PressScale>
      )))}
    </View>
  )
}

/** An Attached button. After a press it holds `doneLabel`, easing its width between the two words. */
function Attached({ item, first, last, still, onPressIn, onPressOut }: { item: AttachedItem; first: boolean; last: boolean; still: boolean; onPressIn: () => void; onPressOut: () => void }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const text = done && item.doneLabel ? item.doneLabel : item.label
  const off = Boolean(item.disabled)

  useEffect(() => () => clearTimeout(timer.current), [])

  function handlePress(): void {
    item.onPress?.()
    if (!item.doneLabel) return
    setDone(true)
    AccessibilityInfo.announceForAccessibility(item.doneLabel)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setDone(false), DONE_HOLD_MS)
  }

  return (
    <Animated.View {...(still ? {} : { layout: RESIZE })}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.ariaLabel ?? text}
        aria-disabled={off}
        disabled={off}
        style={({ pressed }) => [styles.item, first && styles.itemFirst, last && styles.itemLast, pressed && styles.itemPressed]}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {withInk(item.icon, off ? colors.textQuaternary : colors.textPrimary)}
        {text ? (
          <LayoutAnimationConfig skipEntering>
            <Animated.Text
              key={text}
              numberOfLines={1}
              {...(still ? {} : { entering: FadeIn.duration(SWAP_MS).easing(EASE_OUT_SOFT), exiting: FadeOut.duration(SWAP_MS).easing(EASE_OUT_SOFT) })}
              style={[styles.itemText, off && styles.textOff]}
            >
              {text}
            </Animated.Text>
          </LayoutAnimationConfig>
        ) : null}
      </Pressable>
    </Animated.View>
  )
}

function AttachedRow({ label, items, still, style }: AttachedGroupProps & { still: boolean }) {
  const styles = useThemed(createStyles)
  const pressing = usePressScale(still)
  return (
    <Animated.View role="group" accessibilityLabel={label} style={[styles.hug, pressing.style, style]}>
      <Animated.View {...(still ? {} : { layout: RESIZE })} style={styles.attached}>
        {items.map((item, index) => (
          <View key={item.label ?? item.ariaLabel ?? index} style={styles.part}>
            {index > 0 ? <View style={styles.hairline} /> : null}
            <Attached item={item} first={index === 0} last={index === items.length - 1} still={still} onPressIn={pressing.pressIn} onPressOut={pressing.pressOut} />
          </View>
        ))}
      </Animated.View>
    </Animated.View>
  )
}

function Split({ label, action, icon, onAction, menuLabel, onMenu, renderIcon, disabled, still, style }: SplitGroupProps & { still: boolean }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const pressing = usePressScale(still || Boolean(disabled))
  const off = Boolean(disabled)
  const ink = off ? colors.textQuaternary : colors.textInverse
  return (
    <Animated.View role="group" accessibilityLabel={label} style={[styles.split, off && styles.splitOff, pressing.style, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action}
        aria-disabled={off}
        disabled={off}
        style={({ pressed }) => [styles.main, pressed && styles.splitPressed]}
        onPress={onAction}
        onPressIn={pressing.pressIn}
        onPressOut={pressing.pressOut}
      >
        {withInk(icon, ink)}
        <Text numberOfLines={1} style={[styles.mainText, off && styles.textOff]}>{action}</Text>
      </Pressable>
      <View style={styles.splitDivider} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={menuLabel}
        accessibilityHint="Opens a menu"
        aria-disabled={off}
        disabled={off}
        style={({ pressed }) => [styles.menu, pressed && styles.splitPressed]}
        onPress={onMenu}
        onPressIn={pressing.pressIn}
        onPressOut={pressing.pressOut}
      >
        {withInk(renderIcon('arrow-down', ICON_SIZE), ink)}
      </Pressable>
    </Animated.View>
  )
}

/** Related actions in one shape: Segmented, Attached, Split or Toolbar. */
export function ButtonGroup(props: ButtonGroupProps) {
  const still = useStill(props.animated !== false)
  if (props.kind === 'segmented') return <Segmented {...props} still={still} />
  if (props.kind === 'toolbar') return <Toolbar {...props} still={still} />
  if (props.kind === 'attached') return <AttachedRow {...props} still={still} />
  return <Split {...props} still={still} />
}

const createStyles = (c: Colors) => StyleSheet.create({
  hug: { alignSelf: 'flex-start' },
  tray: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: c.ink4, borderRadius: radius.control, flexDirection: 'row', gap: space[0.5], padding: space[1] },
  card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.field, borderWidth: 1, boxShadow: softElevation(c), left: 0, position: 'absolute', top: 0 },
  segment: { alignItems: 'center', borderRadius: radius.field, height: HEIGHT.sm, justifyContent: 'center', paddingHorizontal: space[3] },
  segmentText: type(16, c.textSecondary, '500'),
  textOn: { color: c.textPrimary },
  textOff: { color: c.textQuaternary },
  tool: { alignItems: 'center', borderColor: 'transparent', borderRadius: radius.field, borderWidth: 1, height: HEIGHT.sm, justifyContent: 'center', width: HEIGHT.sm },
  toolOn: { backgroundColor: c.surface, borderColor: c.ink8 },
  toolDivider: { backgroundColor: c.ink10, height: space[4], width: 1 },
  attached: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.xl, borderWidth: 1, flexDirection: 'row', height: HEIGHT.md },
  part: { alignItems: 'center', flexDirection: 'row', height: '100%' },
  hairline: { backgroundColor: c.ink8, height: space[5], width: 1 },
  item: { alignItems: 'center', flexDirection: 'row', gap: space[1.5], height: '100%', paddingHorizontal: space[3] },
  itemFirst: { borderBottomLeftRadius: radius.xl, borderTopLeftRadius: radius.xl },
  itemLast: { borderBottomRightRadius: radius.xl, borderTopRightRadius: radius.xl },
  itemPressed: { backgroundColor: c.ink8 },
  itemText: type(16, c.textPrimary, '500'),
  split: { alignSelf: 'flex-start', backgroundColor: c.inverse, borderRadius: radius.xl, flexDirection: 'row', height: HEIGHT.md, overflow: 'hidden' },
  splitOff: { backgroundColor: c.ink5 },
  splitPressed: { opacity: 0.8 },
  main: { alignItems: 'center', flexDirection: 'row', gap: space[1.5], paddingHorizontal: space[3.5] },
  mainText: type(16, c.textInverse, '500'),
  splitDivider: { backgroundColor: c.textInverse, opacity: 0.16, width: 1 },
  menu: { alignItems: 'center', justifyContent: 'center', width: HEIGHT.md },
})
