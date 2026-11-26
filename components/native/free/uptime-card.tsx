import { memo, useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { FadeIn, FadeOut, runOnJS, useSharedValue } from 'react-native-reanimated'
import { accent, radius, space, type Colors } from '../kit'
import { withInk, SELF } from './button'
import { Badge } from './badge'
import { Card, type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'

const DEFAULT_DAYS = 90
const DAY_MS = 86400000
const BAR_HEIGHT = 28

export type UptimeStatus = 'operational' | 'degraded' | 'outage'
export type UptimeIncident = {
  /** 0 is today. */
  daysAgo: number
  status: Exclude<UptimeStatus, 'operational'>
  /** Like `API degraded for 14 min`. */
  title: string
  /** Like `elevated latency in us-east`. Shown after the date. */
  detail: string
}
export type UptimeService = { name: string; uptime: string; incidents?: UptimeIncident[] }
/** One day of one service, addressed by its row and how long ago it was. */
export type UptimeDay = { service: number; daysAgo: number }

export type UptimeCardProps = {
  services: UptimeService[]
  title?: ReactNode
  /** Default 90. Phones show the latest half of these. */
  days?: number
  /** The day counted as today. Default the current date. */
  today?: Date
  /** The story shown without touching, for docs and tests. */
  active?: UptimeDay | null
  /** The pinned day. Controlled when set. `null` is none. */
  pinned?: UptimeDay | null
  defaultPinned?: UptimeDay | null
  onPinnedChange?: (day: UptimeDay | null) => void
  locale?: string
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const same = (a: UptimeDay | null | undefined, b: UptimeDay | null | undefined): boolean => a?.service === b?.service && a?.daysAgo === b?.daysAgo

type RowProps = { service: UptimeService; shownDays: number; active: number | null; label: string; onScrub: (daysAgo: number | null) => void; onTap: (daysAgo: number) => void; onStep: (by: number) => void }

/** One row of bars, one touch surface: 45 bars cannot each be 44 wide, so the row reads the finger's x. */
const Row = memo(function Row({ service, shownDays, active, label, onScrub, onTap, onStep }: RowProps) {
  const styles = useThemed(createStyles)
  const incidents = useMemo(() => new Map(service.incidents?.map((item) => [item.daysAgo, item])), [service.incidents])
  const width = useSharedValue(1)
  const hit = (x: number): number => {
    'worklet'
    return Math.max(0, Math.min(shownDays - 1, shownDays - 1 - Math.floor((x / width.value) * shownDays)))
  }
  const pan = Gesture.Pan().activeOffsetX([-6, 6]).failOffsetY([-12, 12])
    .onUpdate((event) => { runOnJS(onScrub)(hit(event.x)) })
    .onFinalize(() => { runOnJS(onScrub)(null) })
  const tap = Gesture.Tap().onEnd((event) => { runOnJS(onTap)(hit(event.x)) })
  return (
    <View style={styles.service}>
      <View style={styles.label}><Text style={styles.name}>{service.name}</Text><Text style={styles.uptime}>{service.uptime}</Text></View>
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={service.name}
          aria-valuetext={label}
          aria-valuemin={0}
          aria-valuemax={shownDays - 1}
          aria-valuenow={active ?? 0}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate', label: 'Pin this day' }]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === 'increment') onStep(-1)
            else if (nativeEvent.actionName === 'decrement') onStep(1)
            else onTap(active ?? 0)
          }}
          onLayout={(event: LayoutChangeEvent) => { width.value = event.nativeEvent.layout.width }}
          style={styles.days}
        >
          {Array.from({ length: shownDays }, (_, i) => {
            const daysAgo = shownDays - 1 - i
            const status = incidents.get(daysAgo)?.status
            return <View key={daysAgo} style={[styles.day, status === 'degraded' && styles.dayDegraded, status === 'outage' && styles.dayOutage, active === daysAgo && styles.dayOn]} />
          })}
        </View>
      </GestureDetector>
    </View>
  )
})

/** Daily status bars per service. Drag along a row to preview a day's story, tap to pin it. */
export function UptimeCard({ services, title = 'System status', days = DEFAULT_DAYS, today, active: activeProp, pinned: pinnedProp, defaultPinned = null, onPinnedChange, locale = 'en-US', renderIcon, animated = true, style }: UptimeCardProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [now] = useState(() => today ?? new Date())
  const base = today ?? now
  const shownDays = Math.floor(days / 2)
  const [heldPin, setHeldPin] = useState<UptimeDay | null>(defaultPinned)
  const [scrub, setScrub] = useState<UptimeDay | null>(null)
  const [cursor, setCursor] = useState<UptimeDay>({ service: 0, daysAgo: 0 })
  const pinned = pinnedProp === undefined ? heldPin : pinnedProp
  const shown = activeProp ?? scrub ?? pinned
  const isPinned = Boolean(shown && same(shown, pinned))
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }), [locale])
  const dateAt = (daysAgo: number): string => date.format(new Date(base.getTime() - daysAgo * DAY_MS))
  const worst = services.flatMap((service) => service.incidents ?? []).filter((item) => item.daysAgo === 0)
  const tone = worst.some((item) => item.status === 'outage') ? 'danger' : worst.length ? 'warning' : 'success'
  const incident = shown ? services[shown.service]?.incidents?.find((item) => item.daysAgo === shown.daysAgo) : undefined
  const status: UptimeStatus = incident?.status ?? 'operational'

  function pin(day: UptimeDay | null): void {
    setHeldPin(day)
    onPinnedChange?.(day)
  }

  const nameOf = (service: UptimeService, daysAgo: number): string => {
    const found = service.incidents?.find((item) => item.daysAgo === daysAgo)
    return `${dateAt(daysAgo)}: ${found ? `${found.title}, ${found.detail}` : 'operational'}`
  }

  return (
    <Card animated={animated} style={style} bodyStyle={styles.body}>
      <View style={styles.stack}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <Badge tone={tone} animated={animated}>{tone === 'success' ? 'Operational' : 'Incident'}</Badge>
      </View>
      <View style={styles.slot}>
        {shown ? (
          <Animated.View key={`${shown.service}-${shown.daysAgo}`} {...(still ? {} : { entering: FadeIn.duration(120), exiting: FadeOut.duration(120) })} accessibilityLiveRegion="polite" style={[styles.detail, isPinned && styles.detailPinned]}>
            <View style={[styles.state, styles[status]]}>{withInk(renderIcon(status === 'operational' ? 'check' : 'alert-02', 12), accent.onSolid)}</View>
            <View style={styles.detailText}>
              <Text style={styles.headline} numberOfLines={1}>{incident?.title ?? `${services[shown.service]?.name ?? ''} operational`}</Text>
              <Text style={styles.meta} numberOfLines={1}>{dateAt(shown.daysAgo)} · {incident?.detail ?? 'no incidents'}</Text>
            </View>
            {isPinned ? <IconButton style={SELF.center} variant="ghost" size="sm" icon={renderIcon('x', 16)} label="Unpin" animated={animated} onPress={() => pin(null)} /> : <Text style={styles.meta}>Tap to pin</Text>}
          </Animated.View>
        ) : <Text style={styles.hint}>Drag along a row to see what happened</Text>}
      </View>
      <View style={styles.bars}>
      {services.map((service, index) => (
        <Row
          key={service.name}
          service={service}
          shownDays={shownDays}
          active={shown?.service === index ? shown.daysAgo : null}
          label={nameOf(service, cursor.service === index ? cursor.daysAgo : 0)}
          onScrub={(daysAgo) => setScrub(daysAgo === null ? null : { service: index, daysAgo })}
          onTap={(daysAgo) => { const day = { service: index, daysAgo }; pin(same(day, pinned) ? null : day) }}
          onStep={(by) => {
            const daysAgo = Math.max(0, Math.min(shownDays - 1, (cursor.service === index ? cursor.daysAgo : 0) + by))
            setCursor({ service: index, daysAgo })
            setScrub({ service: index, daysAgo })
          }}
        />
      ))}
      </View>
      <View style={styles.axis}><Text style={styles.meta}>{shownDays} days ago</Text><Text style={styles.meta}>Today</Text></View>
      </View>
    </Card>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  body: { padding: space[5] },
  stack: { gap: space[3.5] },
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  title: { ...type(14, c.textPrimary, '600'), lineHeight: 20 },
  slot: { justifyContent: 'center', height: 48 },
  hint: { ...type(12, c.textTertiary), lineHeight: 16 },
  detail: { alignItems: 'center', backgroundColor: c.ink4, borderRadius: radius.control, flexDirection: 'row', gap: space[2.5], height: 48, paddingLeft: space[2.5], paddingRight: space[2.5], paddingVertical: space[2] },
  detailPinned: { backgroundColor: c.surface, borderColor: c.ink8, borderWidth: 1, paddingRight: space[1.5], shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10 },
  state: { alignItems: 'center', borderRadius: radius.full, height: 20, justifyContent: 'center', width: 20 },
  operational: { backgroundColor: c.success },
  degraded: { backgroundColor: c.warning },
  outage: { backgroundColor: c.danger },
  detailText: { flex: 1, minWidth: 0 },
  headline: { ...type(14, c.textPrimary, '500'), lineHeight: 18 },
  meta: { ...type(12, c.textTertiary), lineHeight: 16 },
  bars: { gap: space[3] },
  service: { gap: space[1.5] },
  label: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  name: { ...type(14, c.textPrimary, '500'), lineHeight: 18 },
  uptime: { ...type(12, c.textTertiary, '400', true), lineHeight: 16 },
  // The finger target is the row (44 high); the bars inside it are 28, as on the web.
  days: { alignItems: 'center', flexDirection: 'row', gap: 2, minHeight: 44 },
  day: { backgroundColor: c.ink10, borderRadius: radius.xs, flex: 1, height: BAR_HEIGHT },
  dayDegraded: { backgroundColor: c.warning },
  dayOutage: { backgroundColor: c.danger },
  dayOn: { backgroundColor: c.inverse, transform: [{ scaleY: 1.15 }] },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
})
