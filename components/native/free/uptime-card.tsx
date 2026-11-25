import { memo, useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { FadeIn, FadeOut, runOnJS, useSharedValue } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
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
      <View style={styles.label}><Text style={styles.name}>{service.name}</Text><Text style={styles.meta}>{service.uptime}</Text></View>
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
            return <View key={daysAgo} style={[styles.day, status === 'degraded' && styles.degraded, status === 'outage' && styles.outage, active === daysAgo && styles.dayOn]} />
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
    <Card animated={animated} style={style}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <Badge tone={tone} animated={animated}>{tone === 'success' ? 'Operational' : 'Incident'}</Badge>
      </View>
      <View style={styles.slot}>
        {shown ? (
          <Animated.View key={`${shown.service}-${shown.daysAgo}`} {...(still ? {} : { entering: FadeIn.duration(120), exiting: FadeOut.duration(120) })} accessibilityLiveRegion="polite" style={styles.detail}>
            <View style={styles.state}>{renderIcon(status === 'operational' ? 'check' : 'alert', 12)}</View>
            <View style={styles.detailText}>
              <Text style={styles.headline} numberOfLines={1}>{incident?.title ?? `${services[shown.service]?.name ?? ''} operational`}</Text>
              <Text style={styles.meta} numberOfLines={1}>{dateAt(shown.daysAgo)} · {incident?.detail ?? 'no incidents'}</Text>
            </View>
            {isPinned ? <IconButton variant="ghost" size="sm" icon={renderIcon('x', 16)} label="Unpin" animated={animated} onPress={() => pin(null)} /> : <Text style={styles.meta}>Tap to pin</Text>}
          </Animated.View>
        ) : <Text style={styles.meta}>Drag along a row to see what happened</Text>}
      </View>
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
      <View style={styles.axis}><Text style={styles.meta}>{shownDays} days ago</Text><Text style={styles.meta}>Today</Text></View>
    </Card>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  title: type(16, c.textPrimary, '500'),
  slot: { justifyContent: 'center', minHeight: 44 },
  detail: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  state: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, height: 20, justifyContent: 'center', width: 20 },
  detailText: { flex: 1, gap: space[0.5] },
  headline: type(14, c.textPrimary, '500'),
  meta: type(12, c.textSecondary),
  service: { gap: space[1] },
  label: { flexDirection: 'row', justifyContent: 'space-between' },
  name: type(14, c.textPrimary),
  days: { alignItems: 'center', flexDirection: 'row', gap: 2, minHeight: 44 },
  day: { backgroundColor: c.success, borderRadius: radius.xs, flex: 1, height: BAR_HEIGHT, opacity: 0.8 },
  // kit.ts has no warning color yet, so a degraded day is a paler danger.
  degraded: { backgroundColor: c.danger, opacity: 0.5 },
  outage: { backgroundColor: c.danger, opacity: 1 },
  dayOn: { opacity: 1, transform: [{ scaleY: 1.15 }] },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
})
