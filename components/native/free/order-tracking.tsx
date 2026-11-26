import { useEffect, useId, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { accent, font, radius, space, useColors, type Colors } from '../kit'
import { withInk } from './button'
import { panelEnter, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'

/** A reached bar fills in 240 ms on the standard ease, 40 ms after the one before it; the head pops as it lands. */
const FILL_MS = 240
const FILL_STAGGER_MS = 40
const EASE_STANDARD = Easing.bezier(0.25, 0.1, 0.25, 1)

type Accent = 'emerald' | 'violet' | 'orange' | 'amber' | 'sky'

/** Stand-in product art: a 135 degree gradient between two accents, as the web demo draws its thumbnails. */
export function OrderArt({ from, to }: { from: Accent; to: Accent }) {
  const id = `order-art${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <Svg aria-hidden width="100%" height="100%" viewBox="0 0 36 36" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={accent[from].from} />
          <Stop offset="1" stopColor={accent[to].to} />
        </LinearGradient>
      </Defs>
      <Rect width={36} height={36} fill={`url(#${id})`} />
    </Svg>
  )
}

function StageBar({ name, index, reached, current, still }: { name: string; index: number; reached: boolean; current: boolean; still: boolean }) {
  const styles = useThemed(makeStyles)
  const fill = useSharedValue(still && reached ? 1 : 0)
  useEffect(() => {
    const to = reached ? 1 : 0
    fill.value = still ? to : withDelay(index * FILL_STAGGER_MS, withTiming(to, { duration: FILL_MS, easing: EASE_STANDARD }))
  }, [reached, still, index, fill])
  const grow = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }))
  return (
    // Mobile hides the stage names, as the web does; each bar still says its name and whether it is reached.
    <View accessible accessibilityRole="progressbar" accessibilityLabel={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={reached ? 100 : 0} style={styles.stage}>
      <View style={styles.bar}><Animated.View style={[styles.fill, grow]} /></View>
      {current ? <Animated.View {...(still ? {} : { entering: ZoomIn.duration(FILL_MS).delay(index * FILL_STAGGER_MS + FILL_MS) })} style={styles.head} /> : null}
    </View>
  )
}

export type OrderUpdate = { time: string; title: string; detail: string }
export type OrderLine = { name: string; detail: string; media?: ReactNode }

export type OrderTrackingProps = {
  /** Stage names, in order. */
  stages?: string[]
  /** Index into `stages`. */
  stage: number
  title: string
  subtitle: string
  /** The estimated time. */
  eta: string
  /** Default `Delivery window`, followed by the times. */
  window: string
  /** Newest first. */
  updates: OrderUpdate[]
  store: string
  items: OrderLine[]
  address: string
  updated: string
  /** One Button, which changes with the stage. */
  action: ReactNode
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Stage and ETA, a five stage track, a timeline of updates, the items and the address. */
export function OrderTracking({ stages = ['Ordered', 'Packed', 'Out for delivery', 'Arriving', 'Delivered'], stage, title, subtitle, eta, window: span, updates, store, items, address, updated, action, renderIcon, animated = true, style }: OrderTrackingProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const colors = useColors()
  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} style={[styles.ring, style]}>
      <View style={styles.order}>
        <View style={styles.top}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            <Text style={styles.subLarge}>{subtitle}</Text>
          </View>
          <View>
            <Text style={styles.time}>{eta}</Text>
            <Text style={styles.subLarge}>{span}</Text>
          </View>
        </View>
        <View accessibilityLabel={`Delivery stages, ${stages[stage] ?? ''}`} style={styles.track}>
          {stages.map((name, i) => <StageBar key={name} name={name} index={i} reached={i <= stage} current={i === stage} still={still} />)}
        </View>
        <View style={styles.details}>
          <View>
            <Text accessibilityRole="header" style={styles.heading}>Updates</Text>
            <View style={styles.list}>
              {updates.map((update, i) => (
                <Animated.View key={update.time} {...(still ? {} : { entering: rowEnter(i) })} style={styles.update}>
                  <Text style={styles.clock}>{update.time}</Text>
                  <View style={[styles.dot, i === 0 ? styles.dotLatest : null]} />
                  <View style={styles.lines}>
                    <Text style={styles.line}>{update.title}</Text>
                    <Text style={styles.sub}>{update.detail}</Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          </View>
          <View>
            <View style={styles.storeHead}>
              <Text accessibilityRole="header" style={styles.heading}>{store}</Text>
              <Text style={styles.count}>{items.length} items</Text>
            </View>
            <View style={styles.list}>
              {items.map((item) => (
                <View key={item.name} style={styles.item}>
                  <View style={styles.thumb}>{item.media}</View>
                  <View style={styles.lines}>
                    <Text style={styles.line}>{item.name}</Text>
                    <Text style={styles.sub}>{item.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.address}>{withInk(renderIcon('pin', 14), colors.textSecondary)}<Text style={styles.addressText}>{address}</Text></View>
          </View>
        </View>
        <View style={styles.footer}><Text style={styles.count}>{updated}</Text>{action}</View>
      </View>
    </Animated.View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  ring: { width: '100%', maxWidth: 358, padding: space[1], borderRadius: radius.frame, backgroundColor: c.ink4 },
  order: { borderRadius: radius.panel, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface, overflow: 'hidden' },
  top: { gap: space[3], paddingTop: space[4], paddingHorizontal: space[4] },
  title: { ...type(24, c.textPrimary, '600'), lineHeight: 32 },
  subLarge: { ...type(13, c.textSecondary), lineHeight: 20 },
  sub: { ...type(12, c.textSecondary), lineHeight: 16 },
  time: { ...type(28, c.textPrimary, '600'), lineHeight: 32, fontVariant: ['tabular-nums'] },
  track: { flexDirection: 'row', gap: space[1], padding: space[4], borderBottomWidth: 1, borderBottomColor: c.ink8 },
  stage: { flex: 1, minWidth: 0, justifyContent: 'center' },
  bar: { height: 4, overflow: 'hidden', borderRadius: radius.full, backgroundColor: c.ink8 },
  fill: { ...StyleSheet.absoluteFill, borderRadius: radius.full, backgroundColor: c.textPrimary, transformOrigin: 'left' },
  head: { position: 'absolute', right: -4, width: 8, height: 8, borderRadius: radius.full, backgroundColor: c.textPrimary },
  details: { gap: space[5], padding: space[4], borderBottomWidth: 1, borderBottomColor: c.ink8 },
  heading: { ...type(14, c.textPrimary, '500'), lineHeight: 18 },
  list: { gap: space[3], marginTop: space[3] },
  update: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  clock: { ...type(12, c.textTertiary, '400', true), lineHeight: 16, width: 40, fontFamily: font.mono },
  dot: { width: 6, height: 6, marginVertical: space[1.5], marginHorizontal: space[0.5], borderRadius: radius.full, backgroundColor: c.ink10 },
  dotLatest: { backgroundColor: c.textPrimary },
  lines: { flex: 1, minWidth: 0 },
  line: { ...type(13, c.textPrimary), lineHeight: 18 },
  storeHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  count: { ...type(12, c.textTertiary), lineHeight: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space[2.5] },
  thumb: { width: 36, height: 36, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: c.ink5 },
  address: { flexDirection: 'row', alignItems: 'center', gap: space[1.5], marginTop: space[3], paddingTop: space[3], borderTopWidth: 1, borderTopColor: c.ink8 },
  addressText: { ...type(12, c.textSecondary), flex: 1, lineHeight: 16 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], paddingVertical: space[2.5], paddingHorizontal: space[4] },
})
