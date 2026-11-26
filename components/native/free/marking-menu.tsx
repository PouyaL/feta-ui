import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type AccessibilityActionEvent, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Line, Path } from 'react-native-svg'
import { radius, softElevation, space, useColors, type Colors } from '../kit'
import { withInk } from './button'
import { type, useStill, useThemed } from './card'
import { animateTo, EASE_OUT, useCompact } from './popover'

const HOLD_MS = 250
const FLICK_SPEED = 0.6
const FLICK_MIN_PX = 24
const HUB_RADIUS = 32
const DISC = { tablet: 224, phone: 232 }
const RING = { tablet: 82, phone: 86 }
const OPEN_RING = 60
const OPEN_MS = 180
const TARGET_MS = 220
const TARGET_STAGGER_MS = 15
const WEDGE_MS = 90
const LIFT = { stiffness: 500, damping: 28 }
const LIFT_PX = 7
const PICK_MS = 160
const TRAIL_MS = 400
const CHIP_MS = 200
const CHIP_HOLD_MS = 1200
const TARGET_HALF = 20
const NO_SECTOR = -1

const DISC_IN = ZoomIn.duration(OPEN_MS).easing(EASE_OUT).withInitialValues({ transform: [{ scale: 0.6 }] })
const HUB_IN = FadeIn.duration(WEDGE_MS)
const CHIP_IN = FadeInDown.duration(CHIP_MS).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 6 }] })
const CHIP_OUT = FadeOut.duration(CHIP_MS)

const AnimatedLine = Animated.createAnimatedComponent(Line)

function pickedOut() {
  'worklet'
  const leave = { duration: PICK_MS, easing: EASE_OUT }
  return { initialValues: { opacity: 1, transform: [{ scale: 1 }] }, animations: { opacity: withTiming(0, leave), transform: [{ scale: withTiming(1.04, leave) }] } }
}

function dismissedOut() {
  'worklet'
  const leave = { duration: PICK_MS, easing: EASE_OUT }
  return { initialValues: { opacity: 1, transform: [{ scale: 1 }] }, animations: { opacity: withTiming(0, leave), transform: [{ scale: withTiming(0.96, leave) }] } }
}

export type MarkingItem = { id: string; label: string; icon: ReactNode }

export type MarkingMenuProps = {
  /** Up to eight, clockwise from the top. Keep their positions stable: people learn directions. */
  items: MarkingItem[]
  onPick?: (id: string) => void
  /** The surface it opens on. */
  children?: ReactNode
  /** Name of the surface. */
  label?: string
  /** Opens the disc at the center on mount. */
  defaultOpen?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Point = { x: number; y: number }

const sectorOf = (dx: number, dy: number, count: number): number => {
  'worklet'
  const angle = (Math.atan2(dx, -dy) * 180) / Math.PI
  return Math.round(((angle + 360) % 360) / (360 / count)) % count
}

const pointAt = (index: number, count: number, reach: number): Point => {
  const angle = (index * (360 / count) * Math.PI) / 180
  return { x: Math.sin(angle) * reach, y: -Math.cos(angle) * reach }
}

/** One sector pointing up, inset 4 from the rim. */
function wedgePath(degrees: number): string {
  const reach = 108
  const half = (degrees / 2) * (Math.PI / 180)
  const x = Math.sin(half) * reach
  const y = -Math.cos(half) * reach
  return `M0 0 L${-x} ${y} A${reach} ${reach} 0 0 1 ${x} ${y} Z`
}

type TargetProps = { item: MarkingItem; index: number; count: number; ring: number; center: number; on: boolean; picked: boolean; engaged: boolean; still: boolean }

function Target({ item, index, count, ring, center, on, picked, engaged, still }: TargetProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const at = pointAt(index, count, ring)
  const from = pointAt(index, count, OPEN_RING)
  const lift = on ? pointAt(index, count, LIFT_PX) : { x: 0, y: 0 }
  const x = useSharedValue(still ? at.x : from.x)
  const y = useSharedValue(still ? at.y : from.y)
  const opacity = useSharedValue(still ? 1 : 0)
  const scale = useSharedValue(1)
  const toX = at.x + lift.x
  const toY = at.y + lift.y

  useEffect(() => {
    if (still) {
      x.value = toX
      y.value = toY
      scale.value = on ? 1.1 : 1
      return
    }
    if (engaged) {
      x.value = withSpring(toX, LIFT)
      y.value = withSpring(toY, LIFT)
      scale.value = withSpring(on ? 1.1 : 1, LIFT)
      return
    }
    const arrive = { duration: TARGET_MS, easing: EASE_OUT }
    const wait = index * TARGET_STAGGER_MS
    x.value = withDelay(wait, withTiming(toX, arrive))
    y.value = withDelay(wait, withTiming(toY, arrive))
    opacity.value = withDelay(wait, withTiming(1, arrive))
    scale.value = withTiming(1, arrive)
  }, [engaged, index, on, opacity, scale, still, toX, toY, x, y])

  const place = useAnimatedStyle(() => ({ left: center - TARGET_HALF, opacity: opacity.value, top: center - TARGET_HALF, transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }), [center])

  return (
    <Animated.View style={[styles.target, on && styles.targetOn, picked && styles.targetPicked, place]}>
      {withInk(item.icon, on ? colors.textPrimary : colors.textSecondary)}
    </Animated.View>
  )
}

function Wedge({ sector, step, disc, still }: { sector: number; step: number; disc: number; still: boolean }) {
  const colors = useColors()
  const styles = useThemed(createStyles)
  const turn = useSharedValue(sector * step)
  useEffect(() => { turn.value = withTiming(sector * step, { duration: still ? 0 : WEDGE_MS, easing: EASE_OUT }) }, [sector, step, still, turn])
  const turned = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  return (
    <Animated.View pointerEvents="none" style={[styles.fill, turned]}>
      <Svg aria-hidden width={disc} height={disc} viewBox="-112 -112 224 224"><Path d={wedgePath(step)} fill={colors.ink5} /></Svg>
    </Animated.View>
  )
}

function Trail({ from, to, onDone }: { from: Point; to: Point; onDone: () => void }) {
  const colors = useColors()
  const styles = useThemed(createStyles)
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  const share = useSharedValue(0)
  useEffect(() => { share.value = animateTo(1, { duration: TRAIL_MS, easing: EASE_OUT }, onDone) }, [onDone, share])
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - share.value), strokeOpacity: 0.7 * (1 - share.value) }))
  return (
    <Svg aria-hidden pointerEvents="none" style={styles.fill}>
      <AnimatedLine x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" strokeDasharray={length} animatedProps={animatedProps} />
    </Svg>
  )
}

/** A radial menu for people who learn it. Hold for eight targets, or flick the same way to pick without looking. */
export function MarkingMenu({ items, onPick, children, label = 'Canvas', defaultOpen = false, animated = true, style }: MarkingMenuProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const compact = useCompact()
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const chipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const press = useRef<(Point & { at: number }) | null>(null)
  const size = useRef({ width: 0, height: 0 })
  const opened = useRef<Point | null>(null)
  const [origin, setOrigin] = useState<Point | null>(null)
  const [sector, setSector] = useState<number | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [chip, setChip] = useState<string | null>(null)
  const [trail, setTrail] = useState<{ from: Point; to: Point; key: number } | null>(null)
  const engagedSector = useSharedValue(NO_SECTOR)
  const liveOpen = useSharedValue(false)
  const originX = useSharedValue(0)
  const originY = useSharedValue(0)
  const count = items.length
  const step = 360 / count
  const disc = compact ? DISC.phone : DISC.tablet
  const ring = compact ? RING.phone : RING.tablet
  const half = disc / 2

  useEffect(() => () => {
    clearTimeout(hold.current)
    clearTimeout(chipTimer.current)
    clearTimeout(closeTimer.current)
  }, [])

  function show(point: Point): void {
    const next = { x: Math.max(half, Math.min(size.current.width - half, point.x)), y: Math.max(half, Math.min(size.current.height - half, point.y)) }
    opened.current = next
    originX.value = next.x
    originY.value = next.y
    liveOpen.value = true
    setOrigin(next)
  }

  function close(): void {
    opened.current = null
    liveOpen.value = false
    engagedSector.value = NO_SECTOR
    setOrigin(null)
    setPicked(null)
    setSector(null)
  }

  function announce(item: MarkingItem): void {
    setChip(item.label)
    clearTimeout(chipTimer.current)
    chipTimer.current = setTimeout(() => setChip(null), CHIP_HOLD_MS)
    onPick?.(item.id)
  }

  function finish(index: number | null): void {
    const item = index === null ? undefined : items[index]
    if (!item) { close(); return }
    setPicked(item.id)
    closeTimer.current = setTimeout(close, still ? 0 : PICK_MS)
    announce(item)
  }

  function begin(x: number, y: number): void {
    press.current = { x, y, at: Date.now() }
    clearTimeout(hold.current)
    hold.current = setTimeout(() => show({ x, y }), HOLD_MS)
  }

  function end(x: number, y: number): void {
    clearTimeout(hold.current)
    const start = press.current
    press.current = null
    const at = opened.current
    if (at) {
      const dx = x - at.x
      const dy = y - at.y
      if (start) finish(Math.hypot(dx, dy) < HUB_RADIUS ? null : sectorOf(dx, dy, count))
      return
    }
    if (!start) return
    const dx = x - start.x
    const dy = y - start.y
    const distance = Math.hypot(dx, dy)
    const speed = distance / Math.max(1, Date.now() - start.at)
    if (distance < FLICK_MIN_PX || speed < FLICK_SPEED) return
    const item = items[sectorOf(dx, dy, count)]
    if (!item) return
    if (!still) setTrail({ from: start, to: { x, y }, key: Date.now() })
    announce(item)
  }

  const showSector = (next: number): void => setSector(next === NO_SECTOR ? null : next)

  const pan = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => { runOnJS(begin)(e.x, e.y) })
    .onUpdate((e) => {
      if (!liveOpen.value) return
      const dx = e.x - originX.value
      const dy = e.y - originY.value
      const next = Math.hypot(dx, dy) < HUB_RADIUS ? NO_SECTOR : sectorOf(dx, dy, count)
      if (next === engagedSector.value) return
      engagedSector.value = next
      runOnJS(showSector)(next)
    })
    .onFinalize((e) => { runOnJS(end)(e.x, e.y) }),
  // The handlers read refs, so only what the worklet captures is listed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [count, disc, items, still])

  function onLayout(e: LayoutChangeEvent): void {
    const { width, height } = e.nativeEvent.layout
    size.current = { width, height }
    if (defaultOpen && !opened.current) show({ x: width / 2, y: height / 2 })
  }

  function onAction(e: AccessibilityActionEvent): void {
    const item = items.find((entry) => entry.id === e.nativeEvent.actionName)
    if (item) announce(item)
  }

  const discSpot = useAnimatedStyle(() => ({ height: disc, left: originX.value - disc / 2, top: originY.value - disc / 2, width: disc }), [disc])
  const hubLabel = sector === null ? '' : items[sector]?.label ?? ''

  return (
    <GestureDetector gesture={pan}>
      <View accessible accessibilityLabel={label} accessibilityHint="Hold for the menu, or flick toward an action" accessibilityActions={items.map((item) => ({ name: item.id, label: item.label }))} onAccessibilityAction={onAction} onLayout={onLayout} style={[styles.area, style]}>
        {children}
        {origin ? (
          <Animated.View {...(still ? {} : { entering: DISC_IN, exiting: picked ? pickedOut : dismissedOut })} style={[styles.disc, discSpot]}>
            {sector !== null ? <Wedge sector={sector} step={step} disc={disc} still={still} /> : null}
            {items.map((item, i) => <Target key={item.id} item={item} index={i} count={count} ring={ring} center={half} on={sector === i} picked={picked === item.id} engaged={sector !== null} still={still} />)}
            <View style={styles.hub}>
              <Animated.View key={hubLabel} {...(still ? {} : { entering: HUB_IN })}><Text numberOfLines={2} style={styles.hubLabel}>{hubLabel}</Text></Animated.View>
            </View>
          </Animated.View>
        ) : null}
        {trail ? <Trail key={trail.key} from={trail.from} to={trail.to} onDone={() => setTrail(null)} /> : null}
        {chip ? <Animated.View {...(still ? {} : { entering: CHIP_IN, exiting: CHIP_OUT })} accessibilityLiveRegion="polite" style={styles.chip}><Text style={styles.chipLabel}>Opened {chip}</Text></Animated.View> : null}
      </View>
    </GestureDetector>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  area: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, minHeight: 320, overflow: 'hidden', width: '100%' },
  fill: { ...StyleSheet.absoluteFill },
  disc: { boxShadow: softElevation(c), backgroundColor: c.muted, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1, position: 'absolute', zIndex: 5 },
  target: { alignItems: 'center', borderColor: 'transparent', borderRadius: radius.full, borderWidth: 1.5, height: 40, justifyContent: 'center', position: 'absolute', width: 40 },
  targetOn: { backgroundColor: c.surface, borderColor: c.textPrimary },
  targetPicked: { backgroundColor: c.ink10 },
  hub: { alignItems: 'center', backgroundColor: c.ink4, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1, height: 64, justifyContent: 'center', left: '50%', marginLeft: -32, marginTop: -32, padding: space[1], position: 'absolute', top: '50%', width: 64 },
  hubLabel: { ...type(11, c.textPrimary, '500'), lineHeight: 14, textAlign: 'center' },
  chip: { alignSelf: 'center', backgroundColor: c.inverse, borderRadius: radius.full, bottom: space[4], paddingHorizontal: space[3], paddingVertical: space[1.5], position: 'absolute', width: 160 },
  chipLabel: { ...type(14, c.textInverse), lineHeight: 20, textAlign: 'center' },
})
