import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { font, radius, space, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'
import { Copy, soft } from './popover'
import { Tooltip } from './tooltip'

const RUBBER_BAND = 0.35
const FLICK_SPEED = 400
const SNAP_AT = 0.5
const TOGGLE = { stiffness: 420, damping: 38 }
const SWIPE_START = 12
const LIST_INSET = 4

export type TabItem = {
  value: string
  label: string
  icon?: ReactNode
  count?: number | string
  disabled?: boolean
  /** Says why a disabled tab is off, on long press and to screen readers. */
  reason?: string
  content?: ReactNode
}

export type TabsProps = {
  items: TabItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** `pill` floats the active tab on surface; `line` draws an ink line on a hairline. Default `pill`. */
  appearance?: 'pill' | 'line'
  orientation?: 'horizontal' | 'vertical'
  /** Stretches the tab list to its container. */
  fill?: boolean
  /** The tab list's spoken name. */
  label: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Rect = { at: number; size: number }

/** Switch between views of one thing. The indicator and the panel move together on one spring, and a swipe drives both directly. */
export function Tabs({ items, value, defaultValue, onValueChange, appearance = 'pill', orientation = 'horizontal', fill = false, label, animated = true, style }: TabsProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultValue ?? items.find((item) => !item.disabled)?.value)
  const [width, setWidth] = useState(0)
  const current = value ?? held
  const index = Math.max(0, items.findIndex((item) => item.value === current))
  const vertical = orientation === 'vertical'
  const line = appearance === 'line'
  const panels = items.some((item) => item.content !== undefined)
  const swipes = panels && !vertical
  const last = items.length - 1

  // Shared values, so a finger moves the indicator every frame without a render.
  const at = useSharedValue(0)
  const size = useSharedValue(0)
  const trackX = useSharedValue(0)
  const rects = useSharedValue<Rect[]>([])
  // The JS copy of the tab boxes. On iOS a read of rects.value right after a write on this thread can return the old
  // array, so several tabs laid out in one frame dropped each other and the indicator stayed 0 wide.
  const boxes = useRef<Rect[]>([])
  const shown = useSharedValue(index)
  const placed = useRef(false)
  const laidOut = useRef(0)

  const place = useCallback((gently: boolean): void => {
    const target = boxes.current[index]
    if (!target) return
    const page = -index * width
    at.value = gently ? withSpring(target.at, TOGGLE) : target.at
    size.value = gently ? withSpring(target.size, TOGGLE) : target.size
    trackX.value = gently ? withSpring(page, TOGGLE) : page
  }, [at, index, size, trackX, width])

  useEffect(() => {
    shown.value = index
    const resized = laidOut.current !== width
    laidOut.current = width
    place(!still && placed.current && !resized)
  }, [index, place, shown, still, width])

  function measure(i: number, e: LayoutChangeEvent): void {
    const box = e.nativeEvent.layout
    boxes.current[i] = vertical ? { at: box.y, size: box.height } : { at: box.x, size: box.width }
    rects.value = [...boxes.current]
    if (i === index) { place(false); placed.current = true }
  }

  function choose(item: TabItem): void {
    setHeld(item.value)
    onValueChange?.(item.value)
  }

  const settle = useCallback((step: number): void => {
    let target = Math.max(0, Math.min(last, index + step))
    if (items[target]?.disabled) target = index
    const item = items[target]
    if (item && target !== index) { setHeld(item.value); onValueChange?.(item.value) } else place(!still)
  }, [index, items, last, onValueChange, place, still])

  const rubber = still ? 0 : RUBBER_BAND

  const swipe = useMemo(() => Gesture.Pan()
    .enabled(swipes && width > 0)
    .activeOffsetX([-SWIPE_START, SWIPE_START])
    .failOffsetY([-SWIPE_START, SWIPE_START])
    .onUpdate((e) => {
      const low = -last * width
      const next = -shown.value * width + e.translationX
      trackX.value = next > 0 ? next * rubber : next < low ? low + (next - low) * rubber : next
      const position = Math.max(0, Math.min(last, -trackX.value / width))
      const from = rects.value[Math.floor(position)]
      const to = rects.value[Math.ceil(position)]
      if (!from || !to) return
      const part = position - Math.floor(position)
      at.value = from.at + (to.at - from.at) * part
      size.value = from.size + (to.size - from.size) * part
    })
    .onEnd((e) => {
      const moved = e.translationX / width
      const flick = Math.abs(e.velocityX) > FLICK_SPEED
      const step = flick ? -Math.sign(e.velocityX) : Math.abs(moved) > SNAP_AT ? -Math.sign(moved) : 0
      runOnJS(settle)(step)
    }), [at, last, rects, rubber, settle, shown, size, swipes, trackX, width])

  const indicator = useAnimatedStyle(() => (vertical ? { height: size.value, transform: [{ translateY: at.value }] } : { width: size.value, transform: [{ translateX: at.value }] }), [vertical])
  const track = useAnimatedStyle(() => ({ transform: [{ translateX: trackX.value }] }))
  const pageWidth = useAnimatedStyle(() => ({ width }), [width])

  const tab = (item: TabItem, i: number): ReactNode => {
    const on = i === index
    const button = (
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityHint={item.disabled ? item.reason : undefined}
        aria-selected={on}
        aria-disabled={Boolean(item.disabled)}
        disabled={item.disabled}
        onPress={() => choose(item)}
        style={[styles.tab, line && styles.tabLine, vertical && styles.tabVertical, line && !vertical && styles.tabLineTall, Boolean(item.disabled) && styles.off]}
      >
        {item.icon ?? null}
        <Text numberOfLines={1} style={[styles.text, on && styles.textOn]}>{item.label}</Text>
        {item.count === undefined ? null : <Text style={[styles.count, on && styles.countOn]}>{item.count}</Text>}
      </Pressable>
    )
    return (
      <View key={item.value} onLayout={(e) => measure(i, e)} style={fill ? styles.grow : null}>
        {item.disabled && item.reason ? <Tooltip content={item.reason} animated={animated}>{button}</Tooltip> : button}
      </View>
    )
  }

  const list = (
    <>
      <Animated.View pointerEvents="none" style={[styles.indicator, line && !vertical ? styles.indicatorLine : null, vertical ? styles.indicatorVertical : styles.indicatorHorizontal, !line || vertical ? styles.indicatorPill : null, indicator]} />
      {items.map(tab)}
    </>
  )

  return (
    <View style={[styles.tabs, vertical && styles.tabsVertical, style]}>
      <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.list, line ? styles.listLine : styles.listPill, vertical && styles.listVertical, fill && styles.listFill]}>
        {vertical || fill ? <View style={vertical ? styles.column : styles.rowFill}>{list}</View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={[styles.row, line && styles.rowLine]}>{list}</ScrollView>}
      </View>
      {panels ? (
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.viewport}>
          {vertical ? (
            <View style={styles.panel}><Copy style={styles.panelText}>{items[index]?.content}</Copy></View>
          ) : (
            <GestureDetector gesture={swipe}>
              <Animated.View style={[styles.track, track]}>
                {items.map((item, i) => (
                  <Animated.View key={item.value} aria-hidden={i !== index} style={[styles.panel, pageWidth]}>
                    <Copy style={styles.panelText}>{item.content}</Copy>
                  </Animated.View>
                ))}
              </Animated.View>
            </GestureDetector>
          )}
        </View>
      ) : null}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tabs: { gap: space[3], minWidth: 0, width: '100%' },
  tabsVertical: { flexDirection: 'row', gap: space[4] },
  list: { alignSelf: 'flex-start', maxWidth: '100%' },
  listPill: { backgroundColor: c.ink4, borderRadius: radius.full, padding: LIST_INSET },
  listLine: { alignSelf: 'stretch', borderBottomColor: c.ink8, borderBottomWidth: 1 },
  listVertical: { alignSelf: 'flex-start', backgroundColor: c.ink4, borderBottomWidth: 0, borderRadius: radius['2xl'], flexShrink: 0, padding: LIST_INSET, width: 128 },
  listFill: { alignSelf: 'stretch' },
  // ScrollView defaults to flexGrow 1, which grew the column list to hundreds of points tall on iOS.
  scroller: { flexGrow: 0 },
  row: { flexDirection: 'row', gap: space[0.5] },
  rowLine: { gap: space[5] },
  rowFill: { flexDirection: 'row', gap: space[0.5] },
  column: { gap: space[0.5] },
  grow: { flex: 1 },
  indicator: { left: 0, position: 'absolute', top: 0 },
  indicatorHorizontal: { bottom: 0 },
  indicatorVertical: { right: 0 },
  indicatorPill: { ...soft(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1 },
  indicatorLine: { backgroundColor: c.textPrimary, height: 2, top: 'auto' },
  tab: { alignItems: 'center', borderRadius: radius.full, flexDirection: 'row', gap: space[1.5], height: 44, justifyContent: 'center', paddingHorizontal: space[3] },
  tabLine: { borderRadius: radius.lg, paddingHorizontal: space[1] },
  tabLineTall: { height: 48 },
  tabVertical: { borderRadius: radius.xl, justifyContent: 'flex-start', paddingHorizontal: space[3] },
  off: { opacity: 0.4 },
  text: { ...type(15, c.textSecondary), lineHeight: 20 },
  textOn: { color: c.textPrimary, fontWeight: '500' },
  count: { backgroundColor: c.ink5, borderRadius: radius.full, color: c.textSecondary, fontFamily: font.mono, fontSize: 10, lineHeight: 14, overflow: 'hidden', paddingHorizontal: space[1.5], paddingVertical: space[0.5] },
  countOn: { backgroundColor: c.ink8 },
  viewport: { flex: 1, minWidth: 0, overflow: 'hidden' },
  track: { flexDirection: 'row' },
  panel: { flexShrink: 0, minWidth: 0 },
  panelText: { ...type(14, c.textPrimary), lineHeight: 20 },
})
