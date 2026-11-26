import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated'
import { pressedState, radius, space, type Colors } from '../kit'
import { Badge } from './badge'
import { Button, SELF } from './button'
import { EASE_STANDARD, Panel, PanelBody, ROW_MS, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'

export type WebhookEndpoint = { id: string; name: string; url: string; events: string[]; extra?: number; rate: string; failing?: number }
export type WebhookDelivery = { id: string; status: number; event: string; duration: string; time: string; eventId?: string; attempt?: number; message?: string; payload?: string }
export type WebhookDetail = { addedBy: string; secret: string; total: number; failed: number; hours: { ok: number; failed: number }[]; axis: string[] }

export type WebhooksProps = {
  endpoints: WebhookEndpoint[]
  detail: WebhookDetail
  deliveries: WebhookDelivery[]
  defaultOpen?: string
  renderIcon: RenderIcon
  onAdd?: () => void
  onRetry?: (id: string) => void
  /** React Native ships no clipboard, so the app writes the text. */
  onCopy?: (payload: string) => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const HISTOGRAM = 48
/** Initials of the person in `Added by Ada Lovelace on ...`. */
const initials = (addedBy: string): string => (addedBy.replace(/^Added by /, '').split(' on ')[0] ?? '').split(/\s+/).map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase()
const detailIn = FadeInDown.duration(ROW_MS).easing(EASE_STANDARD).withInitialValues({ transform: [{ translateY: 8 }] })

/** Endpoints with health, a delivery histogram, recent deliveries with Retry, and one open delivery. */
export function Webhooks({ endpoints, detail, deliveries, defaultOpen, renderIcon, onAdd, onRetry, onCopy, animated = true, style }: WebhooksProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [active, setActive] = useState(endpoints[0]?.id)
  const [open, setOpen] = useState<string | null>(defaultOpen ?? null)
  const [retried, setRetried] = useState<string[]>([])
  const current = endpoints.find((item) => item.id === active)
  const delivery = deliveries.find((item) => item.id === open)
  const top = Math.max(...detail.hours.map((hour) => hour.ok + hour.failed), 1)
  const failing = endpoints.filter((item) => item.failing).length
  return (
    <Panel title="Webhooks" subtitle="Every event is signed and posted to your endpoints. Failed deliveries retry for three days, or you can retry them now." animated={animated} style={style}>
      <View style={styles.summary}>
        <Text style={styles.small}>{endpoints.length} endpoints · {failing} with failed deliveries</Text>
        <Button style={SELF.center} variant="secondary" shape="pill" size="sm" leadingIcon={renderIcon('plus', 14)} onPress={onAdd} animated={animated}>Add endpoint</Button>
      </View>
      <PanelBody flush>
        {endpoints.map((item, i) => (
          <Animated.View key={item.id} {...(still ? {} : { entering: rowEnter(i) })}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.url}, ${item.rate} delivered`} {...pressedState(item.id === active)} onPress={() => setActive(item.id)} style={[styles.endpoint, item.id === active && styles.on]}>
              <View>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.url}>{item.url}</Text>
              </View>
              {/* Mobile drops the event tags, as the web does under 480, and puts the rate on its own line. */}
              <View style={styles.rate}><Text style={styles.rateValue}>{item.rate}</Text><Text style={styles.quiet}>delivered</Text></View>
              <View style={styles.tag}>{item.failing ? <Badge size="sm" tone="warning" mark>{`${item.failing} failing`}</Badge> : <Badge size="sm" tone="success" mark>Healthy</Badge>}</View>
            </Pressable>
          </Animated.View>
        ))}
      </PanelBody>
      <PanelBody title={current?.name}>
        <View style={styles.who}>
          <View style={styles.initials}><Text style={styles.initialsText}>{initials(detail.addedBy)}</Text></View>
          <Text style={styles.small}>{detail.addedBy}</Text>
          <Text style={styles.secret}>{detail.secret}</Text>
        </View>
        <View style={styles.counts}>
          <Text style={styles.small}>{detail.total} events</Text>
          <View style={styles.failedCount}><View style={styles.failedDot} /><Text style={styles.small}>{detail.failed} failed</Text></View>
        </View>
        <View accessible accessibilityRole="image" accessibilityLabel={`${detail.total} events over 24 hours, ${detail.failed} failed`} style={styles.histogram}>
          {detail.hours.map((hour, i) => {
            const sum = hour.ok + hour.failed
            return <View key={i} style={[styles.column, { height: (sum / top) * HISTOGRAM }]}>{hour.failed ? <View style={[styles.failed, { height: `${(hour.failed / sum) * 100}%` }]} /> : null}</View>
          })}
        </View>
        <View style={styles.axis}>{detail.axis.map((tick) => <Text key={tick} style={styles.tick}>{tick}</Text>)}</View>
      </PanelBody>
      <PanelBody>
        <Text style={styles.recent}>Recent deliveries</Text>
        <View>
          {deliveries.map((item) => {
            const bad = item.status >= 400 && !retried.includes(item.id)
            const expanded = open === item.id
            return (
              <View key={item.id} style={[styles.delivery, expanded && styles.deliveryOn]}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.event}, ${bad ? item.status : 200}, ${item.time}`} aria-expanded={expanded} onPress={() => setOpen(expanded ? null : item.id)} style={styles.deliveryOpen}>
                  <Badge size="sm" tone={bad ? 'danger' : 'success'} mark>{String(bad ? item.status : 200)}</Badge>
                  <Text style={styles.event} numberOfLines={1}>{item.event}</Text>
                  <Text style={styles.time}>{item.time}</Text>
                </Pressable>
                {bad ? <Button style={SELF.center} variant="secondary" shape="pill" size="sm" leadingIcon={renderIcon('refresh-cw', 14)} onPress={() => { onRetry?.(item.id); setRetried((list) => [...list, item.id]) }} animated={animated}>Retry</Button> : null}
              </View>
            )
          })}
        </View>
      </PanelBody>
      {delivery ? (
        <Animated.View key={delivery.id} {...(still ? {} : { entering: detailIn, exiting: FadeOut.duration(ROW_MS) })}>
          <PanelBody>
            <View style={styles.line}>
              <View style={styles.text}><Text style={styles.mono}>{delivery.event}</Text><Text style={styles.small}>{delivery.eventId}, attempt {delivery.attempt ?? 1}</Text></View>
              <Button style={SELF.center} variant="secondary" shape="pill" size="sm" leadingIcon={renderIcon('copy', 14)} onPress={() => onCopy?.(delivery.payload ?? '')} animated={animated}>Copy</Button>
            </View>
            <View style={styles.response}><Text style={styles.small}>Response</Text><Badge size="sm" tone={delivery.status >= 400 ? 'danger' : 'success'} mark>{String(delivery.status)}</Badge><Text style={styles.small}>{delivery.message}</Text></View>
            <ScrollView horizontal style={styles.code}><Text style={styles.mono} selectable>{delivery.payload}</Text></ScrollView>
          </PanelBody>
        </Animated.View>
      ) : null}
    </Panel>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  summary: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: space[2], justifyContent: 'space-between', paddingBottom: space[3], paddingHorizontal: space[4] },
  small: { ...type(12, c.textSecondary), lineHeight: 16 },
  quiet: { ...type(12, c.textTertiary), lineHeight: 16 },
  tick: { ...type(10, c.textTertiary, '400', true), lineHeight: 12 },
  name: { ...type(14, c.textPrimary, '500'), lineHeight: 18 },
  mono: type(12, c.textPrimary, '400', true),
  url: { ...type(10, c.textSecondary, '400', true), lineHeight: 16 },
  endpoint: { gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2.5] },
  on: { backgroundColor: c.ink4 },
  rate: { alignItems: 'baseline', flexDirection: 'row', gap: space[2] },
  rateValue: { ...type(14, c.textPrimary, '500'), lineHeight: 18 },
  tag: { alignItems: 'flex-start' },
  line: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  who: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  initials: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, height: 24, justifyContent: 'center', width: 24 },
  initialsText: type(10, c.textSecondary, '500'),
  secret: { ...type(10, c.textTertiary, '400', true), lineHeight: 12, width: '100%' },
  counts: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
  failedCount: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  failedDot: { backgroundColor: c.danger, borderRadius: radius.full, height: 6, width: 6 },
  histogram: { alignItems: 'flex-end', flexDirection: 'row', gap: 2, height: HISTOGRAM },
  column: { backgroundColor: c.ink10, flex: 1, overflow: 'hidden' },
  failed: { backgroundColor: c.danger, left: 0, position: 'absolute', right: 0, top: 0 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  recent: { ...type(12, c.textTertiary), lineHeight: 16 },
  delivery: { alignItems: 'center', borderRadius: radius.field, flexDirection: 'row', gap: space[2], marginHorizontal: -space[2], paddingRight: space[2] },
  deliveryOn: { backgroundColor: c.ink4 },
  deliveryOpen: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: space[3], minHeight: 44, minWidth: 0, paddingHorizontal: space[2], paddingVertical: space[1] },
  event: { ...type(12, c.textPrimary, '400', true), flex: 1, minWidth: 0 },
  time: type(12, c.textTertiary, '400', true),
  text: { flex: 1, gap: space[0.5] },
  response: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  code: { backgroundColor: c.ink4, borderRadius: radius.control, padding: space[3] },
})
