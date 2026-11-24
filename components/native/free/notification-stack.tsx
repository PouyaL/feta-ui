import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, FadeIn, FadeOut, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors } from '../kit'
import { Button, withInk } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { soft } from './popover'

const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
const STEP = 66
const CARD = 62
const FANNED = 82
const FAN_OFFSET = 10
/** Widths of the two cards behind: 360 and 344 of 376. */
const FAN_SCALE = [1, 0.957, 0.915]
/** Expand stack: 300 ms, spring 0.25. */
const FAN_MS = 300
const FAN_SPRING = { duration: FAN_MS, dampingRatio: 0.75 } as const
/** New notification: y from 12 above. */
const ARRIVE_SHIFT = 12
const leave = FadeOut.duration(240).easing(EASE_OUT)
/** Dismiss past 40% of the width or at 500 points a second. */
const DISMISS_SHARE = 0.4
const DISMISS_VELOCITY = 500
const FLING = { duration: 180, easing: EASE_OUT }
const SETTLE = { stiffness: 420, damping: 42 } as const
/** The Swiping frame: the card sits 98 across at 55%. */
const SWIPE_FRAME = 98
const SWIPE_OPACITY = 0.55
const STRIP_FULL = 24
const FAST = { duration: 150, easing: EASE_OUT }
const chipIn = FadeIn.duration(150).easing(EASE_OUT)
const chipOut = FadeOut.duration(150).easing(EASE_OUT)
/** A 24 chip in a 44 target. */
const CHIP_SLOP = 10
const HEADER_HEIGHT = 48
const FILL = { duration: FAN_MS, easing: EASE_OUT }

export type NotificationItem = {
  id: string
  title: string
  body: ReactNode
  /** Short text like `now` or `9:50`. */
  time: string
  /** Colour of the solid icon tile. Default `inverse`. */
  tone?: 'success' | 'danger' | 'info' | 'inverse'
  icon: ReactNode
}

export type NotificationStackProps = {
  items: NotificationItem[]
  /** Default `Notifications`. */
  title?: string
  expanded?: boolean
  defaultExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  /** Items leave the stack on their own. Use this to remove them from your data. */
  onDismiss?: (id: string) => void
  /** Holds the top card at the Swiping pose, for documentation. */
  swipePreview?: boolean
  renderIcon: RenderIcon
  /** `false` turns off the fan, the fling and swiping. Dismiss stays on the corner button. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type NoticeProps = {
  item: NotificationItem
  index: number
  open: boolean
  count: number
  still: boolean
  /** False for the cards there on first render, which do not arrive. */
  arrives: boolean
  swipePreview: boolean
  renderIcon: RenderIcon
  onDismiss: (id: string) => void
}

function Notice({ item, index, open, count, still, arrives, swipePreview, renderIcon, onDismiss }: NoticeProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const reachable = open || index === 0
  const fan = Math.min(index, FAN_SCALE.length - 1)
  const restY = open ? index * STEP : fan * FAN_OFFSET
  const restScale = open ? 1 : FAN_SCALE[fan] ?? 1
  const restOpacity = open || index <= 2 ? 1 : 0
  const tone = item.tone ?? 'inverse'

  const entering = arrives && !still
  const y = useSharedValue(entering ? (open ? index * STEP : 0) - ARRIVE_SHIFT : restY)
  const scaleX = useSharedValue(restScale)
  const opacity = useSharedValue(entering ? 0 : restOpacity)
  const x = useSharedValue(swipePreview ? SWIPE_FRAME : 0)
  const width = useSharedValue(0)
  const blank = useSharedValue(reachable ? 1 : 0)

  useEffect(() => {
    y.value = still ? restY : withSpring(restY, FAN_SPRING)
    scaleX.value = still ? restScale : withSpring(restScale, FAN_SPRING)
    opacity.value = still ? restOpacity : withSpring(restOpacity, FAN_SPRING)
  }, [opacity, restOpacity, restScale, restY, scaleX, still, y])

  useEffect(() => {
    blank.value = still ? (reachable ? 1 : 0) : withTiming(reachable ? 1 : 0, FAST)
  }, [blank, reachable, still])

  const pan = useMemo(() => Gesture.Pan()
    .enabled(!still && reachable)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((event) => { x.value = Math.max(0, event.translationX) })
    .onEnd((event) => {
      if (x.value > width.value * DISMISS_SHARE || event.velocityX > DISMISS_VELOCITY) {
        x.value = withTiming(width.value * 1.1, FLING, (finished) => { if (finished) runOnJS(onDismiss)(item.id) })
      } else {
        x.value = withSpring(0, SETTLE)
      }
    }), [item.id, onDismiss, reachable, still, width, x])

  const itemStyle = useAnimatedStyle(() => ({ opacity: opacity.value, zIndex: count - index, transform: [{ translateY: y.value }, { scaleX: scaleX.value }] }))
  const noticeStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, SWIPE_FRAME], [1, SWIPE_OPACITY], 'clamp'), transform: [{ translateX: x.value }] }))
  const stripStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, STRIP_FULL], [0, 1], 'clamp') }))
  const contentStyle = useAnimatedStyle(() => ({ opacity: blank.value }))

  function handleAction({ nativeEvent }: AccessibilityActionEvent): void {
    if (nativeEvent.actionName === 'dismiss') onDismiss(item.id)
  }

  return (
    <Animated.View
      aria-hidden={!reachable}
      {...(still ? {} : { exiting: leave })}
      pointerEvents={reachable ? 'auto' : 'none'}
      onLayout={(event) => { width.value = event.nativeEvent.layout.width }}
      style={[styles.item, itemStyle]}
    >
      <Animated.View style={[styles.strip, stripStyle]} aria-hidden>
        <View style={styles.stripTint} />
        {withInk(renderIcon('trash', 16), colors.danger)}
        <Text style={styles.stripText}>Dismiss</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.notice, reachable && styles.noticeRaised, noticeStyle]}>
          <Animated.View
            accessible
            accessibilityActions={[{ name: 'dismiss', label: `Dismiss ${item.title}` }]}
            onAccessibilityAction={handleAction}
            style={[styles.content, contentStyle]}
          >
            <View style={[styles.tile, styles[tone]]}>{withInk(item.icon, tone === 'inverse' ? colors.textInverse : colors.onSolid)}</View>
            <View style={styles.text}>
              <View style={styles.top}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
              <Text style={styles.body} numberOfLines={1}>{item.body}</Text>
            </View>
          </Animated.View>
          {open ? (
            <Animated.View {...(still ? {} : { entering: chipIn, exiting: chipOut })} style={styles.chip}>
              <IconButton contentStyle={styles.chipFace} variant="secondary" size="sm" hitSlop={CHIP_SLOP} icon={renderIcon('x', 12)} label={`Dismiss ${item.title}`} animated={!still} onPress={() => onDismiss(item.id)} />
            </Animated.View>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  )
}

/** Notifications as inset cards on the tray. They fan when collapsed, list when expanded, and swipe away. */
export function NotificationStack({ items, title = 'Notifications', expanded, defaultExpanded = false, onExpandedChange, onDismiss, swipePreview = false, renderIcon, animated = true, style }: NotificationStackProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultExpanded)
  const [gone, setGone] = useState<string[]>([])
  const open = expanded ?? held
  // The list keeps its height until the cards have folded back, and only the tray fill moves.
  const [tall, setTall] = useState(open)
  useEffect(() => {
    if (open || still) { setTall(open); return undefined }
    const timer = setTimeout(() => setTall(false), FAN_MS)
    return () => clearTimeout(timer)
  }, [open, still])

  const seen = useRef(false)
  useEffect(() => { seen.current = true }, [])

  const shown = items.filter(({ id }) => !gone.includes(id))
  const empty = shown.length === 0
  const list = Math.max(shown.length * STEP - (STEP - CARD), CARD)
  const area = open || tall ? list : FANNED
  const trayHeight = HEADER_HEIGHT + space[1] * 3 + (open ? list : FANNED)

  const tray = useSharedValue(trayHeight)
  useEffect(() => {
    tray.value = still ? trayHeight : withTiming(trayHeight, FILL)
  }, [still, tray, trayHeight])
  const trayStyle = useAnimatedStyle(() => ({ height: tray.value }))
  const listStyle = useAnimatedStyle(() => ({ height: area }), [area])

  function toggle(): void {
    setHeld(!open)
    onExpandedChange?.(!open)
  }

  function dismiss(id: string): void {
    setGone((current) => [...current, id])
    onDismiss?.(id)
  }

  return (
    <View style={[styles.stack, empty && styles.stackEmpty, style]}>
      {empty ? null : <Animated.View style={[styles.fill, trayStyle]} />}
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.headingText} accessibilityRole="header">{title}</Text>
          <Text style={styles.count}>{shown.length}</Text>
        </View>
        {empty ? null : <Button variant="ghost" size="sm" animated={animated} aria-expanded={open} onPress={toggle}>{open ? 'Show less' : 'Show all'}</Button>}
      </View>
      {empty ? (
        <View style={styles.empty}><Text style={styles.emptyText}>You’re all caught up.</Text></View>
      ) : (
        <Animated.View accessibilityLiveRegion="polite" accessibilityLabel={`${shown.length} notifications`} style={listStyle}>
          {shown.map((item, index) => <Notice key={item.id} item={item} index={index} open={open} count={shown.length} still={still} arrives={seen.current} swipePreview={swipePreview && index === 0} renderIcon={renderIcon} onDismiss={dismiss} />)}
        </Animated.View>
      )}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  stack: { gap: space[1], maxWidth: 358, padding: space[1], width: '100%' },
  stackEmpty: { backgroundColor: c.ink4, borderRadius: radius.tray },
  fill: { backgroundColor: c.ink4, borderRadius: radius.tray, left: 0, position: 'absolute', right: 0, top: 0 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: HEADER_HEIGHT, paddingLeft: space[3], paddingRight: space[1.5] },
  heading: { flexDirection: 'row', gap: space[2] },
  headingText: type(14, c.textPrimary, '500'),
  count: { ...type(14, c.textTertiary, '500'), fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', height: 72, justifyContent: 'center' },
  emptyText: type(14, c.textSecondary),
  item: { height: CARD, left: 0, position: 'absolute', right: 0, top: 0, transformOrigin: 'top' },
  notice: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, height: CARD },
  noticeRaised: soft(c),
  content: { flexDirection: 'row', gap: space[3], height: '100%', paddingLeft: space[3], paddingRight: space[3.5], paddingVertical: space[3] },
  tile: { alignItems: 'center', borderRadius: radius.md, flexShrink: 0, height: 32, justifyContent: 'center', width: 32 },
  success: { backgroundColor: c.success },
  danger: { backgroundColor: c.danger },
  info: { backgroundColor: c.info },
  inverse: { backgroundColor: c.inverse },
  text: { flex: 1, gap: space[0.5], minWidth: 0 },
  top: { alignItems: 'baseline', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  title: { ...type(14, c.textPrimary, '500'), flexShrink: 1 },
  time: { color: c.textTertiary, flexShrink: 0, fontFamily: font.mono, fontSize: 12 },
  body: { ...type(12, c.textSecondary), lineHeight: 18 },
  strip: { ...StyleSheet.absoluteFill, alignItems: 'center', borderRadius: radius.card, flexDirection: 'row', gap: space[1.5], overflow: 'hidden', paddingLeft: space[4] },
  stripTint: { ...StyleSheet.absoluteFill, backgroundColor: c.danger, opacity: 0.1 },
  stripText: type(12, c.danger, '500'),
  chip: { left: -space[2.5], position: 'absolute', top: -space[2.5], zIndex: 2 },
  chipFace: { backgroundColor: c.surface, borderColor: c.ink8, borderWidth: StyleSheet.hairlineWidth, height: 24, minHeight: 24, minWidth: 0, paddingHorizontal: 0, width: 24 },
})
