import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { interpolate, runOnJS, runOnUI, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated'
import Svg, { Circle, Ellipse, Rect } from 'react-native-svg'
import { font, radius, space, useColors, type Colors } from '../kit'
import { Button, withInk } from './button'
import { Card, type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'

/** Stack release: 350 ms. Details: 350 ms, spring 0.25. */
const FLING_SPRING = { duration: 350, dampingRatio: 1 } as const
const BACK_SPRING = { duration: 350, dampingRatio: 0.75 } as const
const DETAILS_SPRING = BACK_SPRING
/** Skip past 30% of the card width, or at this velocity. */
const SKIP_SHARE = 0.3
const SKIP_VELOCITY = 500
/** Rotate is x / 20. */
const TILT = 20
const PRINT_WIDTH = 232
/** The Rest print is 232 wide, the Details print 300. */
const DETAILS_FROM = PRINT_WIDTH / 300
/** Cards shown in the fan. One more waits behind it, so the back of the fan fills as it moves up. */
const FAN = 4
const DEPTHS = [0, 1, 2, 3]
const DEPTH_Y = [0, -6.5, -9, -10.5]
const DEPTH_ROTATE = [0, -3, 6, -8]
const DEPTH_SCALE = [1, 0.961, 0.918, 0.879]
const HELD = { x: 70, y: -10, rotate: 9, hintX: 66 }
/** Stage width before layout. */
const STAGE_WIDTH = 358

export type PrintItem = {
  name: string
  meta: string
  price: string
  art: ReactNode
  description?: string
  specs?: [string, string][]
}

export type StackState = 'rest' | 'dragging' | 'details'

export type CardStackProps = {
  items?: PrintItem[]
  /** Controls which print is on top. */
  index?: number
  defaultIndex?: number
  onIndexChange?: (index: number) => void
  /** `dragging` holds the pose, for a preview. Leave it out to keep the state here. */
  state?: StackState
  defaultState?: StackState
  onStateChange?: (state: StackState) => void
  onAdd?: (item: PrintItem) => void
  renderIcon: RenderIcon
  /** `false` drops the fling and fan: the arrows swap prints in place. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const Paper = ({ children }: { children: ReactNode }) => <Svg aria-hidden width="100%" height="100%" viewBox="0 0 216 216">{children}</Svg>

/** Line art in the avatar paper and ink. Replace it with images through `items`. */
const createPrints = (c: Colors): PrintItem[] => {
  const ink = c.textPrimary
  return [
    {
      name: 'Low Sun', meta: 'Print 01 · Risograph', price: '$48', description: 'The last ten minutes of light over the bay, pulled in two inks.', specs: [['Size', 'A3'], ['Paper', 'Cream 120g'], ['Edition', 'of 50']],
      art: <Paper><Circle cx={107} cy={97} r={49} fill={ink} />{[86, 76, 65, 54, 43, 32].map((w, i) => <Rect key={w} x={108 - w / 2} y={134 + i * 8} width={w} height={3} fill={ink} />)}</Paper>,
    },
    {
      name: 'Ridge Line', meta: 'Print 02 · Screen print', price: '$72', description: 'Two ridges at dusk, screened by hand on heavy stock.', specs: [['Size', 'A2'], ['Paper', 'Natural 200g'], ['Edition', 'of 30']],
      art: <Paper><Circle cx={150} cy={46} r={13} fill={ink} /><Ellipse cx={83} cy={207} rx={145} ry={93} fill={ink} /><Ellipse cx={165} cy={218} rx={124} ry={73} fill={ink} opacity={0.6} /></Paper>,
    },
    {
      name: 'Tide Pools', meta: 'Print 03 · Risograph', price: '$40', description: 'Rings of water at low tide, in one ink and the paper.', specs: [['Size', 'A4'], ['Paper', 'Cream 120g'], ['Edition', 'of 80']],
      art: <Paper>{[89, 77, 64, 51, 38, 25, 13].map((r, i) => <Circle key={r} cx={108} cy={108} r={r * 1.09} fill={i % 2 ? c.muted : ink} />)}</Paper>,
    },
    {
      name: 'Night Market', meta: 'Print 04 · Giclée', price: '$56', description: 'Nine stalls seen from above just before they close.', specs: [['Size', 'A3'], ['Paper', 'Cotton 310g'], ['Edition', 'of 40']],
      art: <Paper>{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Rect key={i} x={32 + (i % 3) * 53} y={32 + Math.floor(i / 3) * 53} width={44} height={44} rx={4} fill={ink} opacity={i % 2 ? 1 : 0.6} />)}</Paper>,
    },
    {
      name: 'Salt Flats', meta: 'Print 05 · Risograph', price: '$44', description: 'Bands of white crust running out to the horizon.', specs: [['Size', 'A3'], ['Paper', 'Cream 120g'], ['Edition', 'of 60']],
      art: <Paper>{[0, 1, 2, 3, 4, 5, 6].map((i) => <Rect key={i} x={28} y={40 + i * 22} width={160} height={4 + i * 2} rx={2} fill={ink} opacity={0.4 + i * 0.1} />)}</Paper>,
    },
  ]
}

const pad = (value: number): string => String(value).padStart(2, '0')

function Caption({ item }: { item: PrintItem }) {
  const styles = useThemed(createStyles)
  return (
    <View style={styles.caption}>
      <View style={styles.captionText}><Text style={styles.name} numberOfLines={1}>{item.name}</Text><Text style={styles.meta} numberOfLines={1}>{item.meta}</Text></View>
      <Text style={styles.name}>{item.price}</Text>
    </View>
  )
}

type PrintProps = {
  item: PrintItem
  /** The print's place in `items`. */
  slot: number
  count: number
  isTop: boolean
  /** The mid-drag pose, read on the UI thread so a grab can drop it without a render. */
  held: SharedValue<boolean>
  head: SharedValue<number>
  x: SharedValue<number>
  lift: SharedValue<number>
  away: SharedValue<number>
  onPress: () => void
}

/** Depth is worked out on the UI thread from `head`, so the whole fan steps forward in one frame with no React render in between. */
function Print({ item, slot, count, isTop, held, head, x, lift, away, onPress }: PrintProps) {
  const styles = useThemed(createStyles)
  const pose = useAnimatedStyle(() => {
    const depth = (slot - head.value + count) % count
    if (depth === 0) {
      const posed = held.value
      const drag = posed ? HELD.x : x.value
      const reach = away.value
      return {
        opacity: posed ? 1 : 1 - Math.max(0, (Math.abs(drag) - reach * 0.6) / (reach * 0.4)),
        zIndex: count,
        transform: [{ translateX: drag }, { translateY: posed ? HELD.y : 0 }, { rotate: `${posed ? HELD.rotate : drag / TILT}deg` }, { scale: 1 }],
      }
    }
    const place = Math.max(0, depth - lift.value)
    return {
      opacity: interpolate(place, [FAN - 1, FAN], [1, 0], 'clamp'),
      zIndex: count - depth,
      transform: [
        { translateX: 0 },
        { translateY: interpolate(place, DEPTHS, DEPTH_Y, 'clamp') },
        { rotate: `${interpolate(place, DEPTHS, DEPTH_ROTATE, 'clamp')}deg` },
        { scale: interpolate(place, DEPTHS, DEPTH_SCALE, 'clamp') },
      ],
    }
  })
  return (
    <Animated.View style={[styles.print, pose]}>
      <Pressable
        accessibilityElementsHidden={!isTop}
        importantForAccessibility={isTop ? 'auto' : 'no-hide-descendants'}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.meta}, ${item.price}. Open details`}
        disabled={!isTop}
        style={styles.printInner}
        onPress={onPress}
      >
        <View style={styles.art}>{item.art}</View>
        <Caption item={item} />
      </Pressable>
    </Animated.View>
  )
}

function Details({ item, still, renderIcon, animated, onAdd }: { item: PrintItem; still: boolean; renderIcon: RenderIcon; animated: boolean; onAdd?: ((item: PrintItem) => void) | undefined }) {
  const styles = useThemed(createStyles)
  const open = useSharedValue(still ? 1 : 0)
  useEffect(() => {
    open.value = still ? 1 : withSpring(1, DETAILS_SPRING)
  }, [open, still])
  const grow = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(open.value, [0, 1], [-16, 0]) }, { scale: interpolate(open.value, [0, 1], [DETAILS_FROM, 1]) }] }))
  return (
    <Animated.View style={[styles.detail, grow]}>
      <View style={styles.detailArt}>{item.art}</View>
      <Caption item={item} />
      <View style={styles.more}>
        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
        {item.specs ? (
          <View style={styles.specs}>
            {item.specs.map(([label, value], index, all) => (
              <View key={label} style={[styles.spec, index > 0 && styles.specMiddle, index === all.length - 1 && styles.specLast]}>
                <Text style={styles.meta}>{label}</Text>
                <Text style={styles.specValue}>{value}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Button size="lg" leadingIcon={renderIcon('shopping-cart', 16)} feedback={{ success: 'Added to cart' }} animated={animated} onPress={() => onAdd?.(item)}>Add to cart · {item.price}</Button>
      </View>
    </Animated.View>
  )
}

/** A fanned stack of prints. Drag the top card to skip, or open it for specs and Add to cart. */
export function CardStack({ items, index, defaultIndex = 0, onIndexChange, state, defaultState = 'rest', onStateChange, onAdd, renderIcon, animated = true, style }: CardStackProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const prints = useThemed(createPrints)
  const list = items ?? prints
  const still = useStill(animated)
  const count = list.length
  const [ownIndex, setOwnIndex] = useState(defaultIndex)
  const [ownState, setOwnState] = useState<StackState>(defaultState)
  const [armed, setArmed] = useState(false)
  const current = index ?? ownIndex
  const shown = state ?? ownState
  // `dragging` poses the top card mid-drag. Grabbing it hands the pose to a real drag, from where the pose left it.
  const [released, setReleased] = useState(false)
  useEffect(() => { setReleased(false) }, [shown])
  const held = shown === 'dragging' && !released
  const posed = useSharedValue(held)
  useEffect(() => { posed.value = held }, [held, posed])
  const start = useSharedValue(0)
  const details = shown === 'details'
  const top = list[current]

  const head = useSharedValue(current)
  const x = useSharedValue(0)
  const away = useSharedValue(STAGE_WIDTH * 0.9)
  const busy = useSharedValue(false)
  const lift = useDerivedValue(() => Math.min(1, Math.abs(x.value) / (PRINT_WIDTH * SKIP_SHARE)))

  useEffect(() => { head.value = current }, [current, head])

  useAnimatedReaction(() => lift.value >= 1 && !busy.value, (next, previous) => { if (next !== previous) runOnJS(setArmed)(next) })

  const commit = useCallback((next: number): void => {
    setOwnIndex(next)
    onIndexChange?.(next)
  }, [onIndexChange])

  const fling = useCallback((velocity: number): void => {
    'worklet'
    busy.value = true
    const sign = x.value < 0 ? -1 : 1
    x.value = withSpring(sign * away.value, { ...FLING_SPRING, velocity }, (finished) => {
      if (!finished) return
      head.value = (head.value + 1) % count
      x.value = 0
      busy.value = false
      runOnJS(commit)(head.value)
    })
  }, [away, busy, commit, count, head, x])

  const comeBack = useCallback((): void => {
    'worklet'
    busy.value = true
    head.value = (head.value - 1 + count) % count
    runOnJS(commit)(head.value)
    x.value = -away.value
    x.value = withSpring(0, BACK_SPRING, () => { busy.value = false })
  }, [away, busy, commit, count, head, x])

  function skip(direction: 1 | -1): void {
    if (busy.value || count === 0) return
    if (still) { commit((current + direction + count) % count); return }
    if (direction > 0) runOnUI(fling)(0)
    else runOnUI(comeBack)()
  }

  const pan = useMemo(() => Gesture.Pan()
    .enabled(!still && !details && count > 1)
    .activeOffsetX([-6, 6])
    .onStart(() => { start.value = posed.value ? HELD.x : 0; if (posed.value) { x.value = HELD.x; posed.value = false } })
    .failOffsetY([-16, 16])
    .onUpdate((event) => { if (!busy.value) x.value = start.value + event.translationX })
    .onEnd((event) => {
      if (start.value !== 0) runOnJS(setReleased)(true)
      if (busy.value) return
      if (Math.abs(event.translationX) > PRINT_WIDTH * SKIP_SHARE || Math.abs(event.velocityX) > SKIP_VELOCITY) fling(event.velocityX)
      else x.value = withSpring(0, BACK_SPRING)
    }), [busy, count, details, fling, posed, start, still, x])

  const hintStyle = useAnimatedStyle(() => ({
    opacity: posed.value ? 1 : busy.value ? 0 : lift.value,
    transform: [{ translateX: posed.value ? HELD.hintX : x.value }],
  }))

  function setStackState(next: StackState): void {
    setOwnState(next)
    onStateChange?.(next)
  }

  function openDetails(): void {
    if (Math.abs(x.value) < 1) setStackState('details')
  }

  const number = (armed || held) && count > 0 ? ((current + 1) % count) + 1 : current + 1
  const slots = Array.from({ length: Math.min(FAN + 1, count) }, (_, depth) => (current + depth) % count)

  return (
    <View onAccessibilityEscape={details ? () => setStackState('rest') : undefined} style={[styles.stack, style]}>
      <Card
        animated={animated}
        bodyStyle={styles.stage}
        footerStyle={styles.controls}
        footer={
          <>
            <IconButton size="sm" variant="secondary" icon={renderIcon('arrow-left', 16)} label="Previous print" animated={animated} onPress={() => skip(-1)} />
            <Text accessibilityLiveRegion="polite" accessibilityLabel={`Print ${number} of ${count}`} style={styles.counter}>{pad(number)} / {pad(count)}</Text>
            {details
              ? <IconButton size="sm" variant="secondary" icon={renderIcon('x', 16)} label="Close details" animated={animated} onPress={() => setStackState('rest')} />
              : <IconButton size="sm" variant="secondary" icon={renderIcon('arrow-right', 16)} label="Next print" animated={animated} onPress={() => skip(1)} />}
          </>
        }
      >
        {details && top ? (
          <View style={styles.sceneDetails}>
            <Details key={top.name} item={top} still={still} renderIcon={renderIcon} animated={animated} onAdd={onAdd} />
          </View>
        ) : (
          <GestureDetector gesture={pan}>
            <View style={styles.scene} onLayout={(event) => { const { width } = event.nativeEvent.layout; if (width > 0) away.value = width * 0.9 }}>
              {slots.map((slot) => {
                const item = list[slot]
                return item ? <Print key={slot} item={item} slot={slot} count={count} isTop={slot === current} held={posed} head={head} x={x} lift={lift} away={away} onPress={openDetails} /> : null
              })}
              <Animated.View pointerEvents="none" style={[styles.hintRow, hintStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <View style={styles.hint}>{withInk(renderIcon('arrow-right', 14), colors.textInverse)}<Text style={styles.hintText}>Release to skip</Text></View>
              </Animated.View>
            </View>
          </GestureDetector>
        )}
      </Card>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  stack: { maxWidth: 358, width: '100%' },
  // The stage replaces the inset card: the prints are the cards here.
  stage: { backgroundColor: 'transparent', borderWidth: 0, overflow: 'visible', padding: 0 },
  scene: { height: 380 },
  sceneDetails: { alignItems: 'center', paddingVertical: space[4] },
  print: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, height: 282, left: '50%', marginLeft: -PRINT_WIDTH / 2, position: 'absolute', top: space[6], width: PRINT_WIDTH },
  printInner: { flex: 1, gap: space[2.5], paddingBottom: space[3], paddingHorizontal: space[2], paddingTop: space[2] },
  art: { backgroundColor: c.muted, borderRadius: radius.xl, flexShrink: 0, height: 216, overflow: 'hidden', width: 216 },
  caption: { flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingHorizontal: space[1], width: '100%' },
  captionText: { flexShrink: 1, gap: space[0.5], minWidth: 0 },
  name: type(14, c.textPrimary, '500'),
  meta: type(12, c.textTertiary),
  hintRow: { alignItems: 'center', left: 0, position: 'absolute', right: 0, top: space[1.5], zIndex: 1000 },
  hint: { alignItems: 'center', backgroundColor: c.inverse, borderRadius: radius.full, flexDirection: 'row', gap: space[1], paddingBottom: space[2], paddingLeft: space[2.5], paddingRight: space[3], paddingTop: space[2] },
  hintText: type(12, c.textInverse, '500'),
  detail: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, gap: space[2.5], maxWidth: '100%', paddingBottom: space[3], paddingHorizontal: space[2], paddingTop: space[2], transformOrigin: 'top', width: 300 },
  detailArt: { aspectRatio: 1, backgroundColor: c.muted, borderRadius: radius.xl, overflow: 'hidden', width: '100%' },
  more: { gap: space[3], paddingHorizontal: space[1], paddingTop: space[1] },
  description: { ...type(12, c.textSecondary), lineHeight: 20 },
  specs: { flexDirection: 'row', justifyContent: 'space-between' },
  spec: { gap: space[0.5] },
  specMiddle: { alignItems: 'center' },
  specLast: { alignItems: 'flex-end' },
  specValue: { ...type(14, c.textPrimary, '600'), lineHeight: 20 },
  controls: { justifyContent: 'space-between', paddingBottom: space[1], paddingHorizontal: space[1.5], paddingTop: space[1.5] },
  counter: { color: c.textTertiary, fontFamily: font.mono, fontSize: 12 },
})
