import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated'
import { pressedState, radius, space, type Colors } from '../kit'
import { Badge } from './badge'
import { Button } from './button'
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
        <Button variant="secondary" shape="pill" size="sm" leadingIcon={renderIcon('plus', 14)} onPress={onAdd} animated={animated}>Add endpoint</Button>
      </View>
      <PanelBody flush>
        {endpoints.map((item, i) => (
          <Animated.View key={item.id} {...(still ? {} : { entering: rowEnter(i) })}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.url}, ${item.rate} delivered`} {...pressedState(item.id === active)} onPress={() => setActive(item.id)} style={[styles.endpoint, item.id === active && styles.on]}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.mono} numberOfLines={1}>{item.url}</Text>
              <View style={styles.tags}>
                {item.events.map((event) => <Badge key={event} size="sm" variant="outline" mark={false}>{event}</Badge>)}
                {item.extra ? <Badge size="sm" variant="outline" mark={false}>{`+${item.extra}`}</Badge> : null}
              </View>
              <View style={styles.line}><Text style={styles.small}>{item.rate} delivered</Text>{item.failing ? <Badge size="sm" tone="warning" mark>{`${item.failing} failing`}</Badge> : <Badge size="sm" tone="success" mark>Healthy</Badge>}</View>
            </Pressable>
          </Animated.View>
        ))}
      </PanelBody>
      <PanelBody title={current?.name}>
        <Text style={styles.small}>{detail.addedBy}</Text>
        <Text style={styles.mono}>{detail.secret}</Text>
        <Text style={styles.small}>{detail.total} events · {detail.failed} failed</Text>
        <View accessible accessibilityRole="image" accessibilityLabel={`${detail.total} events over 24 hours, ${detail.failed} failed`} style={styles.histogram}>
          {detail.hours.map((hour, i) => {
            const sum = hour.ok + hour.failed
            return <View key={i} style={[styles.column, { height: (sum / top) * HISTOGRAM }]}>{hour.failed ? <View style={[styles.failed, { height: `${(hour.failed / sum) * 100}%` }]} /> : null}</View>
          })}
        </View>
        <View style={styles.line}>{detail.axis.map((tick) => <Text key={tick} style={styles.tick}>{tick}</Text>)}</View>
      </PanelBody>
      <PanelBody title="Recent deliveries">
        {deliveries.map((item) => {
          const bad = item.status >= 400 && !retried.includes(item.id)
          const expanded = open === item.id
          return (
            <View key={item.id} style={styles.delivery}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.event}, ${bad ? item.status : 200}, ${item.time}`} aria-expanded={expanded} onPress={() => setOpen(expanded ? null : item.id)} style={styles.deliveryOpen}>
                <Badge size="sm" tone={bad ? 'danger' : 'success'} mark>{String(bad ? item.status : 200)}</Badge>
                <View style={styles.text}><Text style={styles.mono} numberOfLines={1}>{item.event}</Text><Text style={styles.tick}>{item.duration} · {item.time}</Text></View>
              </Pressable>
              {bad ? <Button variant="secondary" shape="pill" size="sm" leadingIcon={renderIcon('refresh-cw', 14)} onPress={() => { onRetry?.(item.id); setRetried((list) => [...list, item.id]) }} animated={animated}>Retry</Button> : null}
            </View>
          )
        })}
      </PanelBody>
      {delivery ? (
        <Animated.View key={delivery.id} {...(still ? {} : { entering: detailIn, exiting: FadeOut.duration(ROW_MS) })}>
          <PanelBody>
            <View style={styles.line}>
              <View style={styles.text}><Text style={styles.mono}>{delivery.event}</Text><Text style={styles.small}>{delivery.eventId}, attempt {delivery.attempt ?? 1}</Text></View>
              <Button variant="secondary" shape="pill" size="sm" leadingIcon={renderIcon('copy', 14)} onPress={() => onCopy?.(delivery.payload ?? '')} animated={animated}>Copy</Button>
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
  summary: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingBottom: space[3], paddingHorizontal: space[4] },
  small: type(12, c.textSecondary),
  tick: type(10, c.textTertiary),
  name: type(14, c.textPrimary, '500'),
  mono: type(12, c.textPrimary, '400', true),
  endpoint: { gap: space[1], padding: space[4] },
  on: { backgroundColor: c.ink4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  line: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  histogram: { alignItems: 'flex-end', flexDirection: 'row', gap: 2, height: HISTOGRAM },
  column: { backgroundColor: c.textTertiary, borderRadius: radius.xs, flex: 1, justifyContent: 'flex-end', overflow: 'hidden' },
  failed: { backgroundColor: c.danger },
  delivery: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  deliveryOpen: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: space[2], minHeight: 44 },
  text: { flex: 1, gap: space[0.5] },
  response: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  code: { backgroundColor: c.ink4, borderRadius: radius.field, padding: space[3] },
})
