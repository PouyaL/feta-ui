import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { font, radius, space, type Colors } from '../kit'
import { panelEnter, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { Progress } from './progress'

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
          {stages.map((name, i) => (
            <View key={name} style={styles.stage}>
              <Progress size="sm" value={i <= stage ? 100 : 0} state={i <= stage ? 'partial' : 'empty'} label={name} animated={animated} />
              {i === stage ? <View style={styles.head} /> : null}
            </View>
          ))}
        </View>
        <View style={styles.section}>
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
        <View style={styles.section}>
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
          <View style={styles.address}>{renderIcon('pin', 14)}<Text style={styles.addressText}>{address}</Text></View>
        </View>
        <View style={styles.footer}><Text style={styles.count}>{updated}</Text>{action}</View>
      </View>
    </Animated.View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  ring: { width: '100%', maxWidth: 358, padding: space[1], borderRadius: radius.frame, backgroundColor: c.ink4 },
  order: { borderRadius: radius.panel, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  top: { gap: space[3], paddingTop: space[4], paddingHorizontal: space[4] },
  title: { ...type(18, c.textPrimary, '600'), lineHeight: 24 },
  subLarge: { ...type(13, c.textSecondary), lineHeight: 20 },
  sub: type(12, c.textSecondary),
  time: { ...type(24, c.textPrimary, '600'), lineHeight: 30, fontVariant: ['tabular-nums'] },
  track: { flexDirection: 'row', gap: space[1], padding: space[4], borderBottomWidth: 1, borderBottomColor: c.ink8 },
  stage: { flex: 1, minWidth: 0, justifyContent: 'center' },
  head: { position: 'absolute', right: -4, width: 8, height: 8, borderRadius: radius.full, backgroundColor: c.textPrimary },
  section: { padding: space[4], borderBottomWidth: 1, borderBottomColor: c.ink8 },
  heading: type(14, c.textPrimary, '500'),
  list: { gap: space[3], marginTop: space[3] },
  update: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  clock: { ...type(12, c.textTertiary, '400', true), width: 40, fontFamily: font.mono },
  dot: { width: 6, height: 6, marginVertical: space[1.5], marginHorizontal: space[0.5], borderRadius: radius.full, backgroundColor: c.ink10 },
  dotLatest: { backgroundColor: c.textPrimary },
  lines: { flex: 1, minWidth: 0 },
  line: { ...type(13, c.textPrimary), lineHeight: 18 },
  storeHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  count: type(12, c.textTertiary),
  item: { flexDirection: 'row', alignItems: 'center', gap: space[2.5] },
  thumb: { width: 36, height: 36, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: c.ink5 },
  address: { flexDirection: 'row', alignItems: 'center', gap: space[1.5], marginTop: space[3], paddingTop: space[3], borderTopWidth: 1, borderTopColor: c.ink8 },
  addressText: { ...type(12, c.textSecondary), flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], paddingVertical: space[2.5], paddingHorizontal: space[4] },
})
